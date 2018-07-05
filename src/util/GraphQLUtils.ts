import { GraphQLObjectType, FieldNode, GraphQLResolveInfo,
  SelectionSetNode, getNamedType, GraphQLOutputType, GraphQLAbstractType,
  FragmentSpreadNode, InlineFragmentNode, Kind, GraphQLSkipDirective,
  GraphQLIncludeDirective, typeFromAST, GraphQLNonNull,
  GraphQLList, GraphQLCompositeType, GraphQLScalarType, isLeafType,
  GraphQLEnumType, isAbstractType, FragmentDefinitionNode,
  SelectionNode} from 'graphql'
import { Option, none, some } from 'fp-ts/lib/Option'
import { getFieldDef, collectFields } from 'graphql/execution/execute'
import { catOptions } from 'fp-ts/lib/Array'
import { getArgumentValues, getDirectiveValues } from 'graphql/execution/values'
import { mapObj } from './util'
import { not } from 'fp-ts/lib/function'
import mem from 'mem'

export type FieldSet = ConcreteFieldSet | AbstractFieldSet

export interface ConcreteFieldSet {
  kind: 'concrete'
  /** alias or fieldName */
  name: string
  /** actual field name */
  fieldName: string
  children?: FieldSet[]
  args: Record<string, any>
  type: Exclude<GraphQLOutputType, GraphQLAbstractType | GraphQLNonNull<any>>
    | GraphQLList<any> // typescript mistakenly removes GraphQLList (GraphQLNonNull<any> matches somehow)
    | GraphQLNonNull<Exclude<GraphQLOutputType, GraphQLAbstractType | GraphQLNonNull<any>>>
}

export interface AbstractFieldSet {
  kind: 'abstract'
  name: string
  fieldName: string
  args: Record<string, any>
  type: GraphQLAbstractType | GraphQLList<any> | GraphQLNonNull<GraphQLAbstractType | GraphQLList<any>>
  possibleSets: FieldSetCondition[]
  children: FieldSet[]
}

export interface AbstractFieldSetCondition {
  kind: 'abstractCondition'
  type: GraphQLAbstractType
  fields: FieldSetCondition[]
}

export interface ConcreteFieldSetCondition {
  kind: 'concreteCondition'
  type: GraphQLObjectType
  fields: FieldSet[]
}

export type FieldSetCondition = AbstractFieldSetCondition | ConcreteFieldSetCondition

/**
 * Determines if a field should be included based on the @include and @skip
 * directives, where @skip has higher precidence than @include.
 */
function shouldIncludeNode(
  exeContext: GraphQLResolveInfo,
  node: FragmentSpreadNode | FieldNode | InlineFragmentNode,
): boolean {
  const skip = getDirectiveValues(
    GraphQLSkipDirective,
    node,
    exeContext.variableValues,
  )
  if (skip && skip.if === true) {
    return false
  }

  const include = getDirectiveValues(
    GraphQLIncludeDirective,
    node,
    exeContext.variableValues,
  )
  if (include && include.if === false) {
    return false
  }
  return true
}

const collectFragmentFields = (info: GraphQLResolveInfo,
                               fragmentSets: { [name: string]: () => Option<FieldSetCondition> },
                               selectionSet: SelectionSetNode): FieldSetCondition[] => {
  const fragmentSelections
    = selectionSet
        .selections
        .filter((s): s is InlineFragmentNode | FragmentSpreadNode =>
          s.kind === Kind.FRAGMENT_SPREAD || s.kind === Kind.INLINE_FRAGMENT)

  const conditions
    = fragmentSelections
        .map(selection => {
          if (!shouldIncludeNode(info, selection)) return none

          switch (selection.kind) {
            case Kind.INLINE_FRAGMENT:
              return collectConditionedFragment(info, fragmentSets, selection)
            case Kind.FRAGMENT_SPREAD: {
              const fragName = selection.name.value
              const frag = fragmentSets[fragName]()
              // the graphql collect function has a similar check though this should never happen
              /* istanbul ignore if */
              if (!frag) return none

              return frag
            }
          }
        })

  return catOptions(conditions)
}

