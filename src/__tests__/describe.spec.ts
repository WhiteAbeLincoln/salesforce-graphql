import { DescribeSObjectResult } from 'jsforce'
import { readFileSync } from 'fs'
import { importDescribeFiles } from '../describe'

// tslint:disable:no-expression-statement

const syncObjects: DescribeSObjectResult[]
  = [
      JSON.parse(readFileSync('src/__tests__/describes/AccountContactRole.desc.json', 'utf8'))
    , JSON.parse(readFileSync('src/__tests__/describes/Account.desc.json', 'utf8'))
    , JSON.parse(readFileSync('src/__tests__/describes/NoFields.desc.json', 'utf8'))
    , JSON.parse(readFileSync('src/__tests__/describes/NotQueryable.desc.json', 'utf8'))
    ]

describe('importDescribeFiles', () => {
  it('loads the describe files given a directory path', () => {
    return importDescribeFiles('src/__tests__/describes')
            .then(ps => Promise.all(ps))
            .then(results => {
              results.forEach(res => {
                expect(syncObjects).toContainEqual(res)
              })

              syncObjects.forEach(obj => {
                expect(results).toContainEqual(obj)
              })
            })
  })

  it('loads the describe files given a file path', () => {
    return importDescribeFiles('src/__tests__/describes/AccountContactRole.desc.json')
            .then(ps => Promise.all(ps))
            .then(([result]) => {
              expect(result).toEqual(syncObjects[0])
            })
  })

  // TODO: write mixed file and directory test
})

// describe('writeDescribeFiles', () => {
//   it('')
// })
