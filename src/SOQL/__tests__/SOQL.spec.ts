import { SOQLQuery, soql, parentQuery, childQuery, soqlQuery, ParentQuery, ChildQuery } from '../SOQL'
import { singleton } from '../../util/BinaryTree'
import { BooleanExpression } from '../WhereTree'
import { sequence } from 'fp-ts/lib/Traversable'
import { either, Either } from 'fp-ts/lib/Either'
import { array } from 'fp-ts/lib/Array'

// tslint:disable:no-expression-statement

describe('soql', () => {
  it('gives the correct result for a query with fields', () => {
    const config: SOQLQuery = {
      object: 'Account'
    , selections: [
        'Id'
      , 'Name'
      , 'Blah'
      ]
    }

    const result = soql(config)
    expect(result.value).toEqual('SELECT Id, Name, Blah FROM Account')
  })

  it('gives the correct result for a query with parent relationships', () => {
    const parents = [ parentQuery('MasterRecord', ['Name' , 'Id']), parentQuery('Owner', ['Id']) ]
    const result = sequence(either, array)(parents)
        .chain(ps => soqlQuery('Account', ps))
        .chain(soql)
    expect(result.value).toEqual('SELECT MasterRecord.Name, MasterRecord.Id, Owner.Id FROM Account')
  })

  it('gives the correct result for a query with fields, parent and child relationships', () => {
    const sub: Array<Either<string, ParentQuery | ChildQuery>>
      = [ parentQuery('MasterRecord', ['Name']), childQuery('Users', ['Name', 'Id']) ]

    const result = sequence(either, array)(sub)
      .chain(subs => soqlQuery('Account', [ 'Id', ...subs ]))
      .chain(soql)

    expect(result.value).toEqual('SELECT Id, MasterRecord.Name, (SELECT Name, Id FROM Users) FROM Account')
  })

  it('gives the correct result for a query with fields, parent and child relationships, and filters', () => {
    const result
      = parentQuery('MasterRecord', ['Name'])
        .chain(p =>
          childQuery('Users', ['Name', 'Id'])
            .chain(c =>
              soqlQuery('Account'
              , [ 'Id'
                , p
                , c
                ]
              , { limit: 10
                , offset: 20
                }
              )
            )
        ).chain(soql)

    expect(result.value)
      .toEqual('SELECT Id, MasterRecord.Name, (SELECT Name, Id FROM Users) FROM Account LIMIT 10 OFFSET 20')
  })

  it('gives the correct result for a query with where filter', () => {
    const result
      = parentQuery('MasterRecord', ['Name'])
          .chain(p =>
            soqlQuery('Account'
              , [ 'Id'
                , p
                ]
              , { where: singleton<BooleanExpression>({ field: 'Id', op: '=', value: 'SomeId' }) }
              )
            )
          .chain(soql)

    expect(result.value)
      .toEqual('SELECT Id, MasterRecord.Name FROM Account WHERE ( Id = \'SomeId\' )')
  })

  it('returns Left(string) for incorrect parent query (too many queries)', () => {
    const result
      = parentQuery('MoreThan35', [
          '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
          '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
          '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
          '31', '32', '33', '34', '35', '36', '37', '38', '39', '40',
        ]).chain(p => soqlQuery('Account', [ p ], { limit: 10, offset: 20 }))
          .chain(soql)

    expect(result.isLeft()).toBeTruthy()
    expect(result.value).toMatch('No more than 35 child-to-parent')
  })

  it('returns Left(string) for incorrect query (too many child queries)', () => {
    const cs
      = [ childQuery('Child', ['1'])
        , childQuery('Child', ['2'])
        , childQuery('Child', ['3'])
        , childQuery('Child', ['4'])
        , childQuery('Child', ['5'])
        , childQuery('Child', ['6'])
        , childQuery('Child', ['7'])
        , childQuery('Child', ['8'])
        , childQuery('Child', ['9'])
        , childQuery('Child', ['10'])
        , childQuery('Child', ['11'])
        , childQuery('Child', ['12'])
        , childQuery('Child', ['13'])
        , childQuery('Child', ['14'])
        , childQuery('Child', ['15'])
        , childQuery('Child', ['16'])
        , childQuery('Child', ['17'])
        , childQuery('Child', ['18'])
        , childQuery('Child', ['19'])
        , childQuery('Child', ['20'])
        , childQuery('Child', ['21'])
        ]

    const result = sequence(either, array)(cs)
        .chain(cs => soqlQuery('Account', [ 'Id', ...cs ]))
        .chain(soql)

    expect(result.isLeft()).toBe(true)
    expect(result.value).toMatch('No more than 20 parent-to-child')
  })

  it('returns Left(string) for incorrect query (child has offset without limit 1)', () => {
    const result =
      childQuery('Child', ['Id'], { offset: 10 })
        .chain(c => soqlQuery('Account', [ c ]))
        .chain(soql)

    expect(result.isLeft()).toBe(true)
    expect(result.value).toMatch('A subquery can use OFFSET only')
  })

  it('returns Left(string) for incorrect query (no selections)', () => {
    const result = soqlQuery('Account', [])
    expect(result.isLeft()).toBe(true)
    expect(result.value).toMatch('Must select at least one')
  })

  it('gives the correct result for a query with all the filters', () => {
    const result
      = parentQuery('MasterRecord', ['Name'])
        .chain(p =>
          soqlQuery('Account'
          , [ 'Id'
            , p
            ]
          , { where: 'Id = \'SomeId\''
            , scope: 'Delegated'
            , orderBy: { fields: ['Id'], dir: 'ASC', nulls: 'LAST' }
            , limit: 5
            , offset: 10
            , for: ['REFERENCE', 'UPDATE']
            , update: ['TRACKING', 'VIEWSTAT']
            }
          )
        ).chain(soql)

    expect(result.value)
      .toEqual(
          'SELECT Id, MasterRecord.Name FROM Account '
        + 'USING SCOPE Delegated '
        + 'WHERE Id = \'SomeId\' '
        + 'ORDER BY Id ASC NULLS LAST '
        + 'LIMIT 5 '
        + 'OFFSET 10 '
        + 'FOR REFERENCE, UPDATE '
        + 'UPDATE TRACKING, VIEWSTAT'
      )

    const result2
      = parentQuery('MasterRecord', ['Name'])
        .chain(p =>
          soqlQuery('Account'
          , [ 'Id'
            , p
            ]
          , { orderBy: { fields: ['Id'], dir: 'ASC' } }
          )
        ).chain(soql)

    expect(result2.value)
      .toEqual(
          'SELECT Id, MasterRecord.Name FROM Account '
        + 'ORDER BY Id ASC'
      )
  })
})

describe('parentQuery', () => {
  it('returns Left(string) for incorrect parent query (too deep)', () => {
    const nest = (p: ParentQuery) => parentQuery('MasterRecord', [ p ])

    const result
      = parentQuery('MasterRecord', [
          'Id'
        ]).chain(nest)
          .chain(nest)
          .chain(nest)
          .chain(nest)

    expect(result.isLeft()).toBe(true)
    expect(result.value).toMatch('more than 5 levels away from the root')
  })

  it('returns Left(string) for incorrect parent query (no selections)', () => {
    const result = parentQuery('MasterRecord', [])

    expect(result.isLeft()).toBe(true)
    expect(result.value).toMatch('must have a non-empty selection')
  })
})
