import { salesforceObjectConfig, childField, leafField,
  BuildObjectsMiddleware, SalesforceObjectConfig, parentField } from '../../../types'
import { GraphQLString, GraphQLSchema, GraphQLFieldConfig, graphql, GraphQLInt } from 'graphql'
import { buildGraphQLObjects } from '../../../buildSchema'
import { middleware } from '../Middleware'
import { Endomorphism } from 'fp-ts/lib/function'
import { resolver } from '../../Offset'
import { mergeObjs } from '../../../util'
import { GraphQLDateTime } from 'graphql-iso-date'

const boilerplate = (objects: SalesforceObjectConfig[],
                     rootQuery: SalesforceObjectConfig,
                     res: (query: string) => Promise<any[] | null>,
                     gqlQuery: string) => {
  const objectMap = mergeObjs(...objects.map(o => ({ [o.name]: o })))

  const resolveFun = resolver(_ => res)

  const resolverMiddleware: Endomorphism<GraphQLFieldConfig<any, any>>
    = config => ({ ...config, resolve: resolveFun(rootQuery, objectMap) })

  const mdw: BuildObjectsMiddleware = (f, fs, p, o) => resolverMiddleware(middleware(f, fs, p, o))

  const gqlObjects = buildGraphQLObjects(objects, mdw)
  const query = gqlObjects[1][rootQuery.name]

  const schema = new GraphQLSchema({ query })

  return graphql(schema, gqlQuery).then(e => {
    if (e.errors) {
      throw e.errors[0]
    }

    return e.data
  })
}

