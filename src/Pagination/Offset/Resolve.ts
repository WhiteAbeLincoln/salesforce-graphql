import { GraphQLResolveInfo, GraphQLList } from 'graphql'
import { getFieldSet } from '../../util'
import { annotateFieldSet, AnnotatedFieldSet } from '../../util/resolve/annotate'
import { getQueryInfo, parseChildren, executeAndConvert,
  QueryInfo, parseFieldsAndParents, GetExecutionInfo } from '../../util/resolve/execute'
import { Either, right } from 'fp-ts/lib/Either'
import { isChildField, isParentField, isLeafField,
  NonEmptyArray, ResolverMiddleware } from '../../types'
import { getWhereClause } from '../../util/GraphQLWhere/Parse'
import { singleton, Node } from '../../util/BinaryTree'
import { BooleanExpression, BooleanOp } from '../../SOQL/WhereTree'
import { soqlQuery, soql, SOQLQuery } from '../../SOQL/SOQL'

const fieldResolver
  = (source: any, annotatedFields: AnnotatedFieldSet, _info: GraphQLResolveInfo): Either<string, Promise<any>> => {
    // salesforce returns ISO8601 compatible date. GraphQLISODate expects ISO3339
    // meaning a date such as 2018-06-13T18:24:53.000+0000 won't parse because
    // the offset should be colon separated
    // TODO: Issue a pull request for GraphQLISODate that lets it parse the limited ISO8601 grammar as defined
    // in Appendix a of ISO3339 RFC
    const configField = annotatedFields.configField
    if (configField && isLeafField(configField) && configField.sftype === 'datetime') {
      return right(Promise.resolve(source && new Date(source[annotatedFields.fieldName])))
    }

    return right(Promise.resolve(source && source[annotatedFields.fieldName]))
  }

const childResolver = (
    source: any,
    context: any,
    _info: GraphQLResolveInfo,
    annotatedFields: AnnotatedFieldSet,
    authFun: GetExecutionInfo
) => {
  // this is an example of case Root-Child1-Child2
  /* Solution:
    1. Select Id from the first child below root (which we have done by this point)
    2. Using that Id, make the following query: SELECT (Child2 query) FROM Child1 WHERE Child1.Id = Id
    3. If we receive a non-null result, return the Child2 field from the Child1 result object
  */
  const parentId = source.Id
  const parentObj = source.attributes.type
  const parentArgs = annotatedFields.args

  const queryInfo = getQueryInfo(annotatedFields)
  const children = parseChildren([queryInfo])

  return children
    .chain(cs => (
      getWhereClause(parentArgs)
        .map(w => {
          // Add the Id filter to our existing where clause
          if (typeof w !== 'string') {
            const idFilter = singleton<BooleanExpression>({ field: 'Id', op: '=', value: parentId })
            return w.isLeaf() ? idFilter : new Node<BooleanOp | BooleanExpression>('AND', idFilter, w)
          }

          const idFilter = `(Id = '${parentId}')`
          return w === '' ? idFilter : `${idFilter} AND (${w})`
        })
        .map(w =>
          soqlQuery(parentObj, cs as NonEmptyArray<any>,
          { where: w, offset: parentArgs.offset, limit: parentArgs.limit, orderBy: parentArgs.orderBy })
        )
      )
    )
    .chain(soql)
    .map(executeAndConvert(authFun(context)))
    .map(ps => ps.then(v => {
      if (!v || v.length === 0) return null

      // because we filter by Id then there should only be one result
      return v[0][queryInfo.field.fieldName]
    }))
}

const rootResolver = (
  _source: any,
  context: any,
  info: GraphQLResolveInfo,
  annotatedFields: AnnotatedFieldSet,
  authFun: GetExecutionInfo
) => {
  const parseQueryInfo = (qInfo: QueryInfo) => {
    const { object, fields, parents, args } = parseFieldsAndParents(qInfo)

    return parseChildren(qInfo.childs).chain(cs =>
      getWhereClause(args)
        .map(w =>
          soqlQuery(object, [...fields, ...parents, ...cs] as SOQLQuery['selections'], {
            where: w
          , offset: args.offset
          , limit: args.limit
          , orderBy: args.orderBy
          })
        )
    )
  }

  return parseQueryInfo(getQueryInfo(annotatedFields))
    .chain(soql)
    .map(executeAndConvert(authFun(context)))
    .map(ps => ps.then(v => {
      if (info.returnType instanceof GraphQLList) {
        return v
      }

      return v && v[0]
    }))
}

export const resolver
  = (authFun: GetExecutionInfo): ResolverMiddleware =>
    (rootQuery, objectMap) =>
    (source, _args, context, info) => {
      const parentObj = info.parentType
      const fieldSet = getFieldSet(info)
      const annotatedFields = annotateFieldSet(parentObj, fieldSet, objectMap)

      const promise = ((): Either<string, Promise<any>> => {
        if (parentObj.name === rootQuery.name) {
          return rootResolver(source, context, info, annotatedFields, authFun)
        }

        if (typeof source[info.path.key] === 'undefined') { // we haven't fully resolved our current path
          // and we are trying to resolve child field
          if (annotatedFields.configField && isChildField(annotatedFields.configField)) {
            return childResolver(source, context, info, annotatedFields, authFun)
          }

          // and we are trying to resolve parent field
          if (annotatedFields.configField && isParentField(annotatedFields.configField)) {
            return rootResolver(source, context, info, annotatedFields, authFun)
          }
        }

        return fieldResolver(source, annotatedFields, info)
      })()

      if (promise.isLeft()) {
        throw new Error(promise.value)
      }

      return promise.value
    }