const collectConditionedFragment = (info: GraphQLResolveInfo,
                                    fragmentSets: { [name: string]: () => Option<FieldSetCondition> },
                                    selection: InlineFragmentNode | FragmentDefinitionNode) => {

  // we always have a type condition when this function is called because we use collectFields
  // in the case that there is no condition (see isSharedSelection)
  const typeConditionNode = selection.typeCondition!

  // type condition must be a GraphQLCompositeType
  // see http://facebook.github.io/graphql/October2016/#sec-Type-Conditions
  const conditionalType = typeFromAST(info.schema, typeConditionNode) as GraphQLCompositeType
  // if conditionalType was abstract, we get FieldSetCondition[], otherwise FieldSet[]
  const conditionalFields = resolveFields(info, fragmentSets, conditionalType, selection.selectionSet)

  const condition: FieldSetCondition
    = { kind: conditionalType instanceof GraphQLObjectType ? 'concreteCondition' : 'abstractCondition'
      , type: conditionalType
      , fields: conditionalFields // if conditionalType is abstract then conditionalFields has type FieldSet[]
      } as FieldSetCondition
    // { x: string } | { x: number } should equal { x: string | number }
    // that is for some cases a union of two records A, B should be
    // assignable to a record where every field x has type A[x] | B[x]

  return some(condition)
}

const resolveConcreteFields = (info: GraphQLResolveInfo,
                               fragmentSets: { [name: string]: () => Option<FieldSetCondition> },
                               parentType: GraphQLObjectType,
                               selectionSet: SelectionSetNode): FieldSet[] => {
  const fields = Object.values(collectFields(
    info as any // info is built from an ExecutionContext, so it is a subtype of ExecutionContext
  , parentType
  , selectionSet
  , Object.create(null)
  , Object.create(null)
  ))

  return fields.map(f => resolveObject(info, fragmentSets, parentType, f))
}

function resolveFields(info: GraphQLResolveInfo,
                       fragmentSets: { [name: string]: () => Option<FieldSetCondition> },
                       parentType: GraphQLObjectType,
                       selectionSet: SelectionSetNode): FieldSet[]
function resolveFields(info: GraphQLResolveInfo,
                       fragmentSets: { [name: string]: () => Option<FieldSetCondition> },
                       parentType: GraphQLAbstractType,
                       selectionSet: SelectionSetNode): FieldSetCondition[]
function resolveFields(info: GraphQLResolveInfo,
                       fragmentSets: { [name: string]: () => Option<FieldSetCondition> },
                       parentType: GraphQLCompositeType,
                       selectionSet: SelectionSetNode): FieldSet[] | FieldSetCondition[]
function resolveFields(info: GraphQLResolveInfo,
                       fragmentSets: { [name: string]: () => Option<FieldSetCondition> },
                       parentType: GraphQLCompositeType,
                       selectionSet: SelectionSetNode): FieldSet[] | FieldSetCondition[] {
  if (isAbstractType(parentType)) {
    return collectFragmentFields(info, fragmentSets, selectionSet)
  } else {
    return resolveConcreteFields(info, fragmentSets, parentType, selectionSet)
  }
}

const isSharedSelection = (info: GraphQLResolveInfo,
                           parentType: GraphQLAbstractType) =>
                          (f: SelectionNode) => {
  if (f.kind === Kind.FIELD) return true
  if (f.kind === Kind.INLINE_FRAGMENT) {
    if (!f.typeCondition) return true
    const conditionalType = typeFromAST(info.schema, f.typeCondition)
    if (conditionalType === parentType) return true
  }
  if (f.kind === Kind.FRAGMENT_SPREAD) {
    const fragName = f.name.value
    const frag = info.fragments[fragName]
    // graphql would have thrown if the user tried using a fragment def that didn't exist
    // if (!frag) return false
    const conditionalType = typeFromAST(info.schema, frag.typeCondition)
    if (conditionalType === parentType) return true
  }
  return false
}

