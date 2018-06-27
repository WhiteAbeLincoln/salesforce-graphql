import { GraphQLInputType, GraphQLList, GraphQLScalarType, GraphQLString, GraphQLInt,
  GraphQLFloat, GraphQLBoolean, GraphQLInputFieldConfigMap, GraphQLInputObjectType } from 'graphql'
import { OpPairValue, ArrayOpPairs, ScalarOpPairs, MPickListOpPairs, ComparisonOp } from '../../SOQL/WhereTree'
import { GraphQLDate, GraphQLDateTime, GraphQLTime } from 'graphql-iso-date'
import { FieldType } from 'jsforce'
import { GraphQLEmailAddress, GraphQLURL, GraphQLSFID } from '../GraphQLScalars'
import mem from 'mem'

export type MPicklistComparisonStringOp = 'includes' | 'excludes'
export type ArrayComparisonStringOp = 'in' | 'not_in'
export type ScalarComparisonStringOp =
  | 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'neq'
  | 'like'

export type ComparisonStringOp = ScalarComparisonStringOp | ArrayComparisonStringOp | MPicklistComparisonStringOp

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
, includes: 'Multipicklist has'
, excludes: 'Multipicklist doesn\'t have'
}

const opMap: { [key in ComparisonStringOp]: ComparisonOp }
  = {
      gt: '>'
    , lt: '<'
    , gte: '>='
    , lte: '<='
    , eq: '='
    , neq: '!='
    , like: 'LIKE'
    , in: 'IN'
    , not_in: 'NOT IN'
    , includes: 'INCLUDES'
    , excludes: 'EXCLUDES'
    }

export const getOperator = (type: GraphQLInputType, op: ComparisonStringOp) => (
  {
    [op]: { type, description: operatorDescription[op] }
  }
)

export const convertOp = (op: ComparisonStringOp): ComparisonOp => opMap[op]

export type Operators = {
  [op in ComparisonStringOp]:
    op extends ArrayComparisonStringOp
      ? OpPairValue<ArrayOpPairs>
      : op extends MPicklistComparisonStringOp
        ? OpPairValue<MPickListOpPairs>
        : OpPairValue<ScalarOpPairs>
}

// TODO: Find a way to type these operator maps based on our WhereTree OpPairs so we have a single source of truth
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
    ...getOperator(GraphQLString, 'eq')
  , ...getOperator(GraphQLString, 'neq')
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
    case 'address':
    case 'complexvalue':
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

export const createOperatorObject = mem((sftype: FieldType) => (
  new GraphQLInputObjectType({
    name: `Operators_${sftype}`
  , description: `Operators for salesforce ${sftype} fields`
  , fields: getOperatorFieldsFor(sftype)
  })
))
