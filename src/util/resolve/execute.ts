import { QueryResult, ConnectionOptions, Connection } from 'jsforce'
import { mapObj, partition, truncateToDepth, removeLeafObjects } from '../util'
import { AnnotatedFieldSet, isAnnotatedFieldSet, AnnotatedFieldSetCondition } from './annotate'
import { isLeafField, isParentField, isChildField } from '../../types'
import { parentQuery, ParentQuery, childQuery, ChildQuery } from '../../SOQL/SOQL'
import { getWhereClause } from '../GraphQLWhere/Parse'
import { Either, either } from 'fp-ts/lib/Either'
import { sequence } from 'fp-ts/lib/Traversable'
import { array } from 'fp-ts/lib/Array'
import { and } from '../functional'
import { pipe } from 'fp-ts/lib/function'

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

/**
 * Executes a query using jsforce and parses the result
 * @param info Authentication information for jsforce
 * @param query A SOQL query string
 */
export const execute = (info: AuthenticationInfo) => (query: string) =>
  executeQuery(info)(query).then(convertQueryResult)

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
    return mapObj(v => isQueryResult(v) ? convertQueryResult(v) : v, r)
  })
}

export type QueryInfo = ConcreteQueryInfo | ConditionalQueryInfo

export interface ConcreteQueryInfo {
  leafs: AnnotatedFieldSet[]
  childs: ConcreteQueryInfo[]
  parents: ConcreteQueryInfo[]
  branches: ConditionalQueryInfo[]
  field: AnnotatedFieldSet
}

export interface ConditionalQueryInfo {
  leafs: AnnotatedFieldSet[]
  childs: ConcreteQueryInfo[]
  parents: ConcreteQueryInfo[]
  branches: ConditionalQueryInfo[]
  field: AnnotatedFieldSetCondition
}

const getConditionalInfo = (field: AnnotatedFieldSetCondition): ConditionalQueryInfo => {
  // we could try to reduce duplication between this and getQueryInfo, but I can't get the types to work
  // TODO: Reduce duplication between getConditionalInfo and getQueryInfo
  if (field.kind === 'concreteCondition') {
    const partitioned = partition(field.children || [], {
      leafs: and(isAnnotatedFieldSet, c => isLeafField(c.configField))
    , childs: and(isAnnotatedFieldSet, c => isChildField(c.configField))
    , parents: and(isAnnotatedFieldSet, c => isParentField(c.configField))
    })

    return {
      leafs: partitioned.leafs
    , childs: partitioned.childs.map(getQueryInfo)
    , parents: partitioned.parents.map(getQueryInfo)
    , branches: []
    , field
    }
  }

  return {
    leafs: []
  , childs: []
  , parents: []
  , branches: field.children.map(getConditionalInfo)
  , field
  }
}

export const getQueryInfo = (field: AnnotatedFieldSet): ConcreteQueryInfo => {
  const partitioned = partition(field.children || [], {
    leafFields: and(isAnnotatedFieldSet, c => isLeafField(c.configField))
  , childFields: and(isAnnotatedFieldSet, c => isChildField(c.configField))
  , parentFields: and(isAnnotatedFieldSet, c => isParentField(c.configField))
  })

  const branches = field.kind === 'abstract' ? field.possibleSets.map(getConditionalInfo) : []

  return {
    leafs: partitioned.leafFields
  , childs: partitioned.childFields.map(getQueryInfo)
  , parents: partitioned.parentFields.map(getQueryInfo)
  , branches
  , field
  }
}

export const parseFieldsAndParents
  = (qInfo: ConcreteQueryInfo): Either<string,
  { object: string, fields: string[], parents: ParentQuery[], args: any }> => {
    const object = qInfo.field.fieldName
    // always include the Id field so we have some reference for filtering with sub-resolvers
    const fields = [...new Set(['Id', ...qInfo.leafs.map(l => l.fieldName)])]
    // we truncate the parent queries to what we know is a valid request
    // the sub-resolvers will handle making new requests to get the other data
    const parents = qInfo.parents.map(p =>
      parseFieldsAndParents(p)
        .chain(({object, fields, parents}) => parentQuery(object, [...fields, ...parents], true))
    ).map(p => p.map(pipe(truncateToDepth(5), removeLeafObjects)))

    return sequence(either, array)(parents)
      .map(ps => ({ object, fields, parents: ps, args: qInfo.field.args }))
  }

export const parseChildren = (children: ConcreteQueryInfo[]): Either<string, ChildQuery[]> => {
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
