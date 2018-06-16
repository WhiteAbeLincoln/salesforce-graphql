import { GraphQLOutputType, GraphQLNonNull, GraphQLLeafType } from 'graphql'
import { Endomorphism } from 'fp-ts/lib/function'
import { FieldType } from 'jsforce'

// tslint:disable-next-line:variable-name
export const FieldKind = Symbol('fieldKind')
// tslint:disable-next-line:variable-name
export const ObjectKind = Symbol('objectKind')

export interface ParentField {
  [FieldKind]: 'parent'
  referenceTo: string[]
  description: string
}

export const parentField = (referenceTo: string[], description: string): ParentField => (
  { [FieldKind]: 'parent'
  , referenceTo
  , description
  }
)

export interface ChildField {
  [FieldKind]: 'child'
  referenceTo: string
  description: string
}

export const childField = (referenceTo: string, description: string): ChildField => (
  { [FieldKind]: 'child'
  , referenceTo
  , description
  }
)

export interface LeafField {
  [FieldKind]: 'leaf'
  type: GraphQLLeafType | GraphQLNonNull<GraphQLLeafType>
  sftype: FieldType
  filterable: boolean
  description: string
}

export const leafField = (type: GraphQLLeafType | GraphQLNonNull<GraphQLLeafType>,
                          sftype: FieldType,
                          filterable: boolean,
                          description: string): LeafField => (
  { [FieldKind]: 'leaf'
  , type
  , sftype
  , filterable
  , description
  }
)

export type ReferenceField = {
  [FieldKind]: 'reference'
  type: GraphQLOutputType | string
  description?: string
  /** An optional function to wrap the referenced field */
  wrapper?: Endomorphism<GraphQLOutputType>
}

export const referenceField = (type: GraphQLOutputType | string,
                               description?: string,
                               wrapper?: Endomorphism<GraphQLOutputType>): ReferenceField => (
  { [FieldKind]: 'reference'
  , type
  , description
  , wrapper
  }
)

export type SalesforceFieldConfig = ParentField | ChildField | LeafField
export type FieldConfig = SalesforceFieldConfig | ReferenceField

export interface SalesforceObjectConfig {
  [ObjectKind]: 'salesforce'
  name: string
  description: string
  fields: {
    [name: string]: SalesforceFieldConfig
  }
}

export const salesforceObjectConfig = (name: string,
                                       description: string,
                                       fields: SalesforceObjectConfig['fields']): SalesforceObjectConfig => (
  { [ObjectKind]: 'salesforce'
  , name
  , description
  , fields
  }
)

export interface IntermediateObjectConfig {
  [ObjectKind]: 'intermediate'
  name: string
  description: string
  fields: {
    [name: string]: ReferenceField
  }
}

export const intermediateObjectConfig = (name: string,
                                         description: string,
                                         fields: IntermediateObjectConfig['fields']): IntermediateObjectConfig => (
  { [ObjectKind]: 'intermediate'
  , name
  , description
  , fields
  }
)

export type ObjectConfig = SalesforceObjectConfig | IntermediateObjectConfig

export const isChildField = (field: FieldConfig): field is ChildField => field[FieldKind] === 'child'
export const isParentField = (field: FieldConfig): field is ParentField => field[FieldKind] === 'parent'
export const isLeafField = (field: FieldConfig): field is LeafField => field[FieldKind] === 'leaf'
export const isReferenceField = (field: FieldConfig): field is ReferenceField => field[FieldKind] === 'reference'
export const isSalesforceObject = (obj: ObjectConfig): obj is SalesforceObjectConfig => obj[ObjectKind] === 'salesforce'
