import { WhereTree, BooleanExpression, parseTree, BooleanOp, dateLiterals } from '../WhereTree'
import { Node, singleton } from '../../util/BinaryTree'

// tslint:disable:no-expression-statement
describe('parseTree', () => {
  it('parses a simple tree into a where clause', () => {
    const tree: WhereTree = singleton<BooleanExpression>({
      field: 'Id'
    , value: 1
    , op: '='
    })

    expect(parseTree(tree)).toEqual('( Id = 1 )')
  })

  it('parses a tree with branches into a where clause', () => {
    const leaf: WhereTree = singleton<BooleanExpression>({
      field: 'Id'
    , value: 1
    , op: '='
    })

    const tree: WhereTree = new Node<BooleanOp | BooleanExpression>('AND', leaf, leaf)

    expect(parseTree(tree)).toEqual('(( Id = 1 ) AND ( Id = 1 ))')
  })

  it('parses a tree with multiple branches into a where clause', () => {
    const stringLeaf: WhereTree = singleton<BooleanExpression>({
      field: 'Id'
    , value: 'SomeId'
    , op: '='
    })

    const date = new Date('1970-1-1')

    const dateLeaf: WhereTree = singleton<BooleanExpression>({
      field: 'LastModifiedDate'
    , value: date
    , op: '='
    })

    const boolLeaf: WhereTree = singleton<BooleanExpression>({
      field: 'IsDeleted'
    , value: true
    , op: '='
    })

    const nullLeaf: WhereTree = singleton<BooleanExpression>({
      field: 'Owner'
    , value: null
    , op: '='
    })

    const tree: WhereTree
      = new Node<BooleanOp | BooleanExpression>('AND'
        , new Node<BooleanOp | BooleanExpression>('OR'
          , stringLeaf
          , dateLeaf
          )
        , new Node<BooleanOp | BooleanExpression>('AND'
          , boolLeaf
          , nullLeaf
          )
        )

    // tslint:disable-next-line:max-line-length
    expect(parseTree(tree)).toEqual(`((( Id = 'SomeId' ) OR ( LastModifiedDate = ${date.toISOString()} )) AND (( IsDeleted = TRUE ) AND ( Owner = null )))`)
  })

  it('properly parses literals', () => {
    const literalBoolLeaf: WhereTree = singleton<BooleanExpression>({
      field: 'IsDeleted'
    , value: 'TRUE'
    , op: '='
    })

    const literalNullLeaf: WhereTree = singleton<BooleanExpression>({
      field: 'Owner'
    , value: 'null'
    , op: '='
    })

    const literalStringLeaf: WhereTree = singleton<BooleanExpression>({
      field: 'Id'
    , value: '\'SomeId\''
    , op: '='
    })

    const date = new Date('1970-1-1')

    const literalDateLeaf: WhereTree = singleton<BooleanExpression>({
      field: 'LastModifiedDate'
    , value: date.toISOString()
    , op: '='
    })

    const tree: WhereTree
      = new Node<BooleanOp | BooleanExpression>('AND'
        , new Node<BooleanOp | BooleanExpression>('OR'
          , literalStringLeaf
          , literalDateLeaf
          )
        , new Node<BooleanOp | BooleanExpression>('AND'
          , literalBoolLeaf
          , literalNullLeaf
          )
        )

    // tslint:disable-next-line:max-line-length
    expect(parseTree(tree)).toEqual(`((( Id = 'SomeId' ) OR ( LastModifiedDate = ${date.toISOString()} )) AND (( IsDeleted = TRUE ) AND ( Owner = null )))`)
  })

  it('properly parses all those date literals', () => {
    dateLiterals.forEach(dl => {
      const tree: WhereTree = singleton<BooleanExpression>({
        field: 'SomeDate'
      , value: dl
      , op: '='
      })

      expect(parseTree(tree)).toEqual(`( SomeDate = ${dl} )`)
    })

    const nDates = [
      'NEXT_N_YEARS'
    , 'LAST_N_YEARS'
    , 'NEXT_N_FISCAL_QUARTERS'
    , 'LAST_N_FISCAL_QUARTERS'
    , 'NEXT_N_FISCAL_YEARS'
    , 'LAST_N_FISCAL_YEARS'
    ]

    nDates.forEach(dl => {
      const tree: WhereTree = singleton<BooleanExpression>({
        field: 'SomeDate'
      , value: `${dl}:10`
      , op: '='
      })

      expect(parseTree(tree)).toEqual(`( SomeDate = ${dl}:10 )`)
    })
  })
})
