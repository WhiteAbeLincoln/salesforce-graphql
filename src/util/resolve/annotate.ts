import { FieldSet, ConcreteFieldSet, AbstractFieldSet,
  AbstractFieldSetCondition, ConcreteFieldSetCondition, FieldSetCondition } from '../GraphQLUtils'
import { FieldConfig, ObjectConfig } from '../../types'
import { GraphQLCompositeType, getNamedType } from 'graphql'

export interface AnnotatedConcreteFieldSet extends ConcreteFieldSet {
  annotated: true
  parentConfigObj: ObjectConfig
  configField: FieldConfig
  children?: AnnotatedFieldSet[]
}

export interface AnnotatedAbstractFieldSet extends AbstractFieldSet {
  annotated: true
  parentConfigObj: ObjectConfig
  configField: FieldConfig
  possibleSets: AnnotatedFieldSetCondition[]
  children: Array<AnnotatedFieldSet | FieldSet>
}

export interface AnnotatedAbstractFieldSetCondition extends AbstractFieldSetCondition {
  fields: AnnotatedFieldSetCondition[]
}

export interface AnnotatedConcreteFieldSetCondition extends ConcreteFieldSetCondition {
  fields: Array<AnnotatedFieldSet | FieldSet>
  typeConfig: ObjectConfig
}

export type AnnotatedFieldSetCondition = AnnotatedAbstractFieldSetCondition | AnnotatedConcreteFieldSetCondition

export type AnnotatedFieldSet = AnnotatedConcreteFieldSet | AnnotatedAbstractFieldSet

export const annotateFieldSet = (root: GraphQLCompositeType,
                                 fieldSet: Readonly<FieldSet>,
                                 objectMap: { readonly [name: string]: Readonly<ObjectConfig> }
                                ): AnnotatedFieldSet => {
  /* Typing algorithm:
    1. find the parent object in our sf-object map (from our fieldSet) and assign to /sfobject/
    2. find the current field in the sfobject
    3. use the current field in the sfobject to determine whether this is a child or parent rel
  */
  const rootName = root.name
  const parentConfigObj = objectMap[rootName] as Readonly<ObjectConfig> | undefined
  const currField = fieldSet.fieldName
  const configField = parentConfigObj && parentConfigObj.fields[currField]

  switch (fieldSet.kind) {
    case 'concrete': {
      const namedType = getNamedType(fieldSet.type) as GraphQLCompositeType
      const children = fieldSet.children && fieldSet.children.map(
        c => annotateFieldSet(namedType, c, objectMap)
      )

      const ret: AnnotatedConcreteFieldSet
        = { ...fieldSet
          , configField
          , parentConfigObj
          , children
          , annotated: true
          }

      return ret
    }

    case 'abstract': {
      // TODO: figure out how to handle abstract fieldSets
      const namedType = getNamedType(fieldSet.type) as GraphQLCompositeType
      const children: Array<AnnotatedFieldSet | FieldSet> = fieldSet.children.map(
        // don't touch synthetic typename, which is synthetic
        c => c.fieldName !== '__typename' ? annotateFieldSet(namedType, c, objectMap) : c
      )

      const possibleSets = fieldSet.possibleSets.map(
        p => annotateFieldSetCondition(p, objectMap)
      )

      const ret: AnnotatedAbstractFieldSet
        = { ...fieldSet
          , configField
          , parentConfigObj
          , children
          , possibleSets
          , annotated: true
          }

      return ret
    }
  }
}

export const isAnnotatedFieldSet = (f: FieldSet): f is AnnotatedFieldSet => !!(f as AnnotatedFieldSet).annotated

const annotateFieldSetCondition = (cond: Readonly<FieldSetCondition>,
                                   objectMap: { readonly [name: string]: Readonly<ObjectConfig> }
                                  ): AnnotatedFieldSetCondition => {
  if (cond.kind === 'abstractCondition') {
    const type = cond.type
    const fields = cond.fields.map(f => annotateFieldSetCondition(f, objectMap))
    const ret: AnnotatedAbstractFieldSetCondition = {
      kind: cond.kind
    , type
    , fields
    }
    return ret
  } else {
    const type = cond.type
    const fields: Array<AnnotatedFieldSet | FieldSet>
      = cond.fields.map(f => f.fieldName !== '__typename' ? annotateFieldSet(type, f, objectMap) : f)
    const typeConfig = objectMap[type.name]
    const ret: AnnotatedConcreteFieldSetCondition = {
      kind: cond.kind
    , type
    , fields
    , typeConfig
    }
    return ret
  }
}
