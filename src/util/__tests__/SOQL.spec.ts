import { SOQLQuery, soql, ParentQuery } from '../SOQL'

// tslint:disable:no-expression-statement typedef

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

    // tslint:disable-next-line:no-console
    // console.log(soql(config))
    const result = soql(config)
    expect(result.value).toEqual('SELECT Id, Name, Blah FROM Account')
  })

  it('gives the correct result for a query with parent relationships', () => {
    const config: SOQLQuery = {
      object: 'Account'
    , selections: [
        { kind: 'parent'
        , rootLabel: 'MasterRecord'
        , subForest: [
            { kind: 'parent'
            , rootLabel: 'Name'
            , subForest: [] as ParentQuery[]
            }
          , { kind: 'parent'
            , rootLabel: 'Id'
            , subForest: [] as ParentQuery[]
            }
          ]
        }
      , { kind: 'parent'
        , rootLabel: 'Owner'
        , subForest: [
            { kind: 'parent'
            , rootLabel: 'Id'
            , subForest: [] as ParentQuery[]
            }
          ]
        }
      ]
    }

    // tslint:disable-next-line:no-console
    // console.log(soql(config))
    const result = soql(config)
    expect(result.value).toEqual('SELECT MasterRecord.Name, MasterRecord.Id, Owner.Id FROM Account')
  })

  it('gives the correct result for a query with fields, parent and child relationships', () => {
    const config: SOQLQuery = {
      object: 'Account'
    , selections: [
        'Id'
      , { kind: 'parent'
        , rootLabel: 'MasterRecord'
        , subForest: [
            { kind: 'parent'
            , rootLabel: 'Name'
            , subForest: [] as ParentQuery[]
            }
          ]
        }
      , { kind: 'child'
        , object: 'Users'
        , selections: [
            'Name'
          , 'Id'
          ]
        }
      ]
    }

    // tslint:disable-next-line:no-console
    // console.log(soql(config))
    const result = soql(config)
    expect(result.value).toEqual('SELECT MasterRecord.Name, (SELECT Name, Id FROM Users), Id FROM Account')
  })
})
