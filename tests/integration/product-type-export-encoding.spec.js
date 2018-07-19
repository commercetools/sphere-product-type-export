import 'babel-polyfill'
import test from 'tape'
import fs from 'fs'
import glob from 'glob'
import tempfile from 'tempfile'
import path from 'path'
import iconv from 'iconv-lite'

import ProductTypeExport from '../../src/product-type-export'
import * as utils from '../utils'

const ENCODING = 'win1250'
const PRODUCT_TYPE_KEY = 'productTypeKey'

const createProductType = () => ({
  key: PRODUCT_TYPE_KEY,
  name: 'custom-product-type',
  description: 'Some description - žluťoučký kůň úpěl ďábelské ódy',
  attributes: [
    {
      name: 'breite',
      label: {
        en: 'EN:žluťoučký kůň úpěl ďábelské ódy',
        de: 'DE:ě=ášéýřéý=čáěéžěížěé',
      },
      type: {
        name: 'number',
      },
      attributeConstraint: 'None',
      isRequired: false,
      isSearchable: false,
      inputHint: 'SingleLine',
    },
  ],
})

let client
let productTypeExport
let OUTPUT_FOLDER

async function before () {
  const clientConfig = await utils.getClientConfig()

  client = await utils.getClient()
  OUTPUT_FOLDER = tempfile()
  fs.mkdirSync(OUTPUT_FOLDER)

  productTypeExport = new ProductTypeExport({
    sphereClientConfig: {
      config: clientConfig,
    },
    config: {
      outputFolder: OUTPUT_FOLDER,
      encoding: ENCODING,
    },
  })

  await utils.deleteAll('productTypes', client)
  return client.productTypes.create(createProductType())
}

test(`productType export module
  should output a product types and an attributes `
  + `file using a ${ENCODING} encoding`, async (t) => {
  t.timeoutAfter(30000) // 30s
  const expectedFileName1 = 'attributes.csv'
  const expectedFileName2 = 'products-to-attributes.csv'
  /* eslint-disable max-len */
  const expectedResult1 =
      'name,type,attributeConstraint,isRequired,isSearchable,label.en,label.de,textInputHint,displayGroup\n'
    + 'breite,number,None,false,false,EN:žluťoučký kůň úpěl ďábelské ódy,DE:ě=ášéýřéý=čáěéžěížěé,SingleLine,Other\n'
  const expectedResult2 = 'name,key,description,breite\n'
    + 'custom-product-type,productTypeKey,Some description - žluťoučký kůň úpěl ďábelské ódy,X\n'

    /*
    * TODO
    * use only one string when Node 10 LTS support kicks in October 2018
    * remove support for Node v6
    * remove the if(process.version[1])
    */
  let expectedEncoded1 =
    'name,type,attributeConstraint,isRequired,isSearchable,label.en,label.de,textInputHint,displayGroup\n'
    + 'breite,number,None,false,false,EN:�lu�ou�k� k�� �p�l ��belsk� �dy,DE:�=�������=����������,SingleLine,Other\n'

  if (process.version[1] >= 8)
    expectedEncoded1 = 'name,type,attributeConstraint,isRequired,isSearchable,label.en,label.de,textInputHint,displayGroup\n'
    + 'breite,number,None,false,false,EN:�lu�ou�k� k�� �p�l ��belsk� �dy,DE:�=������=��������,SingleLine,Other\n'

  const expectedEncoded2 = 'name,key,description,breite\n'
    + 'custom-product-type,productTypeKey,Some description - �lu�ou�k� k�� �p�l ��belsk� �dy,X\n'
  /* eslint-enable max-len */

  try {
    await before()
    await productTypeExport.run()
    await new Promise((resolve) => {
      glob(path.join(OUTPUT_FOLDER, '*'), (err, files) => {
        t.equal(files.length, 2, 'files length is 2')
        t.equal(
          files[0].split('/').pop(),
          expectedFileName1,
          `file name is ${expectedFileName1}`,
        )
        t.equal(
          files[1].split('/').pop(),
          expectedFileName2,
          `file name is ${expectedFileName2}`,
        )
        resolve()
      })
    })

    const fileContent1 =
      fs.readFileSync(path.join(OUTPUT_FOLDER, expectedFileName1))
    const fileContent2 =
      fs.readFileSync(path.join(OUTPUT_FOLDER, expectedFileName2))

    const decoded1 = iconv.decode(fileContent1, ENCODING)
    const decoded2 = iconv.decode(fileContent2, ENCODING)

    t.equal(
      fileContent1.toString(),
      expectedEncoded1,
      `Attributes should be encoded in ${ENCODING}`,
    )
    t.equal(
      fileContent2.toString(),
      expectedEncoded2,
      `ProductType should be encoded in ${ENCODING}`,
    )

    t.equal(
      decoded1,
      expectedResult1,
      'Attributes should decode back to utf8',
    )
    t.equal(
      decoded2,
      expectedResult2,
      'ProductType should decode back to utf8',
    )
    t.end()
  } catch (e) {
    t.end(e)
  }
})
