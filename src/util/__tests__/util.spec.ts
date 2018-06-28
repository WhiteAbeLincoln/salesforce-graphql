import { joinNames, mergeObjs, mapObj, filterObj } from '../../util'
import { maxHeight, partition } from '../util'
import { Tree } from 'fp-ts/lib/Tree'

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

describe('partition', () => {
  it('filters an array into groups using the passed function map', () => {
    const arr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    const parted = partition(arr, {
      even: x => x % 2 === 0
    , odd: x => x % 2 !== 0
    })

    expect(parted.even.every(x => x % 2 === 0)).toBe(true)
    expect(parted.odd.every(x => x % 2 !== 0)).toBe(true)
  })

  it('defaults to exclusive filtering', () => {
    const arr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    const parted = partition(arr, {
      even: x => x % 2 === 0
    , odd: x => x % 2 !== 0
    , all: _ => true // should get all items
    })

    expect(parted.even.every(x => x % 2 === 0)).toBe(true)
    expect(parted.odd.every(x => x % 2 !== 0)).toBe(true)
    expect(parted.all).toHaveLength(0)
  })

  it('doesn\'t have to exclusively filter', () => {
    const arr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    const parted = partition(arr, {
      even: x => x % 2 === 0
    , odd: x => x % 2 !== 0
    , all: _ => true // should get all items
    }, false)

    expect(parted.even.every(x => x % 2 === 0)).toBe(true)
    expect(parted.odd.every(x => x % 2 !== 0)).toBe(true)
    expect(parted.all).toEqual(arr)
  })

  it('reduces the types of the output map', () => {
    const arr = [0, '1', 2, '3', 4, '5', 6, '7', 8, '9']
    const parted: {
      strings: string[]
      numbers: number[]
    } = partition(arr, {
      strings: (x): x is string => typeof x === 'string'
    , numbers: (x): x is number => typeof x === 'number'
    })

    expect(parted.strings).toHaveLength(5)
    expect(parted.numbers).toHaveLength(5)
  })
})

describe('maxHeight', () => {
  it('gets the maximum height of a rose tree', () => {
    const tree
      = new Tree(1,
        [ new Tree(2,
          [ new Tree(3, []) ]
          )
        , new Tree(2, [])
        , new Tree(2,
          [ new Tree(3, [])
          , new Tree(3, [])
          , new Tree(3,
            [ new Tree(4, []) ]
            )
          ])
        ])

    expect(maxHeight(tree)).toBe(4)
  })
})
