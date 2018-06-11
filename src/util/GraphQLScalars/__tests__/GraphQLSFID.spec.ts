import { GraphQLSchema, GraphQLObjectType, GraphQLFieldResolver, graphql, Kind } from 'graphql'
import { GraphQLSFID, isSFID } from '../../../util/GraphQLScalars/GraphQLSFID'

// tslint:disable:no-expression-statement

const noop = () => { /*empty*/ }

const createSchema = (queryResolver: GraphQLFieldResolver<any, any>,
                      mutationResolver: GraphQLFieldResolver<any, any> = noop) => {
  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query'
    , fields: {
        ID: {
          type: GraphQLSFID
        , resolve: queryResolver
        }
      }
    })
  , mutation: new GraphQLObjectType({
      name: 'Mutation'
    , fields: {
        setID: {
          type: GraphQLSFID
        , args: {
            ID: {
              type: GraphQLSFID
            }
          }
        , resolve: mutationResolver
        }
      }
    })
  })
}

describe('GraphQLSFID', () => {
  it('fails to serialize when given an invalid string', () => {
    const value = 'INVALID'
    const schema = createSchema(() => value)
    const query = `{ ID }`
    return graphql(schema, query).then(result => {
      const errors = result.errors
      expect(errors).toBeDefined()
      expect(errors![0].message).toEqual(`Value does not represent a SFID: ${value}`)
    })
  })

  it('fails to serialize when given an invalid non-string', () => {
    const value = 1234567890
    const schema = createSchema(() => value)
    const query = `{ ID }`
    return graphql(schema, query).then(result => {
      const errors = result.errors
      expect(errors).toBeDefined()
      expect(errors![0].message).toEqual(`Non-string value can't represent SFID: ${value}`)
    })
  })

  it('serializes string value', () => {
    const values = ['50130000000014C', '50130000000014CABC']
    return Promise.all(
      values.map(value => {
        const schema = createSchema(() => value)
        const query = `{ ID }`
        return graphql(schema, query).then(result => {
          const data = result.data
          expect(data).toBeDefined()
          expect(data!.ID).toEqual(value)
        })
      })
    )
  })

  it('fails to parse invalid string literal', () => {
    const value = 'invalid'
    const schema = createSchema(noop, (_, { ID }) => ID)
    const query = `
    mutation {
      setID(ID:"${value}")
    }
    `

    return graphql(schema, query).then(result => {
      const errors = result.errors
      expect(errors).toBeDefined()
      expect(errors![0].message).toMatch(`Expected SFID value but got: ${value}`)
    })
  })

  it('fails to parse invalid non-string literal', () => {
    const value = 1234567890
    const schema = createSchema(noop, (_, { ID }) => ID)
    const query = `
    mutation {
      setID(ID:${value})
    }
    `

    return graphql(schema, query).then(result => {
      const errors = result.errors
      expect(errors).toBeDefined()
      expect(errors![0].message).toMatch(`SFID value must be a string, got: ${Kind.INT}`)
    })
  })

  it('parses valid string literal', () => {
    const value = '50130000000014C'
    const schema = createSchema(noop, (_, { ID }) => {
      expect(isSFID(ID)).toBeTruthy()
      expect(ID).toEqual(value)
      return ID
    })
    const query = `
    mutation {
      setID(ID:"${value}")
    }
    `

    return graphql(schema, query).then(result => {
      expect(result.errors).toBeUndefined()
    })
  })

  it('parses valid string variable value', () => {
    const values = ['50130000000014C', '50130000000014CABC']
    return Promise.all(
      values.map(value => {
        const schema = createSchema(noop, (_, { ID }) => {
          expect(isSFID(ID)).toBeTruthy()
          expect(ID).toEqual(value)
          return ID
        })
        const query = `
        mutation setID($id:SFID!) {
          setID(ID:$id)
        }
        `
        return graphql(schema, query, null, null, { id: value }).then(result => {
          expect(result.errors).toBeUndefined()
        })
      })
    )
  })
})
