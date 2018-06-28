import { describeSalesforceObjects, writeDescribeFiles, importDescribeFiles } from '../src/describe'
import { ConnectionOptions, Connection, QueryResult } from 'jsforce'
import { makeObjects, buildGraphQLObjects } from '../src/buildSchema'
import { middleware as offsetMiddleware } from '../src/Pagination/Offset'
import { GraphQLSchema, GraphQLFieldConfig, GraphQLList, GraphQLResolveInfo } from 'graphql'
import { mergeObjs, getFieldSet, mapObj, truncateToDepth, partition, unzipEithers } from '../src/util'
import { annotateFieldSet, AnnotatedFieldSet } from '../src/util/resolve'
import graphqlHTTP from 'express-graphql'
import express from 'express'
import { salesforceObjectConfig, childField, BuildObjectsMiddleware,
  isLeafField, isChildField, isParentField, NonEmptyArray } from '../src/types'
import { parentQuery, ParentQuery, soqlQuery, SOQLQuery, soql, childQuery, ParentQueryValue } from '../src/SOQL/SOQL'
import { getWhereClause } from '../src/util/GraphQLWhere/Parse'
import { Endomorphism } from 'fp-ts/lib/function'
import { Tree } from 'fp-ts/lib/Tree'
import { Node, singleton } from '../src/util/BinaryTree'
import { BooleanOp, BooleanExpression } from '../src/SOQL/WhereTree'
import { Either, right } from 'fp-ts/lib/Either'

