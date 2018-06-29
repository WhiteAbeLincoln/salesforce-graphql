import { GraphQLFieldConfig, GraphQLObjectType, GraphQLFieldResolver } from 'graphql'
import { ObjectConfig, FieldConfig, SalesforceObjectConfig } from './ObjectConfig'

export type BuildObjectsMiddleware = (
   field: GraphQLFieldConfig<any, any> & Readonly<FieldConfig>,
   fields: Readonly<ObjectConfig['fields']>,
   parent: Readonly<ObjectConfig>,
   objectMap: { readonly [name: string]: GraphQLObjectType }
  ) => GraphQLFieldConfig<any, any>

export type ResolverMiddleware =
  (rootQuery: SalesforceObjectConfig,
   objectMap: { [x: string]: SalesforceObjectConfig }) => GraphQLFieldResolver<any, any>
