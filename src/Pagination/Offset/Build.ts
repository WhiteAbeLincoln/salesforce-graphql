import { DescribeSObjectResult } from 'jsforce'
import { salesforceObjectConfig, childField, BuildObjectsMiddleware, ResolverMiddleware } from '../../types'
import { middleware as offsetMiddleware } from './Offset'
import { makeObjects, buildGraphQLObjects } from '../../buildSchema'
import { mergeObjs } from '../../util'
import { Endomorphism, identity } from 'fp-ts/lib/function'
import { GraphQLFieldConfig } from 'graphql'

export const buildSchema = (resolver: ResolverMiddleware,
                            middleware: Endomorphism<GraphQLFieldConfig<any, any>> = identity) =>
(descs: DescribeSObjectResult[]) => {
  const objects = makeObjects(descs)

  const rootQuery = salesforceObjectConfig(
    'SalesforceQuery'
  , 'Query Salesforce'
  , mergeObjs(...objects.map(c => ({ [c.name]: childField(c.name, c.description) })))
  )

  const objectMap = mergeObjs(...[...objects, rootQuery].map(o => ({ [o.name]: o })))

  const resolverMiddleware: Endomorphism<GraphQLFieldConfig<any, any>> = config => ({
    ...config
  , resolve: resolver(rootQuery, objectMap)
  })

  const finalMiddleware: BuildObjectsMiddleware = (field, fields, parent, objectMap) =>
    middleware(resolverMiddleware(offsetMiddleware(field, fields, parent, objectMap)))

  const gqlObjects = buildGraphQLObjects([...objects, rootQuery], finalMiddleware)

  const queryObject = gqlObjects[1].SalesforceQuery

  return queryObject
}