if (process.env.SF_USER
  && process.env.SF_PASS
  && process.env.SF_URL
  && process.env.SF_ENV) {
    const options: ConnectionOptions = {
      loginUrl: process.env.SF_URL
    , instanceUrl: process.env.SF_ENV
    }
    // tslint:disable:no-console

    const executeQuery = (un: string, pw: string, options: ConnectionOptions) => (query: string) => {
      console.log(query)
      const conn = new Connection(options)
      return conn.login(un, pw).then(() => {
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

    const executeAndConvert = (un: string, pw: string, options: ConnectionOptions) => (query: string) => {
      return executeQuery(un, pw, options)(query).then(convertQueryResult)
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

    const fetchDescribes = (online: boolean, path = `${process.env.HOME}/Documents/describes`) => {
      if (online) {
        return describeSalesforceObjects(process.env.SF_USER!, process.env.SF_PASS!, options)
          .then(ps => Promise.all(ps))
          // tslint:disable-next-line:no-expression-statement
          .then(descs => { writeDescribeFiles(descs, path); return descs })
      } else {
        return importDescribeFiles(path).then(ps => Promise.all(ps))
      }
    }

    const rootFields = fetchDescribes(false).then(descs => {
      const objects = makeObjects(descs)

      const rootQuery = salesforceObjectConfig(
        'SalesforceQuery'
      , 'Query Salesforce'
      , mergeObjs(...objects.map(c => ({ [c.name]: childField(c.name, c.description) })))
      )

      const objectMap = mergeObjs(...[...objects, rootQuery].map(o => ({ [o.name]: o })))

      interface QueryInfo {
        leafs: AnnotatedFieldSet[]
        childs: QueryInfo[]
        parents: QueryInfo[]
        field: AnnotatedFieldSet
      }

      const getQueryInfo = (field: AnnotatedFieldSet): QueryInfo => {
        const partitioned = partition(field.children!, {
          leafFields: c => !!c.configField && isLeafField(c.configField)
        , childFields: c => !!c.configField && isChildField(c.configField)
        , parentFields: c => !!c.configField && isParentField(c.configField)
        })

        return {
            leafs: partitioned.leafFields
          , childs: partitioned.childFields.map(getQueryInfo)
          , parents: partitioned.parentFields.map(getQueryInfo)
          , field
          }
      }

      const removeLeafObjects = (tree: ParentQuery): ParentQuery => {
        // I want to remove subtrees that are leafs and have value with kind='object'
        const forest = tree.forest.filter(f =>
          !(f.value.kind === 'object' && f.forest.length === 0)
          ).map(removeLeafObjects)

        return new Tree<ParentQueryValue>(tree.value, forest)
      }

      const parseFieldsAndParents
        = (qInfo: QueryInfo): { object: string, fields: string[], parents: ParentQuery[], args: any } => {
          const object = qInfo.field.fieldName
          // always include the Id field so we have some reference for filtering with sub-resolvers
          const fields = [...new Set([...qInfo.leafs.map(l => l.fieldName), 'Id'])]
          // we truncate the parent queries to what we know is a valid request
          // the sub-resolvers will handle making new requests to get the other data
          const parents = qInfo.parents.map(p => {
            const { object, fields, parents } = parseFieldsAndParents(p)
            return parentQuery(object, [...fields, ...parents] as NonEmptyArray<any>)
          }).map(truncateToDepth(5)).map(removeLeafObjects)

          return { object, fields, parents, args: qInfo.field.args }
        }

      const parseChildren = (children: QueryInfo[]) => {
          return unzipEithers(children.map(c => {
              const { object, fields, parents, args } = parseFieldsAndParents(c)
              const where = getWhereClause(args)
              return where.map(w =>
                childQuery(object, [...fields, ...parents] as NonEmptyArray<any>, {
                  where: w
                , offset: args.offset
                , limit: args.limit
                , orderBy: args.orderBy
                })
              )
          })).mapLeft(e => e.join('\n'))
      }

      const rootResolver
      = (_source: any, annotatedFields: AnnotatedFieldSet, info: GraphQLResolveInfo) => {
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
          .map(executeAndConvert(process.env.SF_USER!, process.env.SF_PASS!, options))
          .map(ps => ps.then(v => {
            if (info.returnType instanceof GraphQLList) {
              return v
            }

            return v && v[0]
          }))
      }

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
          source: any, annotatedFields: AnnotatedFieldSet,
          _info: GraphQLResolveInfo
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
          .map(executeAndConvert(process.env.SF_USER!, process.env.SF_PASS!, options))
          .map(ps => ps.then(v => {
            if (!v || v.length === 0) return null

            // because we filter by Id then there should only be one result
            return v[0][queryInfo.field.fieldName]
          }))
      }

      const resolverMiddleware: Endomorphism<GraphQLFieldConfig<any, any>> = config => ({
        ...config
      , resolve: (source, _args, _context, info) => {
          const parentObj = info.parentType
          const fieldSet = getFieldSet(info)
          const annotatedFields = annotateFieldSet(parentObj, fieldSet, objectMap)

          const promise = ((): Either<string, Promise<any>> => {
            if (parentObj.name === rootQuery.name) {
              return rootResolver(source, annotatedFields, info)
            }

            if (typeof source[info.path.key] === 'undefined') { // we haven't fully resolved our current path
              // and we are trying to resolve child field
              if (annotatedFields.configField && isChildField(annotatedFields.configField)) {
                return childResolver(source, annotatedFields, info)
              }

              // and we are trying to resolve parent field
              if (annotatedFields.configField && isParentField(annotatedFields.configField)) {
                return rootResolver(source, annotatedFields, info)
              }
            }

            return fieldResolver(source, annotatedFields, info)
          })()

          if (promise.isLeft()) {
            throw new Error(promise.value)
          }

          return promise.value
        }
      })

      const middleware: BuildObjectsMiddleware = (field, fields, parent, objectMap) =>
        resolverMiddleware(offsetMiddleware(field, fields, parent, objectMap))

      const gqlObjects = buildGraphQLObjects([...objects, rootQuery], middleware)

      const queryObject = gqlObjects[1].SalesforceQuery

      return queryObject
    })

    const app = express()

    // tslint:disable-next-line:no-expression-statement
    app.use('/graphql', graphqlHTTP(
      rootFields.then(query => {
        const schema = new GraphQLSchema({
          query
        })
        // tslint:disable-next-line:no-console
        console.log('Server is ready')
        return {
          schema
        , graphiql: true
        }
      })
    ))

    // tslint:disable-next-line:no-expression-statement
    app.listen(process.env.PORT || 4000)
} else {
  // tslint:disable-next-line:no-console
  console.error('ERROR, env vars not specified')
}
