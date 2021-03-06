import { BuildObjectsMiddleware, isChildField } from '../../types'
import { GraphQLEnumType, GraphQLInputObjectType,
         GraphQLNonNull, GraphQLList, GraphQLInputFieldConfig,
         GraphQLArgumentConfig } from 'graphql'
import mem from 'mem'
import { joinNames } from '../../util'
import { GraphQLUnsignedInt } from '../../util/GraphQLScalars'
import { getArgFields } from '../../util/arguments'
import { WhereArguments, createWhereArgs } from '../../util/GraphQLWhere/WhereArgs'
import { FieldType } from 'jsforce'
import { createHash } from 'crypto'
import { SOQLQueryFilters } from '../../SOQL/SOQL'

export interface ListArguments extends WhereArguments {
  // Does it really make sense to include null ordering? I don't think GraphQL returns nulls
  orderBy?: SOQLQueryFilters['orderBy']
  offset?: number
  limit?: number
}

const hash = mem((fields: string[]) =>
  createHash('md5')
    .update(fields.join())
    .digest('hex')
)

// tslint:disable-next-line:variable-name
export const FieldEnum = mem((fields: string[]) => (
  new GraphQLEnumType({
    name: `FieldEnum_${hash(fields)}`
  , values: fields.map(f => ({ [f]: { description: f } })).reduce((p, c) => ({ ...p, ...c }), {})
  , description: 'A field from the parent object'
  })
), { cacheKey: (fields: string[]) => joinNames(fields) })

// tslint:disable-next-line:variable-name
const DirectionEnum = new GraphQLEnumType({
  name: 'DirectionEnum'
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
  const fields: { [name in keyof Required<ListArguments['orderBy']>]: GraphQLInputFieldConfig }
    = {
        fields: {
          type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(FieldEnum(fieldNames))))
        }
      , dir: {
          type: DirectionEnum
        , description:
            'Specifies whether the results are ordered in ascending (ASC) or descending (DESC) order. Default ASC'
        , defaultValue: 'ASC'
        } as GraphQLInputFieldConfig
      , nulls: {
          type: FirstLastEnum
        , description: 'Orders null records at the beginning (FIRST) or end (LAST) of the results. Default FIRST'
        , defaultValue: 'FIRST'
        } as GraphQLInputFieldConfig
      }

  return new GraphQLInputObjectType({
    name: `OrderBy_${hash(fieldNames)}`
  , description: 'Control the order of the query results.'
    + ' There is no guarenteed order unless you use an ORDER BY clause'
  , fields
  })
}, { cacheKey: (fieldNames: string[]) => joinNames(fieldNames) })

export const createListArgs = (leafFields: Array<[string, FieldType]>) => {
  const orderBy = leafFields.length > 0 ? {
    orderBy: {
      type: createOrderBy(leafFields.map(f => f[0]))
    }
  } : {}
  // list of (fieldName, sftype) tuples
  const config: { [name in keyof ListArguments]: GraphQLArgumentConfig }
    = { ...createWhereArgs(leafFields)
      , offset: {
          type: GraphQLUnsignedInt
        , description: 'Specify the starting row offset. Maximum value is 2000'
        }
      , limit: {
          type: GraphQLUnsignedInt
        , description: 'Maximum number of rows to return'
        }
      , ...orderBy
      }
  return config
}

export const middleware: BuildObjectsMiddleware = (field, fields) => {
  // don't touch anything but our child fields - we don't want to run this
  // on regular GraphQLFieldConfigs
  if (isChildField(field)) {
    const leafFields = getArgFields(fields)
    const args = createListArgs(leafFields)
    const type = new GraphQLList(field.type)
    return { ...field, type, args: args as any }
  }

  return field
}
