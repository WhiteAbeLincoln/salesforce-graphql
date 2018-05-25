import { GraphQLInputObjectType, GraphQLList, GraphQLString,
  GraphQLInt, GraphQLFloat, GraphQLBoolean,
  GraphQLInputFieldConfigMap, GraphQLInputType, GraphQLScalarType, } from 'graphql'
import mem from 'mem'
import { mergeObjs } from '../util'
import { FieldType } from 'jsforce'
import { GraphQLDate, GraphQLDateTime, GraphQLTime } from 'graphql-iso-date'
import { GraphQLEmailAddress, GraphQLURL, GraphQLSFID } from '../util/GraphQLScalars'

export type BooleanOp = 'AND' | 'OR' | 'NOT'
export type ArrayComparisonStringOp = 'includes' | 'excludes'
export type ScalarComparisonStringOp =
  | 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'neq'
  | 'like' | 'in' | 'not_in'

export type ComparisonStringOp = ScalarComparisonStringOp | ArrayComparisonStringOp

const operatorDescription = {
  gt: 'Greater Than'
, lt: 'Less Than'
, gte: 'Greater Than or Equal To'
, lte: 'Less Than or Equal To'
, eq: 'Equal To'
, neq: 'Not Equal To'
, like: 'Similar To'
, in: 'Contained In'
, not_in: 'Not Contained In'
, includes: 'Contains String'
, excludes: 'Does Not Contain String'
}

const getOperator = (type: GraphQLInputType, op: ComparisonStringOp) => (
  {
    [op]: { type, description: operatorDescription[op] }
  }
)

export interface WhereNode {
  node?: {
    OR?: WhereNode[]
    AND?: WhereNode[]
    NOT?: WhereNode
  }
  leaf?: WhereLeaf
}

// Boolean is defined as type boolean = true | false
// this gets distributed too, so I was getting true[] | false[] not boolean[]
export type DistributeArray<T> = T extends any ? T extends boolean ? boolean[] : T[] : never
export type PossibleScalarValues = string | number | Date | boolean
export type Operators = {
  [op in ComparisonStringOp]:
    op extends ArrayComparisonStringOp ? DistributeArray<PossibleScalarValues> : PossibleScalarValues
}
export type PossibleValues = Operators[keyof Operators]

export interface WhereLeaf {
  [field: string]: Partial<Operators>
}

// tslint:disable-next-line:variable-name
const WhereNodeEntry = mem((whereNode: GraphQLInputObjectType, _leaf: GraphQLInputObjectType) => (
  new GraphQLInputObjectType({
    name: 'WhereNodeEntry'
  , fields: () => ({
      OR: { type: new GraphQLList(whereNode), description: 'A logical OR of the values' }
    , AND: { type: new GraphQLList(whereNode), description: 'A logical AND of the values' }
    , NOT: { type: whereNode, description: 'A logical NOT of the value' }
    })
  })
), { cacheKey: (_: any, leaf: GraphQLInputObjectType) => leaf.name })

export const createWhereNode = mem((whereLeaf: GraphQLInputObjectType) => {
  // memoization replaces: if (name in whereNodeMap) return whereNodeMap[name]
  const node: GraphQLInputObjectType =  new GraphQLInputObjectType({
    name: 'WhereNode'
  , description: 'A Boolean expression as a tree'
  , fields: () => ({
      node: {
        type: WhereNodeEntry(node, whereLeaf)
      }
    , leaf: {
        type: whereLeaf
      }
    })
  })

  return node
}, { cacheKey: (leaf: GraphQLInputObjectType) => leaf.name })

export const dateOperators = (kind: 'date' | 'datetime' | 'time') => {
  const type = kind === 'date' ? GraphQLDate : kind === 'datetime' ? GraphQLDateTime : GraphQLTime
  return {
    ...getOperator(type, 'gt')
  , ...getOperator(type, 'lt')
  , ...getOperator(type, 'gte')
  , ...getOperator(type, 'lte')
  , ...getOperator(type, 'eq')
  , ...getOperator(type, 'neq')
  , ...getOperator(new GraphQLList(type), 'in')
  , ...getOperator(new GraphQLList(type), 'not_in')
  }
}

export const stringlikeOperators = (type: GraphQLScalarType = GraphQLString) => (
  {
    ...getOperator(type, 'gt')
  , ...getOperator(type, 'lt')
  , ...getOperator(type, 'gte')
  , ...getOperator(type, 'lte')
  , ...getOperator(type, 'eq')
  , ...getOperator(type, 'neq')
  , ...getOperator(new GraphQLList(type), 'in')
  , ...getOperator(new GraphQLList(type), 'not_in')
  , ...getOperator(GraphQLString, 'like')
  }
)

export const numberOperators = (kind: 'int' | 'double' | 'percent' | 'currency') => {
  const type = kind === 'int' ? GraphQLInt : GraphQLFloat
  return {
    ...getOperator(type, 'gt')
  , ...getOperator(type, 'lt')
  , ...getOperator(type, 'gte')
  , ...getOperator(type, 'lte')
  , ...getOperator(type, 'eq')
  , ...getOperator(type, 'neq')
  , ...getOperator(new GraphQLList(type), 'in')
  , ...getOperator(new GraphQLList(type), 'not_in')
  }
}

export const booleanOperators = () => ({ ...getOperator(GraphQLBoolean, 'eq'), ...getOperator(GraphQLBoolean, 'neq') })
export const multipicklistOperators = () => ({
    ...stringlikeOperators()
  , ...getOperator(GraphQLString, 'includes')
  , ...getOperator(GraphQLString, 'excludes')
  })

const getOperatorFieldsFor = (sftype: FieldType): GraphQLInputFieldConfigMap => {
  // multiselect picklists have includes and excludes
  switch (sftype) {
    case 'date':
    case 'datetime':
    case 'time':
      return dateOperators(sftype)
    case 'email':
      return stringlikeOperators(GraphQLEmailAddress)
    case 'url':
      return stringlikeOperators(GraphQLURL)
    case 'reference':
    case 'id':
      return stringlikeOperators(GraphQLSFID)
    case 'string':
    case 'encryptedstring':
    case 'base64':
    case 'anyType':
    case 'combobox':
    case 'phone':
    case 'textarea':
    case 'picklist':
    case 'location':
      return stringlikeOperators()
    case 'multipicklist':
      return multipicklistOperators()
    case 'int':
    case 'double':
    case 'percent':
    case 'currency':
      return numberOperators(sftype)
    case 'boolean':
      return booleanOperators()
  }
}

const createOperatorObject = mem((sftype: FieldType) => (
  new GraphQLInputObjectType({
    name: `Operators_${sftype}`
  , description: `Operators for salesforce ${sftype} fields`
  , fields: getOperatorFieldsFor(sftype)
  })
))

// tslint:disable-next-line:variable-name
export const createWhereLeaf = mem((fields: Array<[string, FieldType]>) => (
  // tesxtarea cannot be specified in the where clause of a queryString of a query call
  new GraphQLInputObjectType({
    name: 'WhereLeaf'
  , description: 'A leaf of a boolean expression tree: an expression that evaluates to a boolean'
  , fields: () => mergeObjs(fields.map(f => ({ [f[0]]: { type: createOperatorObject(f[1]) } })))
  })
))
