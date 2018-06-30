import { childField, leafField, salesforceObjectConfig } from '../../../types'
import { GraphQLString, GraphQLList } from 'graphql'
import { middleware } from '../Middleware'
import { buildGraphQLObjects } from '../../../buildSchema'
import { GraphQLUnsignedInt } from '../../../util/GraphQLScalars'

// tslint:disable:no-expression-statement

describe('middleware', () => {
  const kenobi = salesforceObjectConfig('GeneralKenobi', 'A Jedi', {
    says: leafField(GraphQLString, 'string', true, 'Hello There')
  })

  const rootQuery = salesforceObjectConfig('Query', 'Query', {
    [kenobi.name]: childField(kenobi.name, kenobi.description),
    NotAffected: {
      type: GraphQLString
    , description: 'GraphQLFieldConfig'
    }
  })

  const objects = buildGraphQLObjects([kenobi, rootQuery], middleware)

  const rootObject = objects[1].Query
  const kenobiObject = objects[1].GeneralKenobi
  const rootFields = rootObject.getFields()

  it('adds the standard arguments to child fields', () => {
    const kenobiField = rootFields.GeneralKenobi
    expect(kenobiField).toBeDefined()
    expect(kenobiField.args).toHaveLength(5)

    const filterArg = kenobiField.args.find(f => f.name === 'filter')!
    const filterStringArg = kenobiField.args.find(f => f.name === 'filterString')!
    const offsetArg = kenobiField.args.find(f => f.name === 'offset')!
    const limitArg = kenobiField.args.find(f => f.name === 'limit')!
    const orderByArg = kenobiField.args.find(f => f.name === 'orderBy')!
    const args = [filterArg, filterStringArg, offsetArg, limitArg, orderByArg]

    args.forEach(a => expect(a).toBeDefined())

    expect(filterArg.type.toString()).toMatch('Where_')
    expect(filterStringArg.type).toEqual(GraphQLString)
    expect(offsetArg.type).toEqual(GraphQLUnsignedInt)
    expect(limitArg.type).toEqual(GraphQLUnsignedInt)
    expect(orderByArg.type.toString()).toMatch('OrderBy_')
  })

  it('wraps child field types in a list', () => {
    const kenobiField = rootFields.GeneralKenobi
    expect(kenobiField).toBeDefined()
    expect(kenobiField.type).toEqual(new GraphQLList(kenobiObject))
  })

  it('doesn\'t effect other field types', () => {
    const notAffected = rootFields.NotAffected
    expect(notAffected).toBeDefined()
    expect(notAffected.type).toBe(GraphQLString)
    expect(notAffected.args).toHaveLength(0)
  })
})
