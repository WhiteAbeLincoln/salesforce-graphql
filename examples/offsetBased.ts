import { describeSalesforceObjects, writeDescribeFiles, importDescribeFiles } from '../src/describe'
import { ConnectionOptions, Connection, QueryResult } from 'jsforce'
import { makeObjects, buildGraphQLObjects } from '../src/buildSchema'
import { middleware as offsetMiddleware, ListArguments } from '../src/Pagination/Offset'
import { GraphQLSchema, GraphQLFieldConfig, GraphQLFieldResolver, GraphQLList } from 'graphql'
import { mergeObjs, getFieldSet } from '../src/util'
import { annotateFieldSet, AnnotatedFieldSet } from '../src/util/resolve'
import graphqlHTTP from 'express-graphql'
import express from 'express'
import { salesforceObjectConfig, childField, BuildObjectsMiddleware,
  isLeafField, isChildField, isParentField, NonEmptyArray } from '../src/types'
import { parentQuery, ParentQuery, soqlQuery, SOQLQuery, soql } from '../src/SOQL/SOQL'
import { getWhereClause } from '../src/util/GraphQLWhere/Parse'
import { Endomorphism } from 'fp-ts/lib/function'

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

      const rootResolver: GraphQLFieldResolver<any, any, ListArguments> = (source, args, _context, info) => {
        // tslint:disable:no-console
        console.log(source)
        console.log(info)
        const fieldSet = getFieldSet(info)
        console.log(fieldSet)
        const parent = info.parentType
        const annotatedFields = annotateFieldSet(parent, fieldSet, objectMap)
        console.log(annotatedFields)

        interface QueryInfo {
          leafs: AnnotatedFieldSet[]
          childs: QueryInfo[]
          parents: QueryInfo[]
          field: AnnotatedFieldSet
        }

        const getQueryInfo = (field: AnnotatedFieldSet): QueryInfo => {
          const leafFields = field.children!.filter(c => c.configField && isLeafField(c.configField))
          const childFields = field.children!.filter(c => c.configField && isChildField(c.configField))
          const parentFields = field.children!.filter(c => c.configField && isParentField(c.configField))

          return {
              leafs: leafFields
            , childs: childFields.map(getQueryInfo)
            , parents: parentFields.map(getQueryInfo)
            , field
            }
        }

        const queryInfo = getQueryInfo(annotatedFields)

        const parseFieldsAndParents
          = (qInfo: QueryInfo): { object: string, fields: string[], parents: ParentQuery[] } => {
            const object = qInfo.field.fieldName
            const fields = [...new Set([...qInfo.leafs.map(l => l.fieldName), 'Id'])]
            const parents = qInfo.parents.map(p => {
              const { object, fields, parents } = parseFieldsAndParents(p)
              return parentQuery(object, [...fields, ...parents] as NonEmptyArray<any>)
            })

            return { object, fields, parents }
          }

        const parseQueryInfo = (qInfo: QueryInfo) => {
          const { object, fields, parents } = parseFieldsAndParents(qInfo)
          const children = qInfo.childs.map(parseFieldsAndParents)
          const where = getWhereClause(args)

          return where.map(w => {
            return soqlQuery(object, [...fields, ...parents, ...children] as SOQLQuery['selections'], {
              where: w
            , offset: args.offset
            , limit: args.limit
            , orderBy: args.orderBy
            })
          })
        }

        const queryConfig = parseQueryInfo(queryInfo)
        const queryString = queryConfig.chain(soql)
        const final = queryString.map(executeQuery(process.env.SF_USER!, process.env.SF_PASS!, options))

        // let graphql catch the error and display to end user
        if (final.isLeft()) {
          throw new Error(queryString.value)
        }

        return final.value.then(v => {
          if (info.returnType instanceof GraphQLList) {
            return v.records
          }

          return v.records && v.records[0]
        })
      }

      const resolverMiddleware: Endomorphism<GraphQLFieldConfig<any, any>> = config => ({
        ...config
      , resolve: (source, args, context, info) => {
          const parentObj = info.parentType

          if (parentObj.name === rootQuery.name) {
            return rootResolver(source, args, context, info)
          }

          const fieldSet = getFieldSet(info)
          const parent = info.parentType
          const annotatedFields = annotateFieldSet(parent, fieldSet, objectMap)

          // salesforce returns ISO8601 compatible date. GraphQLISODate expects ISO3339
          // meaning a date such as 2018-06-13T18:24:53.000+0000 won't parse because
          // the offset should be colon separated
          // TODO: Issue a pull request for GraphQLISODate that lets it parse the limited ISO8601 grammar as defined
          // in Appendix a of ISO3339 RFC
          const configField = annotatedFields.configField
          if (configField && isLeafField(configField) && configField.sftype === 'datetime') {
            return source && new Date(source[info.fieldName])
          }

          return source && source[info.fieldName]
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
