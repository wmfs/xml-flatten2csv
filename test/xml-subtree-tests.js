/* eslint-env mocha */

const chai = require('chai')
const dirtyChai = require('dirty-chai')
chai.use(dirtyChai)

const expect = chai.expect
const Readable = require('stream').Readable

const xmlSubtreeProcessor = require('../lib/xml-subtree-processor')

function stream (text) {
  const s = new Readable()
  s.push(text)
  s.push(null)
  return s
} // stream

describe('xml-subtree-processor', () => {
  describe('finding subtrees', () => {
    it('count requested subtrees', () => {
      let count = 0

      return xmlSubtreeProcessor(
        stream('<root><sub/><ignore/><sub/></root>'),
        'sub'
      )
        .each(() => ++count)
        .then(() => expect(count).to.equal(2))
    })

    it('find subtree regardless of how deeply nested', async () => {
      let count = 0

      await xmlSubtreeProcessor(
        stream('<root><h><h><h><h><h><h><d><d><a><a><y><afs><a><sub/></a></afs></y></a></a></d></d></h><sub/></h></h></h></h></h></root>'),
        'sub'
      ).each(() => ++count)

      expect(count).to.equal(2)
    })
  })

  describe('extracting subtrees', () => {
    it('extract subtree with text', async () => {
      let tree = null

      await xmlSubtreeProcessor(
        stream('<root><sub>Hello</sub></root>'),
        'sub'
      ).each(sub => {
        tree = sub
      })

      expect(tree).to.exist()
      expect(tree).to.eql({ '#text': 'Hello' })
    })

    it('extract subtrees with text', async () => {
      let tree = []

      await xmlSubtreeProcessor(
        stream('<body><p><line>Hello</line><line>World!</line></p></body>'),
        'line'
      ).each(sub => {
        tree.push(sub)
      })

      expect(tree).to.exist()
      expect(tree).to.eql([{ '#text': 'Hello' }, { '#text': 'World!' }])
    })

    it('extract subtree with nested elements', async () => {
      let tree = null

      await xmlSubtreeProcessor(
        stream('<body><p><line><lineItem>Hello</lineItem></line><line><lineItem>World!</lineItem></line></p></body>'),
        'p'
      ).each(sub => {
        tree = sub
      })

      expect(tree).to.exist()
      expect(tree).to.eql({
        line: [
          { lineItem: [{ '#text': 'Hello' }] },
          { lineItem: [{ '#text': 'World!' }] }
        ]
      })
    })

    it('strip extraneous whitespace nested elements', async () => {
      let tree = null

      await xmlSubtreeProcessor(
        stream(`<body>
  <p>
    <line>Hello</line>
    <line>World!</line>
  </p>
</body>`),
        'p'
      ).each(sub => {
        tree = sub
      })

      expect(tree).to.exist()
      expect(tree).to.eql({
        line: [{ '#text': 'Hello' }, { '#text': 'World!' }]
      })
    })

    it('extract subtree with deeply nested elements', async () => {
      let tree = null

      await xmlSubtreeProcessor(
        stream('<body><p><line>Hello <strong>World!</strong></line></p></body>'),
        'p'
      ).each(sub => {
        tree = sub
      })

      expect(tree).to.exist()
      expect(tree).to.eql({
        line: [{ '#text': 'Hello ', strong: [{ '#text': 'World!' }] }]
      })
    })
  })

  describe('namespace handling', async () => {
    it('match on prefix:name not {url}name because parser is not namespace aware', async () => {
      let tree = null

      await xmlSubtreeProcessor(
        stream('<a:body xmlns:a="urn:testing"><a:p><a:line>Hello <strong>World!</strong></a:line></a:p></a:body>'),
        'a:p'
      ).each(sub => { tree = sub })

      expect(tree).to.exist()
      expect(tree).to.eql({
        'a:line': [{ '#text': 'Hello ', strong: [{ '#text': 'World!' }] }]
      })
    })

    it('strip namespace prefixes', async () => {
      let tree = null

      await xmlSubtreeProcessor(
        stream('<a:body xmlns:a="urn:testing" xmlns:b="urn:moretesting"><a:p><a:line>Hello <b:strong>World!</b:strong></a:line></a:p></a:body>'),
        'p',
        { namespace: 'strip' }
      ).each(sub => { tree = sub })

      expect(tree).to.exist()
      expect(tree).to.eql({
        line: [{ '#text': 'Hello ', strong: [{ '#text': 'World!' }] }]
      })
    })

    it('switch namespace prefixes', async () => {
      let tree = null

      await xmlSubtreeProcessor(
        stream('<a:body xmlns:a="urn:testing" xmlns:b="urn:moretesting"><a:p><a:line>Hello <b:strong>World!</b:strong></a:line></a:p></a:body>'),
        'a__p',
        { namespace: '__' }
      ).each(sub => { tree = sub })

      expect(tree).to.exist()
      expect(tree).to.eql({
        a__line: [{ '#text': 'Hello ', b__strong: [{ '#text': 'World!' }] }]
      })
    })
  })

  describe('xmllang handling', () => {
    it('do nothing with xmllang', async () => {
      let tree = null

      await xmlSubtreeProcessor(
        stream('<body><p xml:lang="en"><line>Hello <strong>World!</strong></line></p></body>'),
        'p'
      ).each(sub => { tree = sub })

      expect(tree).to.exist()
      expect(tree).to.eql({
        line: [{ '#text': 'Hello ', strong: [{ '#text': 'World!' }] }]
      })
    })

    it('xmllang wrap on pivot', async () => {
      let tree = null

      await xmlSubtreeProcessor(
        stream('<body><p xml:lang="en"><line>Hello <strong>World!</strong></line></p></body>'),
        'p',
        { xmllang: 'wrap' }
      ).each(sub => { tree = sub })

      expect(tree).to.exist()
      expect(tree).to.eql({
        en: [{ line: [{ '#text': 'Hello ', strong: [{ '#text': 'World!' }] }] }]
      })
    })

    it('xmllang wrap', async () => {
      let tree = null

      await xmlSubtreeProcessor(
        stream('<body><p><line xml:lang="en">Hello <strong>World!</strong></line></p></body>'),
        'p',
        { xmllang: 'wrap' }
      ).each(sub => { tree = sub })

      expect(tree).to.exist()
      expect(tree).to.eql({
        line: [{ 'en': [{ '#text': 'Hello ', strong: [{ '#text': 'World!' }] }] }]
      })
    })

    it('xmllang wrap, multiple languages', async () => {
      let tree = null

      await xmlSubtreeProcessor(
        stream('<body><p><line xml:lang="en">Hello <strong>World!</strong></line><line xml:lang="fr">Bonjour <strong>tout le monde!</strong></line></p></body>'),
        'p',
        { xmllang: 'wrap' }
      ).each(sub => { tree = sub })

      expect(tree).to.exist()
      expect(tree).to.eql({
        line: [
          { 'en': [{ '#text': 'Hello ', strong: [{ '#text': 'World!' }] }] },
          { 'fr': [{ '#text': 'Bonjour ', strong: [{ '#text': 'tout le monde!' }] }] }
        ]
      })
    })
  })
})
