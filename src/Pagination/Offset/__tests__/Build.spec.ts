import Account from '../../../__tests__/describes/Account.desc.json'
import { DescribeSObjectResult } from 'jsforce'
import { ResolverMiddleware } from '../../../types'
import { buildQuery } from '../../Offset'
import {
  GraphQLObjectType,
  GraphQLFieldConfigMap,
  GraphQLString,
  GraphQLList,
  GraphQLFieldConfig,
} from 'graphql'
import { Endomorphism } from 'fp-ts/lib/function'

// tslint:disable:no-expression-statement

describe('buildQuery', () => {
  const descs: DescribeSObjectResult[] = [Account as any]
  // don't resolve anything since we aren't testing this
  const resolver: ResolverMiddleware = () => () => null

  it('returns a root query object', () => {
    const result = buildQuery(resolver)(descs)
    expect(result).toBeInstanceOf(GraphQLObjectType)
    expect(result.name).toBe('SalesforceQuery')
  })

  it('creates a root field for every SObject', () => {
    const result = buildQuery(resolver)(descs)
    const fields = result.getFields()
    expect(Object.keys(fields)).toHaveLength(1)
    expect(fields.Account).toBeDefined()
    expect(fields.Account.name).toBe('Account')
    expect(fields.Account.type).toBeInstanceOf(GraphQLList)
  })

  it('adds the additional root fields to the root query object unchanged', () => {
    const additionalFields: GraphQLFieldConfigMap<any, any> = {
      name: {
        type: GraphQLString,
        description: 'Some additional root field',
      },
    }

    const result = buildQuery(resolver, additionalFields)(descs)
    const fields = result.getFields()
    expect(fields.name).toMatchObject(additionalFields.name)
  })

  it('runs the middleware over a field after running field through the resolver and offset middleware', () => {
    const middleware: Endomorphism<GraphQLFieldConfig<any, any>> = config => {
      expect(config.resolve).toBeDefined()
      return config
    }

    buildQuery(resolver, null, middleware)(descs)
  })
})