// tslint:disable:no-expression-statement
describe('resolver', () => {
  it('gives the correct SOQL for a simple Root query', () => {
    expect.assertions(2)

    const kenobi = salesforceObjectConfig('GeneralKenobi', 'A Jedi', {
      says: leafField(GraphQLString, 'string', true, 'Hello There')
    })

    const rootQuery = salesforceObjectConfig('Query', 'Query', {
      [kenobi.name]: childField(kenobi.name, kenobi.description),
    })

    const test = (query: string) => {
      expect(query).toEqual('SELECT Id, says FROM GeneralKenobi')
      return Promise.resolve([{ says: 'Hello There' }])
    }

    const gqlQuery = `
      query {
        GeneralKenobi {
          says
        }
      }
    `

    return boilerplate([kenobi, rootQuery], rootQuery, test, gqlQuery)
      .then(v => expect(v).toEqual({
        GeneralKenobi: [{
          says: 'Hello There'
        }]
      }))
  })

  it('gives the correct SOQL for a Root-Parent query', () => {
    expect.assertions(2)

    const jedi = salesforceObjectConfig('Jedi', 'A Jedi', {
      says: leafField(GraphQLString, 'string', true, 'Hello There')
    , name: leafField(GraphQLString, 'string', true, 'This jedi\'s name')
    , Master: parentField(['Jedi'], 'This jedi\'s Master')
    })

    const rootQuery = salesforceObjectConfig('Query', 'Query', {
      [jedi.name]: childField(jedi.name, jedi.description),
    })

    const test = (query: string) => {
      expect(query).toEqual('SELECT Id, Master.Id, Master.name FROM Jedi')
      // salesforce should be able to resolve this immediately
      // as long as
      return Promise.resolve([{ Master: { name: 'Qui-gon Jinn' } }])
    }

    const gqlQuery = `
      query {
        Jedi {
          Master {
            name
          }
        }
      }
    `

    return boilerplate([jedi, rootQuery], rootQuery, test, gqlQuery)
      .then(v => expect(v).toEqual({
        Jedi: [{
          Master: {
            name: 'Qui-gon Jinn'
          }
        }]
      }))
  })

  it('gives the correct SOQL for a Root-Parent-Parent query', () => {
    expect.assertions(2)

    const jedi = salesforceObjectConfig('Jedi', 'A Jedi', {
      says: leafField(GraphQLString, 'string', true, 'Hello There')
    , name: leafField(GraphQLString, 'string', true, 'This jedi\'s name')
    , Master: parentField(['Jedi'], 'This jedi\'s Master')
    })

    const rootQuery = salesforceObjectConfig('Query', 'Query', {
      [jedi.name]: childField(jedi.name, jedi.description),
    })

    const test = (query: string) => {
      expect(query).toEqual('SELECT Id, Master.Id, Master.Master.Id, Master.Master.name FROM Jedi')
      // salesforce should be able to resolve this immediately
      return Promise.resolve([{ Master: { Master: { name: 'Qui-gon Jinn' } } }])
    }

    const gqlQuery = `
      query {
        Jedi {
          Master {
            Master {
              name
            }
          }
        }
      }
    `

    return boilerplate([jedi, rootQuery], rootQuery, test, gqlQuery)
      .then(v => expect(v).toEqual({
        Jedi: [{
          Master: {
            Master: {
              name: 'Qui-gon Jinn'
            }
          }
        }]
      }))
  })

  it('gives the correct SOQL for a Root-Parent-Child query', () => {
    expect.assertions(3)

    const jedi = salesforceObjectConfig('Jedi', 'A Jedi', {
      says: leafField(GraphQLString, 'string', true, 'Hello There')
    , name: leafField(GraphQLString, 'string', true, 'This jedi\'s name')
    , Master: parentField(['Jedi'], 'This jedi\'s Master')
    , Padawans: childField('Jedi', 'This jedi\'s trainees')
    })

    const rootQuery = salesforceObjectConfig('Query', 'Query', {
      [jedi.name]: childField(jedi.name, jedi.description),
    })

    const first = (query: string) => {
      expect(query).toEqual('SELECT Id, Master.Id FROM Jedi')

      return Promise.resolve([{ Id: 20, Master: { Id: 10 } }])
    }

    const second = (query: string) => {
      expect(query).toEqual('SELECT (SELECT Id, name FROM Padawans) FROM Jedi WHERE ( Id = 10 ) LIMIT 1')

      return Promise.resolve([{ Padawans: [{ name: 'Anakin', Id: 20 }], Id: 10 }])
    }

    // tslint:disable-next-line:no-let prefer-const
    let count = 1

    const test = (query: string) => {
      if (count === 1) {
        count++
        return first(query)
      }
      return second(query)
    }

    const gqlQuery = `
      query {
        Jedi {
          Master {
            Padawans {
              name
            }
          }
        }
      }
    `

    return boilerplate([jedi, rootQuery], rootQuery, test, gqlQuery)
      .then(v => expect(v).toEqual({
        Jedi: [{
          Master: {
            Padawans: [{
              name: 'Anakin'
            }]
          }
        }]
      }))
  })

  it('gives the correct SOQL for a Root-Child-Child query', () => {
    expect.assertions(3)

    const lightsaber = salesforceObjectConfig('Lightsaber', 'An elegant weapon... for a more civilized age', {
      color: leafField(GraphQLString, 'string', true, 'Bluuuueee')
    })

    const jedi = salesforceObjectConfig('Jedi', 'A Jedi', {
      says: leafField(GraphQLString, 'string', true, 'Hello There')
    , name: leafField(GraphQLString, 'string', true, 'This jedi\'s name')
    , Master: parentField(['Jedi'], 'This jedi\'s Master')
    , Padawans: childField('Jedi', 'This jedi\'s trainees')
    , Lightsabers: childField('Lightsaber', 'This jedi\'s lightsaber')
    })

    const rootQuery = salesforceObjectConfig('Query', 'Query', {
      [jedi.name]: childField(jedi.name, jedi.description),
    })

    const first = (query: string) => {
      expect(query).toEqual('SELECT Id, (SELECT Id FROM Padawans) FROM Jedi')

      return Promise.resolve([{ Id: 5, Padawans: [{ Id: 10 }] }])
    }

    const second = (query: string) => {
      // tslint:disable-next-line:max-line-length
      expect(query).toEqual('SELECT (SELECT Id, color FROM Lightsabers WHERE ( color = \'blue\' ) LIMIT 5 OFFSET 5) FROM Jedi WHERE ( Id = 10 ) LIMIT 1')

      return Promise.resolve([{ Id: 10, Lightsabers: [{ color: 'blue', Id: 20 }] }])
    }

    // tslint:disable-next-line:no-let prefer-const
    let count = 1

    const test = (query: string) => {
      if (count === 1) {
        count++
        return first(query)
      }
      return second(query)
    }

    const gqlQuery = `
      query {
        Jedi {
          Padawans {
            Lightsabers(filter:{leaf:{color:{eq:"blue"}}}, limit: 5, offset: 5) {
              color
            }
          }
        }
      }
    `

    return boilerplate([jedi, lightsaber, rootQuery], rootQuery, test, gqlQuery)
      .then(v => expect(v).toEqual({
        Jedi: [{
          Padawans: [{
            Lightsabers: [{
              color: 'blue'
            }]
          }]
        }]
      }))
  })

  it('gives the correct SOQL for a Root-Child-Parent query', () => {
    expect.assertions(2)

    const jedi = salesforceObjectConfig('Jedi', 'A Jedi', {
      says: leafField(GraphQLString, 'string', true, 'Hello There')
    , name: leafField(GraphQLString, 'string', true, 'This jedi\'s name')
    , Master: parentField(['Jedi'], 'This jedi\'s Master')
    , Padawans: childField('Jedi', 'This jedi\'s trainees')
    })

    const rootQuery = salesforceObjectConfig('Query', 'Query', {
      [jedi.name]: childField(jedi.name, jedi.description),
    })

    const test = (query: string) => {
      expect(query).toEqual('SELECT Id, (SELECT Id, Master.Id, Master.name FROM Padawans) FROM Jedi')

      return Promise.resolve([{ Id: 10, Padawans: [{ Id: 20, Master: { Id: 10, name: 'hi' } }] }])
    }

    const gqlQuery = `
      query {
        Jedi {
          Padawans {
            Master {
              name
            }
          }
        }
      }
    `

    return boilerplate([jedi, rootQuery], rootQuery, test, gqlQuery)
      .then(v => expect(v).toEqual({
        Jedi: [{
          Padawans: [{
            Master: {
              name: 'hi'
            }
          }]
        }]
      }))
  })

  it('handles that stupid date-time fix', () => {
    expect.assertions(2)

    const dateString = '2018-06-13T18:24:53.000+0000'

    const jedi = salesforceObjectConfig('Jedi', 'A Jedi', {
      says: leafField(GraphQLString, 'string', true, 'Hello There')
    , born: leafField(GraphQLDateTime, 'datetime', true, 'This jedi\'s name')
    , Master: parentField(['Jedi'], 'This jedi\'s Master')
    , Padawans: childField('Jedi', 'This jedi\'s trainees')
    })

    const rootQuery = salesforceObjectConfig('Query', 'Query', {
      [jedi.name]: childField(jedi.name, jedi.description),
    })

    const test = (query: string) => {
      expect(query).toEqual('SELECT Id, born FROM Jedi')

      return Promise.resolve([{ Id: 10, born: dateString }])
    }

    const gqlQuery = `
      query {
        Jedi {
          born
        }
      }
    `

    return expect(boilerplate([jedi, rootQuery], rootQuery, test, gqlQuery)).resolves.toEqual(
      { Jedi: [ { born: new Date(dateString).toISOString() } ] }
    )
  })

  it('gives the correct SOQL for a query with where filter tree', () => {
    expect.assertions(1)

    const jedi = salesforceObjectConfig('Jedi', 'A Jedi', {
      says: leafField(GraphQLString, 'string', true, 'Hello There')
    , name: leafField(GraphQLString, 'string', true, 'This jedi\'s name')
    , Master: parentField(['Jedi'], 'This jedi\'s Master')
    , Padawans: childField('Jedi', 'This jedi\'s trainees')
    })

    const rootQuery = salesforceObjectConfig('Query', 'Query', {
      [jedi.name]: childField(jedi.name, jedi.description),
    })

    const test = (query: string) => {
      expect(query).toEqual('SELECT Id, name FROM Jedi WHERE ( name = \'5\' )')

      return Promise.resolve([{ Id: 5, name: '5' }])
    }

    const gqlQuery = `
      query {
        Jedi(filter:{leaf:{name:{eq:"5"}}}) {
          name
        }
      }
    `

    return boilerplate([jedi, rootQuery], rootQuery, test, gqlQuery)
  })

  it('gives the correct SOQL for a query with where filter string', () => {
    expect.assertions(1)

    const jedi = salesforceObjectConfig('Jedi', 'A Jedi', {
      says: leafField(GraphQLString, 'string', true, 'Hello There')
    , name: leafField(GraphQLString, 'string', true, 'This jedi\'s name')
    , Master: parentField(['Jedi'], 'This jedi\'s Master')
    , Padawans: childField('Jedi', 'This jedi\'s trainees')
    })

    const rootQuery = salesforceObjectConfig('Query', 'Query', {
      [jedi.name]: childField(jedi.name, jedi.description),
    })

    const test = (query: string) => {
      expect(query).toEqual('SELECT Id, name FROM Jedi WHERE name = \'5\'')

      return Promise.resolve([{ Id: 5, name: '5' }])
    }

    const gqlQuery = `
      query {
        Jedi(filterString:"name = '5'") {
          name
        }
      }
    `

    return boilerplate([jedi, rootQuery], rootQuery, test, gqlQuery)
  })

  it('gives the correct SOQL for a deeply nested parent query', () => {
    // expect.assertions(1)

    const jedi = salesforceObjectConfig('Jedi', 'A Jedi', {
      says: leafField(GraphQLString, 'string', true, 'Hello There')
    , name: leafField(GraphQLString, 'string', true, 'This jedi\'s name')
    , Master: parentField(['Jedi'], 'This jedi\'s Master')
    , Padawans: childField('Jedi', 'This jedi\'s trainees')
    })

    const rootQuery = salesforceObjectConfig('Query', 'Query', {
      [jedi.name]: childField(jedi.name, jedi.description),
    })

    const tests: Array<(query: string) => Promise<any[]>>
      = [ (query: string) => {
            // tslint:disable-next-line:max-line-length
            expect(query).toEqual('SELECT Id, Master.Id, Master.Master.Id, Master.Master.Master.Id, Master.Master.Master.Master.Id FROM Jedi')

            return Promise.resolve([{
              Id: 1
            , Master: {
                Id: 2
              , Master: {
                  Id: 3
                , Master: {
                    Id: 4
                  , Master: {
                      Id: 5
                    }
                  }
                }
              }
            }])
          }
        , (query: string) => {
            // tslint:disable-next-line:max-line-length
            expect(query).toEqual('SELECT Id, Master.Id, Master.name, (SELECT Id, name FROM Padawans) FROM Jedi WHERE ( Id = 5 ) LIMIT 1')

            return Promise.resolve([
              { Id: 6, Master: { Id: 7, name: 'Super deep' }, Padawans: [{ Id: 12, name: 'Child' }] }
            ])
          }
        ]

    // tslint:disable-next-line:no-let prefer-const
    let count = 0

    const test = (query: string) => {
      // expect(query).toEqual('SELECT Id, name FROM Jedi WHERE name = \'5\'')
      const fun = tests[count]
      if (!fun) throw new Error('Not enough tests')
      const res = fun(query)
      count++

      return res
    }

    const gqlQuery = `
      query {
        Jedi {
          Master {
            Master {
              Master {
                Master {
                  Master {
                    Padawans {
                      name
                    }
                    Master {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    `

    return boilerplate([jedi, rootQuery], rootQuery, test, gqlQuery)
      .then(v =>
        expect(v).toEqual({
          Jedi: [{
            Master: {
              Master: {
                Master: {
                  Master: {
                    Master: {
                      Padawans: [{
                        name: 'Child'
                      }]
                    , Master: {
                        name: 'Super deep'
                      }
                    }
                  }
                }
              }
            }
          }]
        })
      )
  })

  it('gives the correct result for a Root-Child-Child query that doesn\'t return a value', () => {
    expect.assertions(3)

    const lightsaber = salesforceObjectConfig('Lightsaber', 'An elegant weapon... for a more civilized age', {
      color: leafField(GraphQLString, 'string', true, 'Bluuuueee')
    })

    const jedi = salesforceObjectConfig('Jedi', 'A Jedi', {
      says: leafField(GraphQLString, 'string', true, 'Hello There')
    , name: leafField(GraphQLString, 'string', true, 'This jedi\'s name')
    , Master: parentField(['Jedi'], 'This jedi\'s Master')
    , Padawans: childField('Jedi', 'This jedi\'s trainees')
    , Lightsabers: childField('Lightsaber', 'This jedi\'s lightsaber')
    })

    const rootQuery = salesforceObjectConfig('Query', 'Query', {
      [jedi.name]: childField(jedi.name, jedi.description),
    })

    const first = (query: string) => {
      expect(query).toEqual('SELECT Id, (SELECT Id FROM Padawans) FROM Jedi')

      return Promise.resolve([{ Id: 5, Padawans: [{ Id: 10 }] }])
    }

    const second = (query: string) => {
      // tslint:disable-next-line:max-line-length
      expect(query).toEqual('SELECT (SELECT Id, color FROM Lightsabers) FROM Jedi WHERE ( Id = 10 ) LIMIT 1')

      return Promise.resolve([{ Id: 10, Lightsabers: [] }])
    }

    // tslint:disable-next-line:no-let prefer-const
    let count = 1

    const test = (query: string) => {
      if (count === 1) {
        count++
        return first(query)
      }
      return second(query)
    }

    const gqlQuery = `
      query {
        Jedi {
          Padawans {
            Lightsabers {
              color
            }
          }
        }
      }
    `

    return boilerplate([jedi, lightsaber, rootQuery], rootQuery, test, gqlQuery)
      .then(v =>
        expect(v).toEqual({
          Jedi: [{ Padawans: [{ Lightsabers: [] }] }]
        })
      )
  })

  it('gives the correct SOQL for a simple query with polymorphic parent queries', () => {
    const jedi = salesforceObjectConfig('Jedi', 'A Jedi', {
      name: leafField(GraphQLString, 'string', true, 'This jedi\'s name')
    , Master: parentField(['Jedi', 'Sith'], 'This force user\'s Master')
    , Padawans: childField('Jedi', 'This jedi\'s trainees')
    })

    const sith = salesforceObjectConfig('Sith', 'A Sith', {
      name: leafField(GraphQLString, 'string', true, 'This jedi\'s name')
    , Master: parentField(['Jedi', 'Sith'], 'This force user\'s Master')
    , color: leafField(GraphQLString, 'string', true, 'The color')
    , Apprentice: parentField(['Sith'], 'This sith\'s apprentice')
    })

    const forceUser = salesforceObjectConfig('ForceUser', 'A Force User', {
      user: parentField(['Jedi', 'Sith'], 'A Force User')
    })

    const rootQuery = salesforceObjectConfig('Query', 'Query', {
      forceUsers: childField('ForceUser', 'Force Users')
    })

    const tests: Array<(query: string) => Promise<any[]>>
      = [ (query: string) => {
            expect(query).toBe('SELECT Id, user.Id, user.name FROM forceUsers WHERE ( user.Type = \'Jedi\' )')
            return Promise.resolve([{ Id: 1, user: { Id: 11, name: 'Obi-Wan Kenobi' } }])
          }
        , (query: string) => {
            // tslint:disable-next-line:max-line-length
            expect(query).toBe('SELECT Id, user.Id, user.name, user.color FROM forceUsers WHERE ( user.Type = \'Sith\' )')
            return Promise.resolve([{ Id: 2, user: { Id: 22, name: 'Darth Maul', color: 'red' } }])
          }
        ]

    // tslint:disable-next-line:no-let prefer-const
    let count = 0

    const test = (query: string) => {
      const fun = tests[count]
      if (!fun) throw new Error('Not enough tests')
      const res = fun(query)
      count++

      return res
    }

    const gqlQuery = `
      query {
        forceUsers {
          user {
            __typename
            ... on Jedi {
              name
            }
            ... on Sith {
              name
              color
            }
          }
        }
      }
    `

    return boilerplate([jedi, sith, forceUser, rootQuery], rootQuery, test, gqlQuery)
      .then(v => expect(v).toEqual({
        forceUsers: [
          { user: {__typename: 'Jedi', name: 'Obi-Wan Kenobi'} }
        , { user: {__typename: 'Sith', name: 'Darth Maul', color: 'red'} }
        ]
      }))
  })

  it('gives the correct SOQL for a simple query with multiple distinct polymorphic parent queries', () => {
    const jedi = salesforceObjectConfig('Jedi', 'A Jedi', {
      name: leafField(GraphQLString, 'string', true, 'This jedi\'s name')
    , Master: parentField(['Jedi', 'Sith'], 'This force user\'s Master')
    , Padawans: childField('Jedi', 'This jedi\'s trainees')
    })

    const sith = salesforceObjectConfig('Sith', 'A Sith', {
      name: leafField(GraphQLString, 'string', true, 'This jedi\'s name')
    , Master: parentField(['Jedi', 'Sith'], 'This force user\'s Master')
    , color: leafField(GraphQLString, 'string', true, 'The color')
    , Apprentice: parentField(['Sith'], 'This sith\'s apprentice')
    })

    const forceUser = salesforceObjectConfig('ForceUser', 'A Force User', {
      enemy: parentField(['Jedi', 'Sith'], 'A Force User')
    , friend: parentField(['Jedi', 'Sith'], 'A Force User')
    , Id: leafField(GraphQLInt, 'int', true, 'The Id')
    })

    const rootQuery = salesforceObjectConfig('Query', 'Query', {
      forceUsers: childField('ForceUser', 'Force Users')
    })

    const tests: Array<(query: string) => Promise<any[]>>
      = [ (query: string) => {
            // tslint:disable-next-line:max-line-length
            expect(query).toBe('SELECT Id, enemy.Id, enemy.name, enemy.color, friend.Id, friend.name FROM forceUsers WHERE (( enemy.Type = \'Sith\' ) AND ( friend.Type = \'Jedi\' ))')
            return Promise.resolve([{
              Id: 1
            , enemy: { Id: 11, name: 'Darth Maul', color: 'red' }
            , friend: { Id: 12, name: 'Obi-Wan Kenobi' }
            }])
          }
        , (query: string) => {
            // tslint:disable-next-line:max-line-length
            expect(query).toBe('SELECT Id, enemy.Id, enemy.name, friend.Id, friend.name FROM forceUsers WHERE (( enemy.Type = \'Jedi\' ) AND ( friend.Type = \'Jedi\' ))')
            return Promise.resolve([{
              Id: 2
            , enemy: { Id: 21, name: 'Samuel L. Jackson' }
            , friend: { Id: 22, name: 'Obi-Wan Kenobi' }
            }])
          }
        ]

    // tslint:disable-next-line:no-let prefer-const
    let count = 0

    const test = (query: string) => {
      const fun = tests[count]
      if (!fun) throw new Error('Not enough tests')
      const res = fun(query)
      count++

      return res
    }

    const gqlQuery = `
      query {
        forceUsers {
          Id
          enemy {
            __typename
            ... on Sith {
              name
              color
            }
            ... on Jedi {
              name
            }
          }
          friend {
            __typename
            ... on Jedi {
              name
            }
          }
        }
      }
    `

    return boilerplate([jedi, sith, forceUser, rootQuery], rootQuery, test, gqlQuery)
      .then(v => expect(v).toEqual({
        forceUsers: [
          { Id: 1, enemy: { name: 'Darth Maul', color: 'red', __typename: 'Sith' }
          , friend: { name: 'Obi-Wan Kenobi', __typename: 'Jedi' } }
        , { Id: 2, enemy: { name: 'Samuel L. Jackson', __typename: 'Jedi' }
          , friend: { name: 'Obi-Wan Kenobi', __typename: 'Jedi' } }
        ]
      }))
  })
})
