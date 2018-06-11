import { DescribeSObjectResult } from 'jsforce'
import { readFileSync } from 'fs'
import { writeDescribeFiles } from '../describe'

const syncObjects: { [key: string]: DescribeSObjectResult }
  = {
      AccountContactRole:  JSON.parse(readFileSync('src/__tests__/describes/AccountContactRole.desc.json', 'utf8'))
    , Account: JSON.parse(readFileSync('src/__tests__/describes/Account.desc.json', 'utf8'))
    , NoFields: JSON.parse(readFileSync('src/__tests__/describes/NoFields.desc.json', 'utf8'))
    , NotQueryable: JSON.parse(readFileSync('src/__tests__/describes/NotQueryable.desc.json', 'utf8'))
    }

// tslint:disable:no-expression-statement

describe('writeDescribeFiles', () => {
  jest.mock('fs')
  const fs = require('fs')
  const writeDescFiles = require('../describe').writeDescribeFiles as typeof writeDescribeFiles

  beforeEach(() => {
    fs.__initMockFiles()
    fs.__disableThrow()
  })

  it('writes all files to the correct directory', () => {
    const { __getMockFiles } = fs

    return writeDescFiles(Object.values(syncObjects), 'path')
      .then(ps => Promise.all(ps))
      .then(names => {
        expect(names).toHaveLength(Object.keys(syncObjects).length)
        const filesystem = __getMockFiles()

        names.forEach(name => {
          expect(filesystem.path[name]).toEqual(syncObjects[name])
        })
      })
  })

  it('throws when an error is recieved', () => {
    const { __enableThrow } = fs
    __enableThrow('mkdir', 'EPERM', 'path')

    expect(writeDescFiles(Object.values(syncObjects), 'path')).rejects.toThrow('Mock EPERM')
  })

  it('doesn\'t throw on EEXIST error', () => {
    const { __enableThrow } = fs
    __enableThrow('mkdir', 'EEXIST', 'path')

    expect(writeDescFiles(Object.values(syncObjects), 'path')).resolves.not.toThrow('Mock EEXIST')
  })
})

// describe('describeSalesforceObjects', () => {
//   jest.mock('jsforce')
//   const jsforce = require('jsforce')
//   const describeSfObjects = require('../describe').describeSalesforceObjects as typeof describeSalesforceObjects

//   it('fetches salesforce describe objects', () => {
//     jsforce.__connectionInstance.__setDescribeResultMap(syncObjects)
//     jsforce.__connectionInstance.__setDescribeGlobalResult(Object.keys(syncObjects).map(k => ({ name: k })))
//     console.log(jsforce.__connectionInstance.__describeGlobalResult)

//     return describeSfObjects('un', 'pw', {
//       instanceUrl: 'blah'
//     }).then(ps => Promise.all(ps))
//     .then(descs => {
//       expect(descs).toEqual(Object.values(syncObjects))
//     })
//   })
// })
