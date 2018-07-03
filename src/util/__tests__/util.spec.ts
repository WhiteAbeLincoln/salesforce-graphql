import { joinNames, mergeObjs, mapObj, filterObj } from '../../util'
import { maxHeight, partition, truncateToDepth, unzip, unzipEithers, foldRosePaths, removeLeafObjects } from '../util'
import { Tree } from 'fp-ts/lib/Tree'
import { Either, left, right } from 'fp-ts/lib/Either'
import { cons } from 'fp-ts/lib/Array'
import { parentQuery, ParentQuery } from '../../SOQL/SOQL'

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

    const obj = { a: 1, b: 2, c: 3 }

    expect(mapObj(toString)(obj)).toEqual({ a: '1', b: '2', c: '3' })
  })
})

describe('filterObj', () => {
  const strings = (value: any): value is string => typeof value === 'string'
  const obj = { a: 1, b: '2', c: false, d: '4' }

  it('filters an object by its values', () => {
    expect(filterObj(strings, obj)).toEqual({ b: '2', d: '4' })
  })

  it('does curried application', () => {
    expect(filterObj(strings)(obj)).toEqual(filterObj(strings, obj))
  })
})

describe('unzip', () => {
  it('unzips an array of pairs into a pair of arrays', () => {
    const arr: Array<[number, string]> = [[1, 'a'], [2, 'b'], [3, 'c'], [4, 'd']]
    const pair: [number[], string[]] = [[4, 3, 2, 1], ['d', 'c', 'b', 'a']]

    expect(unzip(arr)).toEqual(pair)
  })
})

describe('unzipEithers', () => {
  it('unzips an array of Either<L, R> into an Either<L[], R[]>', () => {
    const arr1: Array<Either<string, string>> = [left('hi'), left('hey'), right('hoo')]
    const arr2: Array<Either<string, string>> = [right('hi'), right('hey'), right('hoo')]

    expect(unzipEithers(arr1)).toEqual(left(['hi', 'hey']))
    expect(unzipEithers(arr2)).toEqual(right(['hi', 'hey', 'hoo']))
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

describe('foldRosePaths', () => {
  const t
    = new Tree(1,
      [ new Tree(2, [new Tree(3, [])])
      , new Tree(4, [])
      , new Tree(5, [new Tree(6, [])])
      ]
    )

  const plus = (a: number, b: number) => a + b

  it('folds a function over all the paths of a rose tree', () => {
    expect(
      foldRosePaths(cons as any, [], t)
    ).toEqual(
      [[1, 2, 3], [1, 4], [1, 5, 6]]
    )

    expect(
      foldRosePaths(plus, 0, t)
    ).toEqual(
      [6, 5, 12]
    )
  })

  it('does curried application', () => {
    expect(
      foldRosePaths(plus, 0, t)
    ).toEqual(
      foldRosePaths(plus, 0)(t)
    )

    expect(
      foldRosePaths(plus, 0)(t)
    ).toEqual(
      foldRosePaths(plus)(0)(t)
    )
  })
})

describe('truncateToDepth', () => {
  const tree4
    = new Tree(1,
      [ new Tree(2, [])
      , new Tree(2, [])
      , new Tree(2,
        [ new Tree(3, [])
        , new Tree(3,
          [ new Tree(4, [])
          , new Tree(4, [])
          , new Tree(4, [])
          ])
        ])
      ])

  const tree3
    = new Tree(1,
      [ new Tree(2, [])
      , new Tree(2, [])
      , new Tree(2,
        [ new Tree(3, [])
        , new Tree(3, [])
        ])
      ])

  it('truncates all leaves at depth greater than n', () => {
    expect(truncateToDepth(3, tree4)).toEqual(tree3)
  })

  it('does curried application', () => {
    expect(truncateToDepth(3)(tree4)).toEqual(truncateToDepth(3, tree4))
  })
})

describe('removeLeafObjects', () => {
  it('removes leafs from ParentQueries that have value with kind=\'object\'', () => {
    const nest = (p: ParentQuery) => parentQuery('MasterRecord', [ p ], true)

    const pq
      = parentQuery('MasterRecord', [
          'Id'
        ]).chain(nest)
          .chain(nest)
          .chain(nest)
          .chain(nest)
          .chain(nested => parentQuery('MasterRecord', [ 'Id', nested ], true))
          .map(truncateToDepth(5))
          .map(removeLeafObjects)

    expect(pq).toEqual(
      parentQuery('MasterRecord', [
        'Id'
      ])
    )
  })
})
