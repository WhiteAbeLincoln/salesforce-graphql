import { GraphQLFieldConfig, GraphQLObjectType } from 'graphql'
import { ObjectConfig, FieldConfig } from './ObjectConfig'

export type BuildObjectsMiddleware = (
   field: GraphQLFieldConfig<any, any> & Readonly<FieldConfig>,
   fields: Readonly<ObjectConfig['fields']>,
   parent: Readonly<ObjectConfig>,
   objectMap: { readonly [name: string]: GraphQLObjectType }
  ) => GraphQLFieldConfig<any, any>

export type BuildRootMiddleware = (
  obj: GraphQLObjectType
) => GraphQLFieldConfig<any, any> | null
