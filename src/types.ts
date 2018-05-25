import { GraphQLLeafType, GraphQLNonNull } from 'graphql'
import { FieldType } from 'jsforce'

export type ParentField = {
  kind: 'parent'
  referenceTo: string[]
  description: string
}

export type ChildField = {
  kind: 'child'
  referenceTo: string
  description: string
}

export type LeafField = {
  kind: 'leaf'
  type: GraphQLLeafType | GraphQLNonNull<GraphQLLeafType>
  sftype: FieldType
  filterable: boolean
  description: string
}

export type Field = ParentField | ChildField | LeafField
export type IntermediateObject = {
  name: string
  description: string
  fields: {
    [name: string]: Field
  }
}

export type ExcludeKey<T, U> = {
  [P in Exclude<keyof T, U>]: T[P]
}

export type AdditionalInfo =
  | ExcludeKey<LeafField, 'type'>
  | ExcludeKey<ParentField, 'type'>
  | ExcludeKey<ChildField, 'type'>

export const isChildField = (field: Field): field is ChildField => field.kind === 'child'
export const isParentField = (field: Field): field is ParentField => field.kind === 'parent'
export const isLeafField = (field: Field): field is LeafField => field.kind === 'leaf'
