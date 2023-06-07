const EachPromise = require('./each-promise')
const xmlSubtreeProcessor = require('./xml-subtree-processor')
const simplifyJson = require('./simplify-json')
const flattenJson = require('./flatten-json')
const jp = require('jsonpath')

function pivotFields (tree, pivotPath, selectPaths, requiredPaths) {
  const csv = flattenJson(tree, pivotPath, selectPaths)

  if (requiredPaths) {
    const requiredFields = flattenJson(tree, pivotPath, requiredPaths)
      .filter(f => f)
    if (requiredFields.length !== requiredPaths.length) { // uh-oh
      return null
    }
  }

  return csv
}

function * processPivot (tree, pivotPath, selectPaths, requiredPaths) {
  const csv = pivotFields(tree, pivotPath, selectPaths, requiredPaths)

  if (csv) yield (csv)
} // processPivot

function * processPivotArray (tree, pivotPath, count, selectPaths, requiredPaths) {
  for (let i = 0; i !== count; ++i) {
    const contextPath = `${pivotPath}[${i}]`

    const csv = pivotFields(tree, contextPath, selectPaths, requiredPaths)

    if (csv) yield (csv)
  }
} // processPivotArray

function * processSteppedArray (tree, pivotPath, selectPaths, requiredPaths) {
  const pivotPaths = jp.paths(tree, pivotPath).map(path => jp.stringify(path))

  for (const contextPath of pivotPaths) {
    const csv = pivotFields(tree, contextPath, selectPaths, requiredPaths)

    if (csv) yield (csv)
  }
} // processSteppedArray

function * processSubtree (
  subTree,
  pivotPath,
  selectPaths,
  requiredPaths
) {
  const cleanTree = simplifyJson(subTree)

  const pivots = jp.query(cleanTree, pivotPath)

  if (pivots.length > 1) {
    yield * processSteppedArray(cleanTree, pivotPath, selectPaths, requiredPaths)
  } else if (Array.isArray(pivots[0])) {
    yield * processPivotArray(cleanTree, pivotPath, pivots[0].length, selectPaths, requiredPaths)
  } else if (pivots[0]) {
    yield * processPivot(cleanTree, pivotPath, selectPaths, requiredPaths)
  }
} // processSubtree

function identityFn (x) { return x }

function xmlTransformToCsv (
  inputStream,
  elementName,
  pivotPath,
  selectPaths,
  required,
  options
) {
  const treeTransform = (options && options.transform) || identityFn

  return new EachPromise((each, resolve, reject) => {
    xmlSubtreeProcessor(inputStream, elementName, options)
      .each(subTree => {
        const transformedSubTree = treeTransform(subTree)
        for (const line of processSubtree(transformedSubTree, pivotPath, selectPaths, required)) {
          each(line)
        }
      })
      .then(() => resolve())
      .catch(err => reject(err))
  })
} // xmlTransformToCsv

module.exports = xmlTransformToCsv
