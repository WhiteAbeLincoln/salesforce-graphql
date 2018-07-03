import { GraphQLNonNull, GraphQLLeafType, GraphQLFieldConfig } from 'graphql'
import { FieldType } from 'jsforce'

export const FIELD_KIND = Symbol('fieldKind')
export const OBJECT_KIND = Symbol('objectKind')

export interface ParentField {
  [FIELD_KIND]: 'parent'
  referenceTo: string[]
  description: string
}

export const parentField = (referenceTo: string[], description: string): ParentField => (
  { [FIELD_KIND]: 'parent'
  , referenceTo
  , description
  }
)

export interface ChildField {
  [FIELD_KIND]: 'child'
  referenceTo: string
  description: string
}

export const childField = (referenceTo: string, description: string): ChildField => (
  { [FIELD_KIND]: 'child'
  , referenceTo
  , description
  }
)

export interface LeafField {
  [FIELD_KIND]: 'leaf'
  type: GraphQLLeafType | GraphQLNonNull<GraphQLLeafType>
  sftype: FieldType
  filterable: boolean
  description: string
}

export const leafField = (type: GraphQLLeafType | GraphQLNonNull<GraphQLLeafType>,
                          sftype: FieldType,
                          filterable: boolean,
                          description: string): LeafField => (
  { [FIELD_KIND]: 'leaf'
  , type
  , sftype
  , filterable
  , description
  }
)

export type SalesforceFieldConfig = ParentField | ChildField | LeafField
export type FieldConfig = SalesforceFieldConfig | GraphQLFieldConfig<any, any>

export interface SalesforceObjectConfig {
  [OBJECT_KIND]: 'salesforce'
  name: string
  description: string
  fields: {
    [name: string]: FieldConfig
  }
}

export const salesforceObjectConfig = (name: string,
                                       description: string,
                                       fields: SalesforceObjectConfig['fields']): SalesforceObjectConfig => (
  { [OBJECT_KIND]: 'salesforce'
  , name
  , description
  , fields
  }
)

export type ObjectConfig = SalesforceObjectConfig

export const isGraphQLFieldConfig =
  (field: FieldConfig | GraphQLFieldConfig<any, any>): field is GraphQLFieldConfig<any, any> =>
    !isChildField(field) && !isLeafField(field) && !isParentField(field)

export const isChildField = <T extends object>(field: T): field is ChildField & T =>
  (field as any)[FIELD_KIND] === 'child'
export const isParentField = <T extends object>(field: T): field is ParentField & T =>
  (field as any)[FIELD_KIND] === 'parent'
export const isLeafField = <T extends object>(field: T): field is LeafField & T =>
  (field as any)[FIELD_KIND] === 'leaf'
