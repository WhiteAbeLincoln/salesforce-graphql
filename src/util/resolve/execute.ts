import { QueryResult, ConnectionOptions, Connection } from 'jsforce'
import { mapObj, partition, truncateToDepth, removeLeafObjects } from '../util'
import { AnnotatedFieldSet, isAnnotatedFieldSet } from './annotate'
import { isLeafField, isParentField, isChildField } from '../../types'
import { parentQuery, ParentQuery, childQuery, ChildQuery } from '../../SOQL/SOQL'
import { getWhereClause } from '../GraphQLWhere/Parse'
import { Either, either } from 'fp-ts/lib/Either'
import { sequence } from 'fp-ts/lib/Traversable'
import { array } from 'fp-ts/lib/Array'
import { and } from '../functional'

export interface AuthenticationInfo {
  username: string
  password: string
  options: ConnectionOptions
}

export type GetExecutionInfo = (context: any) => AuthenticationInfo

export const executeQuery = (info: AuthenticationInfo) => (query: string) => {
  const { username, password, options } = info
  const conn = new Connection(options)
  return conn.login(username, password).then(() => {
    return new Promise<QueryResult<any>>((res, rej) => {
      const records = [] as any[]
      const q: any = conn.query(query)
        .on('record', record => {
          // tslint:disable-next-line:no-expression-statement
          records.push(record)
        })
        .on('error', err => {
          return rej(err)
        })
        .on('end', () => {
          return res({
            records
          , done: true
          , totalSize: q.totalSize
          })
        })
        .run({ autoFetch: true })
    })
  })
}

export const executeAndConvert = (info: AuthenticationInfo) => (query: string) => {
  return executeQuery(info)(query).then(convertQueryResult)
}

const isQueryResult = (q: any): q is QueryResult<any> => (
  typeof q === 'object'
    && q !== null
    && typeof q.totalSize === 'number'
    && typeof q.records !== 'undefined'
    && typeof q.done === 'boolean'
)

/**
 * Strips the extraneous query result information from the result and any sub-records
 * @param q A query result
 */
const convertQueryResult = (q: QueryResult<any>): any[] | null => {
  if (!q.records) return null

  return q.records.map(r => {
    return mapObj(v => {
      if (isQueryResult(v)) return convertQueryResult(v)
      return v
    }, r)
  })
}

export interface QueryInfo {
  leafs: AnnotatedFieldSet[]
  childs: QueryInfo[]
  parents: QueryInfo[]
  field: AnnotatedFieldSet
}

export const getQueryInfo = (field: AnnotatedFieldSet): QueryInfo => {
  if (field.kind === 'abstract') {
    const partitioned = partition(field.children || [], {
      leafFields: and(isAnnotatedFieldSet, c => isLeafField(c.configField))
    , childFields: and(isAnnotatedFieldSet, c => isChildField(c.configField))
    , parentFields: and(isAnnotatedFieldSet, c => isParentField(c.configField))
    })

    return {
      leafs: partitioned.leafFields
    , childs: partitioned.childFields.map(getQueryInfo)
    , parents: partitioned.parentFields.map(getQueryInfo)
    , field
    }
  } else {
  const partitioned = partition(field.children || [], {
    leafFields: c => isLeafField(c.configField)
  , childFields: c => isChildField(c.configField)
  , parentFields: c => isParentField(c.configField)
  })

  return {
      leafs: partitioned.leafFields
    , childs: partitioned.childFields.map(getQueryInfo)
    , parents: partitioned.parentFields.map(getQueryInfo)
    , field
    }
  }
}

export const parseFieldsAndParents
  = (qInfo: QueryInfo): Either<string, { object: string, fields: string[], parents: ParentQuery[], args: any }> => {
    const object = qInfo.field.fieldName
    // always include the Id field so we have some reference for filtering with sub-resolvers
    const fields = [...new Set(['Id', ...qInfo.leafs.map(l => l.fieldName)])]
    // we truncate the parent queries to what we know is a valid request
    // the sub-resolvers will handle making new requests to get the other data
    const parents = qInfo.parents.map(p =>
      parseFieldsAndParents(p)
        // FIXME: get rid of this unsafe parentQuery hack
        .chain(({object, fields, parents}) => parentQuery(object, [...fields, ...parents], true))
    ).map(p => p.map(truncateToDepth(5)).map(removeLeafObjects))

    return sequence(either, array)(parents)
      .map(ps => ({ object, fields, parents: ps, args: qInfo.field.args }))
  }

export const parseChildren = (children: QueryInfo[]): Either<string, ChildQuery[]> => {
  return sequence(either, array)(
    children.map(c => {
      return parseFieldsAndParents(c)
        .chain(({ object, fields, parents, args }) => (
          getWhereClause(args)
            .chain(w =>
              childQuery(object, [...fields, ...parents], {
                where: w
              , offset: args.offset
              , limit: args.limit
              , orderBy: args.orderBy
              })
            )
        ))
    })
  )
}
