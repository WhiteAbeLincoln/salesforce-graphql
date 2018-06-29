import { FieldSet, ConcreteFieldSet, AbstractFieldSet,
  AbstractFieldSetCondition, ConcreteFieldSetCondition, FieldSetCondition } from '../GraphQLUtils'
import { FieldConfig, ObjectConfig } from '../../types'
import { GraphQLCompositeType, getNamedType, isAbstractType } from 'graphql'

export interface AnnotatedConcreteFieldSet extends ConcreteFieldSet {
  parentObj?: ObjectConfig
  configField?: FieldConfig
  children?: AnnotatedFieldSet[]
}

export interface AnnotatedAbstractFieldSet extends AbstractFieldSet {
  parentObj?: ObjectConfig
  configField?: FieldConfig
  children: AnnotatedFieldSet[]
}

export interface AnnotatedAbstractFieldSetCondition extends AbstractFieldSetCondition {
  fields: AnnotatedFieldSetCondition[]
}

export interface AnnotatedConcreteFieldSetCondition extends ConcreteFieldSetCondition {
  fields: AnnotatedFieldSet[]
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
  const sfobject = objectMap[rootName]
  const currField = fieldSet.fieldName
  const currSFField = sfobject.fields[currField]

  switch (fieldSet.kind) {
    case 'concrete': {
      const namedType = getNamedType(fieldSet.type) as GraphQLCompositeType
      const children = fieldSet.children && fieldSet.children.map(
        c => annotateFieldSet(namedType, c, objectMap)
      )

      const ret: AnnotatedConcreteFieldSet
        = { ...fieldSet
          , configField: currSFField
          , parentObj: sfobject
          , children
          }

      return ret
    }

    case 'abstract': {
      // TODO: figure out how to handle abstract fieldSets
      const namedType = getNamedType(fieldSet.type) as GraphQLCompositeType
      const children: AnnotatedFieldSet[] = fieldSet.children.map(
        // don't touch synthetic typename, which is synthetic
        c => c.fieldName !== '__typename' ? annotateFieldSet(namedType, c, objectMap) : c
      )

      const possibleSets = fieldSet.possibleSets.map(
        p => annotateFieldSetCondition(p, objectMap)
      )

      const ret: AnnotatedAbstractFieldSet
        = { ...fieldSet
          , configField: currSFField
          , parentObj: sfobject
          , children
          , possibleSets
          }

      return ret
    }
  }
}

const annotateFieldSetCondition = (cond: Readonly<FieldSetCondition>,
                                   objectMap: { readonly [name: string]: Readonly<ObjectConfig> }
                                  ): AnnotatedFieldSetCondition => {
  const type = cond.type
  if (isAbstractType(type)) {
    const fields = (cond.fields as FieldSetCondition[]).map(f => annotateFieldSetCondition(f, objectMap))
    const ret: AnnotatedAbstractFieldSetCondition = { type, fields }
    return ret
  } else {
    const fields = (cond.fields as FieldSet[]).map(f => annotateFieldSet(type, f, objectMap))
    const ret: AnnotatedConcreteFieldSetCondition = { type, fields }
    return ret
  }
}
