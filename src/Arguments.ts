import { WhereNode, createWhereLeaf, createWhereNode } from './Where'
import { GraphQLFieldConfigArgumentMap, GraphQLString,
  GraphQLInputObjectType, GraphQLNonNull,
  GraphQLList, GraphQLEnumType, GraphQLField, GraphQLArgumentConfig, GraphQLInputFieldConfig } from 'graphql'
import mem from 'mem'
import { joinNames, filterObj } from './util'
import { tuple, compose, and } from 'fp-ts/lib/function'
import { LeafField, Field, isLeafField, AdditionalInfo } from './types'
import { GraphQLUnsignedInt } from './util/GraphQLScalars'

export interface ListArguments {
  filter?: WhereNode
  filterString?: string
  orderBy?: { fields: string[], direction: 'ASC' | 'DESC', nulls: 'FIRST' | 'LAST' }
  offset?: number
  limit?: number
}

// tslint:disable-next-line:variable-name
export const FieldEnum = mem((fields: string[]) => (
  new GraphQLEnumType({
    name: `FieldEnum_${joinNames(fields)}`
  , values: fields.map(f => ({ [f]: { description: f } })).reduce((p, c) => ({ ...p, ...c }), {})
  , description: 'A field from the parent object'
  })
), { cacheKey: (fields: string[]) => joinNames(fields, 'Enum') })

// tslint:disable-next-line:variable-name
const DirectionEnum = new GraphQLEnumType({
  name: 'Direction Enum'
, values: {
    ASC: { description: 'Ascending' }
  , DESC: { description: 'Descending' }
  }
})

// tslint:disable-next-line:variable-name
const FirstLastEnum = new GraphQLEnumType({
  name: 'FirstLastEnum'
, values: {
    FIRST: {}, LAST: {}
  }
})

const createOrderBy = mem((fieldNames: string[]) => {
  const fields: { [name in keyof Required<ListArguments>['orderBy']]: GraphQLInputFieldConfig }
    = {
        fields: {
          type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(FieldEnum(fieldNames))))
        }
      , direction: {
          type: DirectionEnum
        , description: 'Optional direction. Defaults to ASC'
        }
      , nulls: {
          type: FirstLastEnum
        , description: 'Order null records at the beginning or end of the results. Defaults to nulls first'
        }
      }

  return new GraphQLInputObjectType({
    name: `OrderBy_${joinNames(fieldNames)}`
  , fields
  })
})

const mapping = (obj: { [x: string]: LeafField }) => Object.keys(obj).map(k => tuple(k, obj[k].sftype))
const filtering = filterObj(
    (f: Field | GraphQLField<any, any> & AdditionalInfo): f is LeafField =>
      and(isLeafField, f => (f as LeafField).filterable)(f as Field)
  )
const getArgFields = compose(mapping, filtering)

export const createListArgs =
(fields: { [x: string]: Field | (GraphQLField<any, any> & AdditionalInfo) }): GraphQLFieldConfigArgumentMap => {
  const leafFields = getArgFields(fields)
  const config: { [name in keyof Required<ListArguments>]: GraphQLArgumentConfig }
    = {
        filter: {
          type: createWhereNode(createWhereLeaf(leafFields))
        // tslint:disable-next-line:max-line-length
        , description: `A tree representing a SOQL Where clause. Takes priority over 'filterString' if both are specified`
        }
      , filterString: {
          type: GraphQLString
        , description: 'A SOQL Where clause'
        }
      , offset: {
          type: GraphQLUnsignedInt
        , description: 'Positive integer to offset results by'
        }
      , limit: {
          type: GraphQLUnsignedInt
        , description: 'Number of records to return'
        }
      , orderBy: {
          type: createOrderBy(leafFields.map(f => f[0]))
        }
      }
  return config
}
