import { getWhereClause, convertToProperTree } from '../Parse'
import { BooleanOp, WhereTree, BooleanExpression } from '../../../SOQL/WhereTree'
import { singleton, Node, empty, Leaf } from '../../BinaryTree'
import { FilterNode } from '../WhereArgs'

// tslint:disable:no-expression-statement
// tslint:disable:no-console
const getInvalidTrees = () => {
  const notEnoughForest1: FilterNode = {
    node: { AND: [ { } ] }
  }

  const notEnoughForest2: FilterNode = {
    node: { OR: [ { } ] }
  }

  const bothLeafAndNode: FilterNode =  { node: { AND: [] }
                                       , leaf: { a: { gt: 'b' } } }

  const omitLeafAndNode: FilterNode = {}
  const missingField: FilterNode = { leaf: {} }
  const missingBoolOperator: FilterNode = { node: {} }
  const missingCompOperator: FilterNode = { leaf: { a: { } } }

  const invalidTrees =  [ notEnoughForest1
                        , notEnoughForest2
                        , bothLeafAndNode
                        , omitLeafAndNode
                        , missingField
                        , missingBoolOperator
                        , missingCompOperator
                        ]

  return invalidTrees
}

const getValidTrees = () => {
  const now = new Date()
  const numberValue: [FilterNode, WhereTree]
    = [ { leaf: { a: { eq: 1 } } }
      , singleton<BooleanExpression>({ field: 'a', op: '=', value: 1 })
      ]

  const dateValue: [FilterNode, WhereTree]
    = [ { leaf: { a: { eq: now } } }
      , singleton<BooleanExpression>({ field: 'a', op: '=', value: now })
      ]

  const stringValue: [FilterNode, WhereTree]
    = [ { leaf: { a: { eq: `'b'` } } }
      , singleton<BooleanExpression>({ field: 'a', op: '=', value: `'b'` })
      ]

  const booleanValue: [FilterNode, WhereTree]
    = [ { node: { OR: [
          { leaf: { a: { eq: true } } }
        , { leaf: { b: { eq: false } } }
        ] } }
      , new Node<BooleanOp | BooleanExpression>('OR'
        , singleton<BooleanExpression>({ field: 'a', op: '=', value: true })
        , singleton<BooleanExpression>({ field: 'b', op: '=', value: false })
        )
      ]

  const includesCheck: [FilterNode, WhereTree]
    = [ { leaf: { a: { includes: [ 'a', 'b' ] } } }
      , singleton<BooleanExpression>({ field: 'a', op: 'INCLUDES', value: ['a', 'b'] })
      ]

  const multipleOperators: [FilterNode, WhereTree]
    = [ { leaf: { a: { gt: 1, lt: 3 } } }
      , new Node<BooleanOp | BooleanExpression>('AND'
        , singleton<BooleanExpression>({ field: 'a', op: '>', value: 1 })
        , singleton<BooleanExpression>({ field: 'a', op: '<', value: 3 })
        )
      ]

  const multipleFields: [FilterNode, WhereTree]
    = [ { leaf: { a: { gt: 1 }, b: { lt: 2 } } }
      , new Node<BooleanOp | BooleanExpression>('AND'
        , singleton<BooleanExpression>({ field: 'a', op: '>', value: 1 })
        , singleton<BooleanExpression>({ field: 'b', op: '<', value: 2 })
        )
      ]

  const notTree: [FilterNode, WhereTree]
      = [ { node: { NOT: { leaf: { a: { eq: true } } } } }
        , new Node<BooleanOp | BooleanExpression>('NOT'
          , singleton<BooleanExpression>({ field: 'a', op: '=', value: true })
          , empty
          )
        ]

  const tree3: [FilterNode, WhereTree]
    = [ { node: { AND: [
            { leaf: { a: { eq: 'b' } } }
          , { leaf: { c: { gt: 'd' } } }
          , { node: { OR: [
              { leaf: { e: { lt: 'f' } } }
            , { leaf: { g: { like: 'h' } } }
            ] } }
          ] }
        }
      , new Node<BooleanOp | BooleanExpression>('AND'
        , new Node<BooleanOp | BooleanExpression>('AND'
          , singleton<BooleanExpression>({ field: 'a', op: '=', value: 'b' })
          , singleton<BooleanExpression>({ field: 'c', op: '>', value: 'd' })
          )
        , new Node<BooleanOp | BooleanExpression>('OR'
          , singleton<BooleanExpression>({ field: 'e', op: '<', value: 'f' })
          , singleton<BooleanExpression>({ field: 'g', op: 'LIKE', value: 'h' })
          )
        )
      ]

  const validTrees
    = [ numberValue
      , stringValue
      , dateValue
      , booleanValue
      , notTree
      , includesCheck
      , multipleOperators
      , multipleFields
      , tree3
      ]

  return validTrees
}

describe('getWhereClause', () => {
  it('returns the string when provided only a whereString', () => {
    const string = 'Hi There'
    const clause = getWhereClause({ filterString: string })
    expect(clause.isRight()).toBeTruthy()
    expect(clause.value).toEqual(string)
  })

  it('returns a Right(WhereTree.empty) when provided no arguments', () => {
    expect(getWhereClause({}).isRight()).toBeTruthy()
    expect(getWhereClause({}).value).toBe(empty)
  })

  it('returns a Left(string) when provided an invalid tree', () => {
    const invalidTrees = getInvalidTrees()

    invalidTrees.map(t => {
      const clause = getWhereClause({ filter: t })
      if (clause.isRight()) console.log('FAIL: ', clause.value, JSON.stringify(t))

      expect(clause.isLeft()).toBeTruthy()
      expect(typeof clause.value === 'string').toBeTruthy()
    })
  })

  it('returns a Right(string | WhereTree) when provided a valid tree', () => {
    getValidTrees().map(([t, _]) => {
      const clause = getWhereClause({ filter: t })
      if (clause.isLeft()) console.log('FAIL:', clause, JSON.stringify(t))
      expect(clause.isRight()).toBe(true)
      expect(typeof clause.value === 'string'
        || clause.value instanceof Node
        || clause.value instanceof Leaf).toBe(true)
    })
  })
})

describe('convertToProperTree', () => {
  it('returns a Left(string) when provided an invalid tree', () => {
    getInvalidTrees().map(t => {
      const tree = convertToProperTree(t)
      if (tree.isRight()) console.log('FAIL: ', JSON.stringify(tree.value), JSON.stringify(t))
      expect(tree.isLeft()).toBeTruthy()
      expect(typeof tree.value === 'string').toBeTruthy()
    })
  })

  it('returns a Right(WhereTree) when provided a valid tree', () => {
    getValidTrees().map(([t, _]) => {
      const bitree = convertToProperTree(t)
      if (bitree.isLeft()) console.log('FAIL: ', bitree.value, JSON.stringify(t))
      expect(bitree.isRight()).toBeTruthy()
      expect(typeof bitree.value === 'object').toBeTruthy()
    })
  })

  it('gives the proper binary tree', () => {
    getValidTrees().map(([t, bt]) => {
      const bitree = convertToProperTree(t)
      expect(bitree.isRight()).toBeTruthy()
      expect(bitree.value).toEqual(bt)
    })
  })
})
