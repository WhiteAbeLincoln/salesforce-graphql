import { salesforceObjectConfig, childField, leafField,
  BuildObjectsMiddleware, SalesforceObjectConfig, parentField } from '../../../types'
import { GraphQLString, GraphQLSchema, GraphQLFieldConfig, graphql } from 'graphql'
import { buildGraphQLObjects } from '../../../buildSchema'
import { middleware } from '../Middleware'
import { Endomorphism } from 'fp-ts/lib/function'
import { resolver } from '../Resolve'
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
    expect.assertions(1)

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
  })

  it('gives the correct SOQL for a Root-Parent query', () => {
    expect.assertions(1)

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
  })

  it('gives the correct SOQL for a Root-Parent-Parent query', () => {
    expect.assertions(1)

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
  })

  it('gives the correct SOQL for a Root-Parent-Child query', () => {
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

    const first = (query: string) => {
      expect(query).toEqual('SELECT Id, Master.Id FROM Jedi')

      return Promise.resolve([{ Id: 20, Master: { Id: 10 } }])
    }

    const second = (query: string) => {
      expect(query).toEqual('SELECT (SELECT Id, name FROM Padawans) FROM Jedi WHERE ( Id = 10 )')

      return Promise.resolve([{ Jedi: [{ name: 'Qui-gon Jinn', Id: 10 }] }])
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
  })

  it('gives the correct SOQL for a Root-Child-Child query', () => {
    expect.assertions(2)

    const lightsaber = salesforceObjectConfig('Lightsaber', 'A tool from a more elegant age', {
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
      expect(query).toEqual('SELECT (SELECT Id, color FROM Lightsabers) FROM Jedi WHERE ( Id = 10 )')

      return Promise.resolve([{ Jedi: [{ Id: 10, Lightsabers: [{ color: 'blue', Id: 20 }] }] }])
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
  })

  it('gives the correct SOQL for a Root-Child-Parent query', () => {
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
})
