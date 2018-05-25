import { getWhereClause, convertToProperTree, BiWhereLeaf, inorderTraversal, WhereNode, BooleanOp } from '../../Where'
import { BiTree, BiTreeNode, BiTreeLeaf } from '../../util/BinaryTree'

// tslint:disable:no-expression-statement
// tslint:disable:no-console
const getInvalidTrees = () => {
  const notEnoughForest1: WhereNode = {
    node: { AND: [ { } ] }
  }

  const notEnoughForest2: WhereNode = {
    node: { OR: [ { } ] }
  }

  const bothLeafAndNode: WhereNode =  { node: { AND: [] }
                                      , leaf: { a: { gt: 'b' } } }

  const omitLeafAndNode: WhereNode = {}
  const missingField: WhereNode = { leaf: {} }
  const missingBoolOperator: WhereNode = { node: {} }
  const missingCompOperator: WhereNode = { leaf: { a: { } } }

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
  const numberValue: [WhereNode, BiTree<BooleanOp, BiWhereLeaf>]
    = [ { leaf: { a: { eq: 1 } } }
      , BiTreeLeaf<BiWhereLeaf>({ field: 'a', op: '=', value: `1` })
      ]

  const dateValue: [WhereNode, BiTree<BooleanOp, BiWhereLeaf>]
    = [ { leaf: { a: { eq: now } } }
      , BiTreeLeaf<BiWhereLeaf>({ field: 'a', op: '=', value: now.toISOString() })
      ]

  const stringValue: [WhereNode, BiTree<BooleanOp, BiWhereLeaf>]
    = [ { leaf: { a: { eq: `'b'` } } }
      , BiTreeLeaf<BiWhereLeaf>({ field: 'a', op: '=', value: `'b'` })
      ]

  const booleanValue: [WhereNode, BiTree<BooleanOp, BiWhereLeaf>]
    = [ { node: { OR: [
          { leaf: { a: { eq: true } } }
        , { leaf: { b: { eq: false } } }
        ] } }
      , BiTreeNode('OR'
        , BiTreeLeaf<BiWhereLeaf>({ field: 'a', op: '=', value: `TRUE` })
        , BiTreeLeaf<BiWhereLeaf>({ field: 'b', op: '=', value: `FALSE` })
        )
      ]

  const includesCheck: [WhereNode, BiTree<BooleanOp, BiWhereLeaf>]
    = [ { leaf: { a: { includes: [ 'a', 'b' ] } } }
      , BiTreeLeaf<BiWhereLeaf>({ field: 'a', op: 'INCLUDES', value: `( 'a', 'b' )` })
      ]

  const multipleOperators: [WhereNode, BiTree<BooleanOp, BiWhereLeaf>]
    = [ { leaf: { a: { gt: 1, lt: 3 } } }
      , BiTreeNode('AND'
        , BiTreeLeaf<BiWhereLeaf>({ field: 'a', op: '>', value: '1' })
        , BiTreeLeaf<BiWhereLeaf>({ field: 'a', op: '<', value: '3' })
        )
      ]

  const multipleFields: [WhereNode, BiTree<BooleanOp, BiWhereLeaf>]
    = [ { leaf: { a: { gt: 1 }, b: { lt: 2 } } }
      , BiTreeNode('AND'
        , BiTreeLeaf<BiWhereLeaf>({ field: 'a', op: '>', value: '1' })
        , BiTreeLeaf<BiWhereLeaf>({ field: 'b', op: '<', value: '2' })
        )
      ]

  const notTree: [WhereNode, BiTree<BooleanOp, BiWhereLeaf>]
      = [ { node: { NOT: { leaf: { a: { eq: true } } } } }
        , BiTreeNode('NOT'
          , BiTreeLeaf<BiWhereLeaf>({ field: 'a', op: '=', value: `TRUE` })
          )
        ]

  const tree3: [WhereNode, BiTree<BooleanOp, BiWhereLeaf>]
    = [ { node: { AND: [
            { leaf: { a: { eq: 'b' } } }
          , { leaf: { c: { gt: 'd' } } }
          , { node: { OR: [
              { leaf: { e: { lt: 'f' } } }
            , { leaf: { g: { like: 'h' } } }
            ] } }
          ] }
        }
      , BiTreeNode('AND'
        , BiTreeNode('AND' as BooleanOp
          , BiTreeLeaf<BiWhereLeaf>({ field: 'a', op: '=', value: `'b'` })
          , BiTreeLeaf<BiWhereLeaf>({ field: 'c', op: '>', value: `'d'` })
          )
        , BiTreeNode('OR'
          , BiTreeLeaf<BiWhereLeaf>({ field: 'e', op: '<', value: `'f'` })
          , BiTreeLeaf<BiWhereLeaf>({ field: 'g', op: 'LIKE', value: `'h'` })
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

  it('returns a Right(\'\') when provided no arguments', () => {
    expect(getWhereClause({}).isRight()).toBeTruthy()
    expect(getWhereClause({}).value).toBe('')
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

  it('returns a Right(string) when provided a valid tree', () => {
    const validTrees = getValidTrees().map(tp => tp[0])

    validTrees.map(t => {
      const clause = getWhereClause({ filter: t })
      if (clause.isLeft()) console.log('FAIL:', clause.value, JSON.stringify(t))

      expect(clause.isRight()).toBeTruthy()
      expect(typeof clause.value === 'string').toBeTruthy()
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

  it('returns a Right(WTree) when provided a valid tree', () => {
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
      expect(inorderTraversal(bitree.value as any)).toEqual(inorderTraversal(bt))
    })
  })
})
