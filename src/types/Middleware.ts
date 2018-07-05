import { GraphQLFieldConfig, GraphQLObjectType, GraphQLResolveInfo } from 'graphql'
import { ObjectConfig, FieldConfig, SalesforceObjectConfig } from './ObjectConfig'

export type BuildObjectsMiddleware = (
   field: GraphQLFieldConfig<any, any> & Readonly<FieldConfig>,
   fields: Readonly<ObjectConfig['fields']>,
   parent: Readonly<ObjectConfig>,
   objectMap: { readonly [name: string]: GraphQLObjectType }
  ) => GraphQLFieldConfig<any, any>

export type ResolverMiddleware =
  (rootQuery: SalesforceObjectConfig,
   objectMap: { [x: string]: SalesforceObjectConfig }) =>
   (source: any, context: any, args: { [argName: string]: any }, info: GraphQLResolveInfo) =>
   | { __typename: string } | Array<{ __typename: string }>
   | Promise<{ __typename: string } | Array<{ __typename: string }>>
