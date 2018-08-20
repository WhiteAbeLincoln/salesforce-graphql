import { DescribeSObjectResult } from 'jsforce'
import { salesforceObjectConfig, childField, BuildObjectsMiddleware,
  ResolverMiddleware, isChildField, isParentField, isLeafField, FieldConfig } from '../../types'
import { middleware as offsetMiddleware } from './Middleware'
import { makeObjects, buildGraphQLObjects } from '../../buildSchema'
import { mergeObjs } from '../../util'
import { Endomorphism, identity } from 'fp-ts/lib/function'
import { GraphQLFieldConfig, GraphQLFieldConfigMap } from 'graphql'

export const buildQuery = (resolver: ResolverMiddleware,
                           rootFields: GraphQLFieldConfigMap<any, any> | null = {},
                           middleware: Endomorphism<GraphQLFieldConfig<any, any>> = identity
                          ) => (descs: DescribeSObjectResult[]) => {
  const sfObjects = makeObjects(descs)

  const rootQuery = salesforceObjectConfig(
    'SalesforceQuery'
  , 'Query Salesforce'
  , mergeObjs<FieldConfig>(rootFields || {}, ...sfObjects.map(c => ({ [c.name]: childField(c.name, c.description) })))
  )

  const sfObjectMap = mergeObjs(...[...sfObjects, rootQuery].map(o => ({ [o.name]: o })))

  const resolverMiddleware: Endomorphism<GraphQLFieldConfig<any, any>> = config => {
    if (isChildField(config) || isParentField(config) || isLeafField(config)) {
      // only add the resolvers to non-user added fields
      return { ...config , resolve: resolver(rootQuery, sfObjectMap) }
    }

    return config
  }

  const finalMiddleware: BuildObjectsMiddleware = (field, fields, parent, objectMap) =>
    middleware(resolverMiddleware(offsetMiddleware(field, fields, parent, objectMap)))

  const gqlObjects = buildGraphQLObjects([...sfObjects, rootQuery], finalMiddleware)

  const queryObject = gqlObjects[1].SalesforceQuery

  return queryObject
}
