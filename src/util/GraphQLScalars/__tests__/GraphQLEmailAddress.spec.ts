import { GraphQLSchema, GraphQLObjectType, GraphQLFieldResolver, graphql, Kind } from 'graphql'
import { GraphQLEmailAddress, isEmail } from '../../../util/GraphQLScalars/GraphQLEmailAddress'

// tslint:disable:no-expression-statement
// tslint:disable:no-console

const validEmails
  = [ 'simple@example.com'
    , 'very.common@example.com'
    , 'disposable.style.email.with+symbol@example.com'
    , 'other.email-with-hyphen@example.com'
    , 'fully-qualified-domain@example.com'
    , 'user.name+tag+sorting@example.com'
    , 'x@example.com'
    , '"very.(),:;<>[]\\".VERY.\\"very@\\ \\"very\\".unusual"@strange.example.com'
    , 'example-indeed@strange-example.com'
    , 'admin@mailserver1'
    , '#!$%&\'*+-/=?^_`{}|~@example.org'
    , 'example@s.example'
    , 'user@localserver'
    , 'user@[192.168.0.10]'
    , 'user@[IPv6:2001:DB8::1]'
    , 'Pelé@example.com'
    , 'чебурашка@ящик-с-апельсинами.рф'
    , '二ノ宮@黒川.日本'
    , '我買@屋企.香港'
    ]

const invalidEmails
  = [ 'Abc.example.com'
    , 'A@b@c@example.com'
    , 'a"b(c)d,e:f;g<h>i[j\\k]l@example.com'
    , 'just"not"right@example.com'
    , 'this is"not\\allowed@example.com'
    , 'this\\ still\\"not\\\\allowed@example.com'
    , '1234567890123456789012345678901234567890123456789012345678901234+x@example.com'
    , 'john..doe@example.com'
    , 'john.doe@example..com'
    , '" "@example.org'
    ]

const noop = () => { /*empty*/ }

const createSchema = (queryResolver: GraphQLFieldResolver<any, any>,
                      mutationResolver: GraphQLFieldResolver<any, any> = noop) => {
  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query'
    , fields: {
        email: {
          type: GraphQLEmailAddress
        , resolve: queryResolver
        }
      }
    })
  , mutation: new GraphQLObjectType({
      name: 'Mutation'
    , fields: {
        setEmail: {
          type: GraphQLEmailAddress
        , args: {
            email: {
              type: GraphQLEmailAddress
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
    return Promise.all(
      invalidEmails.map(value => {
        const schema = createSchema(() => value)
        const query = `{ email }`
        return graphql(schema, query).then(result => {
          const errors = result.errors
          if (!errors) console.log('FAIL:', result)
          expect(errors).toBeDefined()
          expect(errors![0].message).toEqual(`Value does not represent an email: ${value}`)
        })
      })
    )
  })

  it('fails to serialize when given an invalid non-string', () => {
    const value = 1234567890
    const schema = createSchema(() => value)
    const query = `{ email }`
    return graphql(schema, query).then(result => {
      const errors = result.errors
      expect(errors).toBeDefined()
      expect(errors![0].message).toEqual(`Non-string value can't represent EmailAddress: ${value}`)
    })
  })

  it('serializes string value', () => {
    return Promise.all(
      validEmails.map(value => {
        const schema = createSchema(() => value)
        const query = `{ email }`
        return graphql(schema, query).then(result => {
          const data = result.data
          if (!data) console.log(result)
          expect(data).toBeDefined()
          expect(data!.email).toEqual(value)
        })
      })
    )
  })

  it('fails to parse invalid string literal', () => {
    return Promise.all(
      invalidEmails.map(value => {
        const schema = createSchema(noop, (_, { email }) => email)
        const query = `
        mutation {
          setEmail(email:"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")
        }
        `

        return graphql(schema, query).then(result => {
          const errors = result.errors
          expect(errors).toBeDefined()
          expect(errors![0].message).toMatch(`Expected email address value but got: ${value}`)
        })
      })
    )
  })

  it('fails to parse invalid non-string literal', () => {
    const value = 1234567890
    const schema = createSchema(noop, (_, { email }) => email)
    const query = `
    mutation {
      setEmail(email:${value})
    }
    `

    return graphql(schema, query).then(result => {
      const errors = result.errors
      expect(errors).toBeDefined()
      expect(errors![0].message).toMatch(`Email address value must be a string, got: ${Kind.INT}`)
    })
  })

  it('parses valid string literal', () => {
    return Promise.all(
      validEmails.map(value => {
        const schema = createSchema(noop, (_, { email }) => {
          expect(isEmail(email)).toBeTruthy()
          expect(email).toEqual(value)
          return email
        })

        const query = `
        mutation {
          setEmail(email:"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")
        }
        `

        return graphql(schema, query).then(result => {
          expect(result.errors).toBeUndefined()
        })
      })
    )
  })

  it('parses valid string variable value', () => {
    return Promise.all(
      validEmails.map(value => {
        const schema = createSchema(noop, (_, { email }) => {
          expect(isEmail(email)).toBeTruthy()
          expect(email).toEqual(value)
          return email
        })
        const query = `
        mutation setEmail($email:EmailAddress!) {
          setEmail(email:$email)
        }
        `
        return graphql(schema, query, null, null, { email: value }).then(result => {
          expect(result.errors).toBeUndefined()
        })
      })
    )
  })
})
