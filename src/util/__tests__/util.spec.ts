import { joinNames, mergeObjs, mapObj, filterObj } from '../../util'

// tslint:disable:no-expression-statement

describe('joinNames', () => {
  it('transforms the list of strings to a camel-cased string', () => {
    const arr = ['hi', 'there', 'man']
    expect(joinNames(arr)).toEqual('HiThereMan')
  })

  it('appends the optional final parameter to the camel-cased string', () => {
    const arr = ['hi', 'there', 'man']
    expect(joinNames(arr, 'union')).toEqual('HiThereManUnion')
  })
})

describe('mergeObjs', () => {
  it('merges an array of objects into one new object', () => {
    const arr = [{a: 1}, {b: 2}]
    const obj = mergeObjs(...arr)
    arr.forEach(o => {
      expect(o === obj).toBeFalsy()
      expect(obj).toMatchObject(o)
    })
  })
})

describe('mapObj', () => {
  it('maps a function over the keys and values of an object', () => {
    const toString = (value: number) => value.toString()
    const toStringKeys = (value: number, key: string) => ({ key: key + 'STRING', value: value.toString() })

    const obj = { a: 1, b: 2, c: 3 }

    expect(mapObj(toString)(obj)).toEqual({ a: '1', b: '2', c: '3' })
    expect(mapObj(toStringKeys)(obj)).toEqual({ aSTRING: '1', bSTRING: '2', cSTRING: '3' })
  })
})

describe('filterObj', () => {
  it('filters an object by its keys', () => {
    const strings = (value: any): value is string => typeof value === 'string'

    const obj = { a: 1, b: '2', c: false, d: '4' }

    expect(filterObj(strings)(obj)).toEqual({ b: '2', d: '4' })
  })
})