const resolveInterfaceChildren = (info: GraphQLResolveInfo,
                                  fragmentSets: { [name: string]: () => Option<FieldSetCondition> },
                                  parentType: GraphQLAbstractType,
                                  selectionSet: SelectionSetNode): FieldSet[] => {

  /* the only selections that can be direct children of an interface are:
  1. inline fragments without a TypeCondition
  2. fragments (inline or defined) where the TypeCondition is the interface itself
  3. FieldNodes
  */
  const sharedSelections
    = selectionSet.selections
        .filter(isSharedSelection(info, parentType))

  // FIXME: this still feels hacky, since we are depending on the internal behavior of GraphQL to remain the same
  // the function signature may stay the same while the internal behavior changes...
  return resolveConcreteFields(
    info,
    fragmentSets,
    parentType as any,
    { ...selectionSet, selections: sharedSelections }
  )
}

const resolveObject = (info: GraphQLResolveInfo,
                       fragmentSets: { [name: string]: () => Option<FieldSetCondition> },
                       parentType: GraphQLObjectType,
                       fieldNodes: ReadonlyArray<FieldNode>): FieldSet => {
  // Field node array appears to always have only one element
  // https://github.com/graphql/graphql-js/blob/54f631ff3238affdddb4dc736fc282b620d70b15/src/execution/execute.js#L685
  const fieldNode = fieldNodes[0]
  const fieldName = fieldNode.name.value
  const alias = fieldNode.alias && fieldNode.alias.value
  // getFieldDef says it only takes a GraphQLObjectType, but it uses it only for parentType.getFields()[fieldName]
  // which is possible with GraphQLInterfaceType
  // FIXME: Don't rely on internal library behavior - we don't know when it could change
  const fieldDef = getFieldDef(info.schema, parentType, fieldName)!
  // if (!fieldDef) return none

  const fieldType = fieldDef.type
  const args = getArgumentValues(fieldDef, fieldNode, info.variableValues)

  // input objects can't be the result fieldNodes
  const namedType = getNamedType(fieldType) as Exclude<GraphQLOutputType, GraphQLList<any> | GraphQLNonNull<any>>

  if (isLeafType(namedType)) {
    // field is a scalar
    const fieldSet: ConcreteFieldSet
      = { kind: 'concrete'
        , fieldName
        , name: alias || fieldName
        // we can't reduce fieldType by reducing namedType, since typescript doesn't know they're related
        // we don't have recursive types in typescript, so I can't properly represent the possible types for GraphQLList
        , type: fieldType as GraphQLScalarType
          | GraphQLEnumType | GraphQLList<any>
          | GraphQLNonNull<GraphQLScalarType | GraphQLEnumType | GraphQLList<any>>
        , args
        }

    return fieldSet
  }

  if (isAbstractType(namedType)) {
    const children = resolveInterfaceChildren(info, fragmentSets, namedType, fieldNode.selectionSet!)

    const notShared = fieldNode.selectionSet!.selections.filter(not(isSharedSelection(info, namedType)))

    const possibleSets
      = resolveFields(
          info,
          fragmentSets,
          namedType,
          { ...fieldNode.selectionSet!, selections: notShared }
        )

    const fieldSet: AbstractFieldSet
      = { kind: 'abstract'
        , fieldName
        , name: alias || fieldName
        , args
        , type: fieldType as AbstractFieldSet['type']
        , possibleSets
        , children
        }
    return fieldSet
  }

  const children = resolveConcreteFields(info, fragmentSets, namedType, fieldNode.selectionSet!)

  const fieldSet: ConcreteFieldSet
    = { kind: 'concrete'
      , fieldName
      , name: alias || fieldName
      , children
      , type: fieldType as GraphQLObjectType | GraphQLList<any> | GraphQLNonNull<GraphQLObjectType | GraphQLList<any>>
      , args
      }

  return fieldSet
}

export const getFieldSet = (info: GraphQLResolveInfo): FieldSet => {
  // we can build the FieldSets for named fragments without any extra info
  // we map each key in the info.fragments object to a function which resolves to a FieldSetCondition
  // this deferred execution (through the function) lets us transform fragments that reference each other
  const fragmentDefinitionSets: { [x: string]: () => Option<FieldSetCondition> } =
    mapObj(def => mem(() => collectConditionedFragment(info, fragmentDefinitionSets, def)), info.fragments)

  // when we call from a resolver, info.parentType will always be concrete
  // (graphql has resolved types by this point)
  return resolveObject(info, fragmentDefinitionSets, info.parentType, info.fieldNodes)
}
