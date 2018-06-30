import { SOQLQuery, soql, parentQuery, childQuery, soqlQuery } from '../SOQL'
import { singleton } from '../../util/BinaryTree'
import { BooleanExpression } from '../WhereTree'

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
    const config
      = soqlQuery('Account'
        , [ parentQuery('MasterRecord', ['Name' , 'Id'])
          , parentQuery('Owner', ['Id'])
          ]
        )

    const result = soql(config)
    expect(result.value).toEqual('SELECT MasterRecord.Name, MasterRecord.Id, Owner.Id FROM Account')
  })

  it('gives the correct result for a query with fields, parent and child relationships', () => {
    const config
      = soqlQuery('Account'
        , [ 'Id'
          , parentQuery('MasterRecord', ['Name'])
          , childQuery('Users', ['Name', 'Id'])
          ]
        )

    const result = soql(config)
    expect(result.value).toEqual('SELECT Id, MasterRecord.Name, (SELECT Name, Id FROM Users) FROM Account')
  })

  it('gives the correct result for a query with fields, parent and child relationships, and filters', () => {
    const config
      = soqlQuery('Account'
        , [ 'Id'
          , parentQuery('MasterRecord', ['Name'])
          , childQuery('Users', ['Name', 'Id'])
          ]
        , { limit: 10
          , offset: 20
          }
        )

    const result = soql(config)
    expect(result.value)
      .toEqual('SELECT Id, MasterRecord.Name, (SELECT Name, Id FROM Users) FROM Account LIMIT 10 OFFSET 20')
  })

  it('gives the correct result for a query with where filter', () => {
    const config
      = soqlQuery('Account'
        , [ 'Id'
          , parentQuery('MasterRecord', ['Name'])
          ]
        , { where: singleton<BooleanExpression>({ field: 'Id', op: '=', value: 'SomeId' }) }
        )

    const result = soql(config)
    expect(result.value)
      .toEqual('SELECT Id, MasterRecord.Name FROM Account WHERE ( Id = \'SomeId\' )')
  })

  it('returns Left(string) for incorrect parent query (too deep)', () => {
    const config
      = soqlQuery('Account'
        , [ parentQuery('MasterRecord', [
              parentQuery('MasterRecord', [
                parentQuery('MasterRecord', [
                  parentQuery('MasterRecord', [
                    parentQuery('MasterRecord', [
                      parentQuery('MasterRecord', [
                        parentQuery('MasterRecord', [
                          parentQuery('MasterRecord', [
                            'Id'
                          ])
                        ])
                      ])
                    ])
                  ])
                ])
              ])
            ])
          ]
        , { limit: 10
          , offset: 20
          }
        )

    const result = soql(config)
    expect(result.isLeft()).toBeTruthy()
    expect(result.value).toMatch('more than 5 levels away from the root')
  })

  it('returns Left(string) for incorrect parent query (too many queries)', () => {
    const config
      = soqlQuery('Account'
        , [ parentQuery('MoreThan35', [
              '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
              '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
              '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
              '31', '32', '33', '34', '35', '36', '37', '38', '39', '40',
            ])
          ]
        , { limit: 10
          , offset: 20
          }
        )

    const result = soql(config)
    expect(result.isLeft()).toBeTruthy()
    expect(result.value).toMatch('No more than 35 child-to-parent')
  })
})
