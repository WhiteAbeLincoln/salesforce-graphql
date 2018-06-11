import { GraphQLSchema, GraphQLObjectType, GraphQLFieldResolver, graphql } from 'graphql'
import { GraphQLURL, isURL } from '../../../util/GraphQLScalars/GraphQLURL'

// tslint:disable:no-expression-statement

const noop = () => { /*empty*/ }

const createSchema = (queryResolver: GraphQLFieldResolver<any, any>,
                      mutationResolver: GraphQLFieldResolver<any, any> = noop) => {
  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query'
    , fields: {
        url: {
          type: GraphQLURL
        , resolve: queryResolver
        }
      }
    })
  , mutation: new GraphQLObjectType({
      name: 'Mutation'
    , fields: {
        setUrl: {
          type: GraphQLURL
        , args: {
            url: {
              type: GraphQLURL
            }
          }
        , resolve: mutationResolver
        }
      }
    })
  })
}

describe('GraphQLURL', () => {
  it('fails to serialize when given an invalid string', () => {
    const value = 'INVALID'
    const schema = createSchema(() => value)
    const query = `{ url }`
    return graphql(schema, query).then(result => {
      const errors = result.errors
      expect(errors).toBeDefined()
      expect(errors![0].message).toEqual(`Value does not represent a URL: ${value}`)
    })
  })

  it('fails to serialize when given an invalid non-string', () => {
    const value = 1234567890
    const schema = createSchema(() => value)
    const query = `{ url }`
    return graphql(schema, query).then(result => {
      const errors = result.errors
      expect(errors).toBeDefined()
      expect(errors![0].message).toEqual(`Non-string value can't represent URL: ${value}`)
    })
  })

  it('serializes string value', () => {
    const value = 'http://example.com/blah_blah_(blahBLAH)'
    const schema = createSchema(() => value)
    const query = `{ url }`
    return graphql(schema, query).then(result => {
      const data = result.data
      expect(data).toBeDefined()
      expect(data!.url).toEqual(value)
    })
  })

  it('fails to parse invalid string literal', () => {
    const value = 'invalid'
    const schema = createSchema(noop, (_, { url }) => url)
    const query = `
    mutation {
      setUrl(url:"${value}")
    }
    `

    return graphql(schema, query).then(result => {
      const errors = result.errors
      expect(errors).toBeDefined()
      expect(errors![0].message).toMatch(`Expected URL value but got: ${value}`)
    })
  })

  it('fails to parse invalid non-string literal', () => {
    const value = 1234567890
    const schema = createSchema(noop, (_, { url }) => url)
    const query = `
    mutation {
      setUrl(url:${value})
    }
    `

    return graphql(schema, query).then(result => {
      const errors = result.errors
      expect(errors).toBeDefined()
      expect(errors![0].message).toMatch(`URL value must be a string`)
    })
  })

  it('parses valid string literal', () => {
    const value = 'http://example.com/blah_blah_BLAH_(BLAH)'
    const schema = createSchema(noop, (_, { url }) => {
      expect(isURL(url)).toBeTruthy()
      expect(url).toEqual(value)
      return url
    })
    const query = `
    mutation {
      setUrl(url:"${value}")
    }
    `

    return graphql(schema, query).then(result => {
      expect(result.errors).toBeUndefined()
    })
  })

  it('parses valid string variable value', () => {
    const value = 'http://example.com/blah_blah_BLAH_(BLAH)'
    const schema = createSchema(noop, (_, { url }) => {
      expect(isURL(url)).toBeTruthy()
      expect(url).toEqual(value)
      return url
    })
    const query = `
    mutation setUrl($url:URL!) {
      setUrl(url:$url)
    }
    `
    return graphql(schema, query, null, null, { url: value }).then(result => {
      expect(result.errors).toBeUndefined()
    })
  })
})
