import { getFieldSet } from '../../util'
import { annotateFieldSet, AnnotatedFieldSet } from '../../util/resolve/annotate'
import { getQueryInfo, parseChildren,
  parseFieldsAndParents } from '../../util/resolve/execute'
import { Either, right } from 'fp-ts/lib/Either'
import { isChildField, isParentField, isLeafField, ResolverMiddleware } from '../../types'
import { getWhereClause } from '../../util/GraphQLWhere/Parse'
import { singleton } from '../../util/BinaryTree'
import { BooleanExpression } from '../../SOQL/WhereTree'
import { soqlQuery, soql } from '../../SOQL/SOQL'

const fieldResolver
  = (source: any, annotatedFields: AnnotatedFieldSet): Either<string, Promise<any>> => {
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
    annotatedFields: AnnotatedFieldSet,
    queryFun: (context: any) => (query: string) => Promise<any[] | null>
) => {
  // this is an example of case Root-Child1-Child2
  /* Solution:
    1. Select Id from the first child below root (which we have done by this point)
    2. Using that Id, make the following query: SELECT (Child2 query) FROM Child1 WHERE Child1.Id = Id
    3. If we receive a non-null result, return the Child2 field from the Child1 result object
  */
  const parentId = source.Id
  // I don't want ot rely on our resolver always returning this attributes object
  // jsforce does, (and I think salesforce always does, but we are allowing arbitrary resolvers)
  // const parentObj = source.attributes.type
  // TODO: figure out if this is always correct
  const parentObj = annotatedFields.parentObj!.name

  const queryInfo = getQueryInfo(annotatedFields)
  const children = parseChildren([queryInfo])

  return children
    .chain(cs => {
      // the parent arguments should already have been handled by the previous query
      // we only ever expect to get one element, since we are filtering by Id
      // plus this allows child queries to use OFFSET
      return soqlQuery(parentObj, cs, {
        where: singleton<BooleanExpression>({ field: 'Id', op: '=', value: parentId }),
        limit: 1
      })
    })
    .chain(soql)
    .map(queryFun(context))
    .map(ps => ps.then(v => {
      // this really shouldn't happen, since we already got a parent
      // object with this id in a previous query, so this query should give a result
      /* istanbul ignore if */
      if (!v || v.length === 0) return null

      // because we filter by Id then there should only be one result
      return v[0][queryInfo.field.fieldName]
    }))
}

const rootResolver = (
  context: any,
  annotatedFields: AnnotatedFieldSet,
  queryFun: (context: any) => (query: string) => Promise<any[] | null>
) => {
  const queryInfo = getQueryInfo(annotatedFields)

  return parseFieldsAndParents(queryInfo).chain(({ object, fields, parents, args }) =>
    parseChildren(queryInfo.childs).chain(cs =>
      getWhereClause(args)
        .chain(w =>
          soqlQuery(object, [...fields, ...parents, ...cs], {
            where: w
          , offset: args.offset
          , limit: args.limit
          , orderBy: args.orderBy
          })
        )
    )
  )
  .chain(soql)
  .map(queryFun(context))
  .map(ps => ps.then(v => {
    // root resolvers will always return a list
    return v
  }))
}

const parentResolver = (
  source: any,
  context: any,
  annotatedFields: AnnotatedFieldSet,
  queryFun: (context: any) => (query: string) => Promise<any[] | null>
) => {
  // TODO: Remove code duplication between this and rootResolver
  const queryInfo = getQueryInfo(annotatedFields)
  const parentObj = annotatedFields.parentObj!.name
  const parentId = source.Id

  return parseFieldsAndParents(queryInfo).chain(({ fields, parents }) =>
    parseChildren(queryInfo.childs).chain(cs =>
      soqlQuery(parentObj, [...fields, ...parents, ...cs], {
        where: singleton<BooleanExpression>({ field: 'Id', op: '=', value: parentId })
      , limit: 1
      })
    )
  )
  .chain(soql)
  .map(queryFun(context))
  .map(ps => ps.then(v => {
    // parent resolvers will always return an object
    return v && v[0]
  }))
}

export const resolver
  = (queryFun: (context: any) => (query: string) => Promise<any[] | null>): ResolverMiddleware =>
    (rootQuery, objectMap) =>
    (source, _args, context, info) => {
      const parentObj = info.parentType
      const fieldSet = getFieldSet(info)
      const annotatedFields = annotateFieldSet(parentObj, fieldSet, objectMap)

      const promise = ((): Either<string, Promise<any>> => {
        if (parentObj.name === rootQuery.name) {
          return rootResolver(context, annotatedFields, queryFun)
        }

        if (typeof source[info.path.key] === 'undefined') { // we haven't fully resolved our current path
          // and we are trying to resolve child field
          if (annotatedFields.configField && isChildField(annotatedFields.configField)) {
            return childResolver(source, context, annotatedFields, queryFun)
          }

          // and we are trying to resolve parent field
          // the else path should never exist, but we'll leave the if statement in
          /* istanbul ignore else */
          if (annotatedFields.configField && isParentField(annotatedFields.configField)) {
            return parentResolver(source, context, annotatedFields, queryFun)
          }
        }

        return fieldResolver(source, annotatedFields)
      })()

      // this is really hard to test: we want to catch any errors that might show
      // but we attempt to make sure that never happens in the sub resolvers
      /* istanbul ignore if */
      if (promise.isLeft()) {
        // FIXME: we can't perform requests with more than 20 parent-child or 35 child-parent
        // resolvers should handle turning the request into valid queries without errors
        throw new Error(promise.value)
      }

      return promise.value
    }
