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
          type: new GraphQLNonNull(DirectionEnum)
        , description:
            'Specifies whether the results are ordered in ascending (ASC) or descending (DESC) order. Default ASC'
        }
      , nulls: {
          type: FirstLastEnum
        , description: 'Orders null records at the beginning (FIRST) or end (LAST) of the results. Default FIRST'
        }
      }

  return new GraphQLInputObjectType({
    name: `OrderBy_${hash(fieldNames)}`
  , description: 'Control the order of the query results.'
    + ' There is no guarenteed order unless you use an ORDER BY clause'
  , fields
  })
}, { cacheKey: (fieldNames: string[]) => joinNames(fieldNames) })

export const createListArgs = (leafFields: Array<[string, FieldType]>) => {
  // list of (fieldName, sftype) tuples
  const config: { [name in keyof Required<ListArguments>]: GraphQLArgumentConfig }
    = { ...createWhereArgs(leafFields)
      , offset: {
          type: GraphQLUnsignedInt
        , description: 'Specify the starting row offset. Maximum value is 2000'
        }
      , limit: {
          type: GraphQLUnsignedInt
        , description: 'Maximum number of rows to return'
        }
      , orderBy: {
          type: createOrderBy(leafFields.map(f => f[0]))
        }
      }
  return config
}

export const middleware: BuildObjectsMiddleware = (field, fields, _) => {
  if (isChildField(field)) {
    const leafFields = getArgFields(fields as any)
    const args = createListArgs(leafFields)
    const type = new GraphQLList(field.type)
    return { ...field, type, args }
  }

  return field
}
