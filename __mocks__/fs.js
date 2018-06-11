// @ts-check
'use strict'

const path = require('path')
const fs = jest.genMockFromModule('fs')

let mockFS = Object.create(null)

/**
 * @type {Object.<string, { code: string, paths: string[] }>}
 */
let throwMap = Object.create(null)

function __initMockFiles() {
  mockFS = Object.create(null)
}

function __getMockFiles() {
  return mockFS
}

/**
 * 
 * @param {'mkdir'|'writeFile'} func 
 * @param {...string} paths 
 */
function __enableThrow(func, code, ...paths) {
  throwMap[func] = { code, paths }
}

/**
 * 
 * @param {'mkdir' | 'writeFile'} func 
 * @param {...string} paths 
 */
function __disableThrow(func, ...paths) {
  if (throwMap[func]) {
    if (paths.length > 0) {
      throwMap[func].paths = throwMap[func].paths.filter(p => paths.indexOf(p) < 0)
    } else {
      delete throwMap[func]
    }
  }
}

/**
 * Return an error if name in throwMap
 * @param {'mkdir'|'writeFile'} name
 * @param {string} path
 * @returns {NodeJS.ErrnoException | undefined}
 */
function throwIt(name, path) {
  if (typeof name === 'undefined') {
    throwMap = Object.create(null)
  } else if (name in throwMap) {
    // just throw
    if (throwMap[name].paths.length === 0 || throwMap[name].paths.indexOf(path) > -1) {
      /** @type {NodeJS.ErrnoException} */
      const err = new Error(`Mock ${throwMap[name].code}`)
      err.code = throwMap[name].code
      err.path = path
      err.errno = 1

      return err
    }
  }

}

function mkdir(path, callback) {
  mockFS[path] = mockFS[path] || {}
  callback(throwIt('mkdir', path))
}

function writeFile(filepath, data, callback) {
  const dir = path.dirname(filepath)
  const file = path.basename(filepath)

  mockFS[dir][file] = data

  callback(throwIt('writeFile', filepath))
}

fs.__initMockFiles = __initMockFiles
fs.__getMockFiles = __getMockFiles
fs.__disableThrow = __disableThrow
fs.__enableThrow = __enableThrow
fs.mkdir = mkdir
fs.writeFile = writeFile

module.exports = fs