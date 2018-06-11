import { GraphQLFieldResolver, GraphQLSchema, GraphQLObjectType, graphql, Kind } from 'graphql'
import { GraphQLUnsignedInt, isUnsignedInt } from '../../../util/GraphQLScalars/GraphQLUnsignedInt'

const noop = () => { /*empty*/ }

const createSchema = (queryResolver: GraphQLFieldResolver<any, any>,
                      mutationResolver: GraphQLFieldResolver<any, any> = noop) => {
  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query'
    , fields: {
        int: {
          type: GraphQLUnsignedInt
        , resolve: queryResolver
        }
      }
    })
  , mutation: new GraphQLObjectType({
      name: 'Mutation'
    , fields: {
        setInt: {
          type: GraphQLUnsignedInt
        , args: {
            int: {
              type: GraphQLUnsignedInt
            }
          }
        , resolve: mutationResolver
        }
      }
    })
  })
}

// tslint:disable:no-expression-statement
// tslint:disable:no-console

describe('GraphQLUnsignedInt', () => {
  it('fails to serialize when given an invalid number', () => {
    const values: Array<[number, string]>
      = [ [-10, 'Value is not a positive integer: -10']
        , [10.5, 'Value is not a positive integer: 10.5']
        ]

    return Promise.all(
      values.map(([value, error]) => {
        const schema = createSchema(() => value)
        const query = `{ int }`
        return graphql(schema, query).then(result => {
          const errors = result.errors
          if (!errors) console.log(result)
          expect(errors).toBeDefined()
          expect(errors![0].message).toEqual(error)
        })
      })
    )
  })

  it('fails to serialize when given an invalid non-number', () => {
    const value = 'hoi'
    const schema = createSchema(() => value)
    const query = `{ int }`
    return graphql(schema, query).then(result => {
      const errors = result.errors
      expect(errors).toBeDefined()
      expect(errors![0].message).toEqual(`Non-number value can't represent UnsignedInt: ${value}`)
    })
  })

  it('serializes unsigned integer value', () => {
    const value = 10
    const schema = createSchema(() => value)
    const query = `{ int }`
    return graphql(schema, query).then(result => {
      const data = result.data
      expect(data).toBeDefined()
      expect(data!.int).toEqual(value)
    })
  })

  it('fails to parse invalid number literal', () => {
    const values: Array<[number, string]>
      = [ [10.5, `UnsignedInt value must be an integer, got: ${Kind.FLOAT}`]
        , [-10, 'Expected UnsignedInt but got: -10']
        ]

    return Promise.all(values.map(([value, error]) => {
      const schema = createSchema(noop, (_, { int }) => int)
      const query = `
      mutation {
        setInt(int:${value})
      }
      `

      return graphql(schema, query).then(result => {
        const errors = result.errors
        expect(errors).toBeDefined()
        expect(errors![0].message).toMatch(error)
      })
    }))
  })

  it('fails to parse invalid non-number literal', () => {
    const value = 'hoi'
    const schema = createSchema(noop, (_, { int }) => int)
    const query = `
    mutation {
      setInt(int:"${value}")
    }
    `

    return graphql(schema, query).then(result => {
      const errors = result.errors
      expect(errors).toBeDefined()
      expect(errors![0].message).toMatch(`UnsignedInt value must be an integer, got: ${Kind.STRING}`)
    })
  })

  it('parses valid integer literal', () => {
    const value = 10
    const schema = createSchema(noop, (_, { int }) => {
      expect(isUnsignedInt(int)).toBeTruthy()
      expect(int).toEqual(value)
      return int
    })

    const query = `
    mutation {
      setInt(int:${value})
    }
    `

    return graphql(schema, query).then(result => {
      expect(result.errors).toBeUndefined()
    })
  })

  it('parses valid string variable value', () => {
    const value = 10
    const schema = createSchema(noop, (_, { int }) => {
      expect(isUnsignedInt(int)).toBeTruthy()
      expect(int).toEqual(value)
      return int
    })
    const query = `
    mutation setInt($int:UnsignedInt!) {
      setInt(int:$int)
    }
    `
    return graphql(schema, query, null, null, { int: value }).then(result => {
      expect(result.errors).toBeUndefined()
    })
  })
})
