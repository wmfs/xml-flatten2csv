/* eslint-env mocha */

const path = require('path')
const fs = require('fs')
const expect = require('chai').expect
const assert = require('chai').assert
const xmlFlatten2csv = require('../lib')

describe('xmlFlatten2csv', () => {
  const tests = [
    ['xml to csv', 'simpsons.csv', [
      ['$.Title', 'title', 'string'],
      ['@.Name', 'name', 'string'],
      ['@.Age', 'age', 'integer'],
      ['@.Siblings.Sister', 'sister', 'string'],
      ['@.Siblings.Brother', 'brother', 'string']
    ] ],
    ['xml to csv, with conditions', 'simpsons-conditions.csv', [
      ['$.Title', 'title', 'string'],
      ['@.Name', 'name', 'string'],
      [{ test: '@.Age<=16', value: 'yes' }, 'child', 'string'],
      [{ test: '@.Age>16', select: '@.Age' }, 'age', 'integer'],
      ['@.Siblings[?(@.Sister === "Nediana")].Sister', 'okely-dokely', 'string'],
      ['@.Siblings[?(@.Brother === "Bart")].Brother', 'eat-my-shorts', 'string']
    ] ],
    ['xml to csv, with value transforms', 'simpsons-transforms.csv', [
      ['$.Title', 'title', 'string'],
      [{ select: '@.Name', transform: v => v.toUpperCase() }, 'name', 'string'],
      [{ test: '@.Age<=16', value: 'yes' }, 'child', 'string'],
      [{ test: '@.Age>16', select: '@.Age', transform: v => `${v} years old` }, 'age', 'string']
    ] ],
    ['xml to csv, with top-level transform', 'simpsons-node-transforms.csv', [
      ['$.Title', 'title', 'string'],
      ['@.Name', 'name', 'string'],
      ['@.Age', 'age', 'integer'],
      ['@.Siblings.Sister', 'sister', 'string'],
      ['@.Siblings.Brother', 'brother', 'string']
    ], testNodeTransform ]
  ]

  function testNodeTransform (obj) {
    const tx = Array.isArray(obj) ? [] : { }
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string') {
        tx[k] = v.toUpperCase()
      } else if (v instanceof Object) {
        tx[k] = testNodeTransform(v)
      } else {
        tx[k] = v
      }
    }
    return tx
  }

  describe('extract XML', () => {
    for (const [title, filename, headerMap, transformFn] of tests) {
      it(title, async () => {
        await test(
          'simpsons.xml',
          filename,
          'Episode',
          '$.People.Person',
          headerMap,
          transformFn
        )
      })
    }

    it('gml extract', async () => {
      const root = 'Street'
      const pivot = '$..StreetDescriptiveIdentifier'
      const headerMap = [
        ['$.usrn', 'usrn', 'number'],
        ['$.changeType', 'changeType', 'string'],
        ['$.state', 'state', 'number'],
        ['$.stateDate', 'state_date', 'date'],
        ['@.streetDescription.en', 'description', 'string', 'required'],
        ['@.locality.en', 'locality', 'string'],
        ['@.townName.en', 'town_name', 'string'],
        ['@.administrativeArea.en', 'administrative_area', 'string']
      ]

      await test(
        'ST2065.gml',
        'gml-extract.csv',
        root,
        pivot,
        headerMap
      )
    })

    async function test (
      inputFilename,
      outputFilename,
      root,
      pivot,
      headerMap,
      transformFn
    ) {
      const sourceFile = path.resolve(__dirname, 'fixtures', inputFilename)
      const outputFile = path.resolve(__dirname, 'output', outputFilename)
      const expectedFile = path.resolve(__dirname, 'expected', outputFilename)

      if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile)

      await xmlFlatten2csv({
        xmlPath: sourceFile,
        csvPath: outputFile,
        rootXMLElement: root,
        pivotPath: pivot,
        headerMap: headerMap,
        transform: transformFn,
        namespace: 'strip',
        xmllang: 'wrap'
      })

      const output = fs.readFileSync(outputFile, { encoding: 'utf8' }).split('\n').map(s => s.trim())
      const expected = fs.readFileSync(expectedFile, { encoding: 'utf8' }).split('\n').map(s => s.trim())

      expect(output).to.eql(expected)
    } // test
  })

  describe('error cases', () => {
    const sourceFile = path.resolve(__dirname, 'fixtures', 'simpsons.xml')
    const outputFile = path.resolve(__dirname, 'output', 'fail.csv')

    it('bad input file', async () => {
      try {
        await xmlFlatten2csv({
          xmlPath: 'i-do-not-exist',
          csvPath: outputFile,
          rootXMLElement: 'Episode',
          pivotPath: '$.People.Person',
          headerMap: [
            ['$.Title', 'title', 'string'],
            ['@.Name', 'name', 'string'],
            ['@.Age', 'age', 'integer'],
            ['@.Siblings.Brother', 'brother', 'string'],
            ['@.Siblings.Sister', 'sister', 'string']
          ]
        })
      } catch (err) {
        expect(err.code).to.equal('ENOENT')
        return
      }

      assert.fail('Did not throw')
    })

    if (process.platform !== 'win32') {
      it('bad output file', async () => {
        try {
          await xmlFlatten2csv({
            xmlPath: sourceFile,
            csvPath: '/root/can#t"be/created',
            rootXMLElement: 'Episode',
            pivotPath: '$.Person',
            headerMap: [
              ['$.Title', 'title', 'string'],
              ['@.Name', 'name', 'string'],
              ['@.Age', 'age', 'integer'],
              ['@.Siblings.Brother', 'brother', 'string'],
              ['@.Siblings.Sister', 'sister', 'string']
            ]
          })
        } catch (err) {
          expect(err.code).to.equal('EACCES')
          return
        }

        assert.fail('Did not throw')
      })
    }

    it('empty header map', async () => {
      try {
        await xmlFlatten2csv({
          xmlPath: sourceFile,
          csvPath: outputFile,
          rootXMLElement: 'Episode',
          pivotPath: '$.Person',
          headerMap: []
        })
      } catch (err) {
        return
      }

      assert.fail('Did not throw')
    })
  })
})
