import { describeSalesforceObjects, writeDescribeFiles, importDescribeFiles } from '../src/describe'
import { ConnectionOptions } from 'jsforce'
import { makeObjects, buildGraphQLObjects } from '../src/buildSchema'
import { middleware as offsetMiddleware } from '../src/Pagination/Offset'
import { GraphQLSchema, GraphQLFieldConfig } from 'graphql'
import { mergeObjs, getFieldSet } from '../src/util'
import { annotateFieldSet, AnnotatedFieldSet } from '../src/util/resolve'
import graphqlHTTP from 'express-graphql'
import express from 'express'
import { salesforceObjectConfig, childField, BuildObjectsMiddleware,
  isLeafField, isChildField, isParentField } from '../src/types'
import { Endomorphism } from 'fp-ts/lib/function'

if (process.env.SF_USER
  && process.env.SF_PASS
  && process.env.SF_URL
  && process.env.SF_ENV) {
    const fetchDescribes = (online: boolean, path = `${process.env.HOME}/Documents/describes`) => {
      if (online) {
        const options: ConnectionOptions = {
          loginUrl: process.env.SF_URL
        , instanceUrl: process.env.SF_ENV
        }

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

      const resolverMiddleware: Endomorphism<GraphQLFieldConfig<any, any>> = config => ({
        ...config
      , resolve: (source, _args, _context, info) => {
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

          const queryInfo = (field: AnnotatedFieldSet): QueryInfo => {
            const leafFields = field.children!.filter(c => c.configField && isLeafField(c.configField))
            const childFields = field.children!.filter(c => c.configField && isChildField(c.configField))
            const parentFields = field.children!.filter(c => c.configField && isParentField(c.configField))

            return {
                leafs: leafFields
              , childs: childFields.map(queryInfo)
              , parents: parentFields.map(queryInfo)
              , field
              }
          }

          console.log(queryInfo(annotatedFields))
          /* parsing query info into soql queries
              is there any way we can make it a curried function?
              just do function application until it executes
            1. we can represent it as a tree, with root being a query that can be executed immediately
              and sub-trees as queries that depend on info from the root
            2. sibling queries should be able to be executed in parallel
            3. we always query the id field
          */
          const parseQueryInfo = (qInfo: QueryInfo) => {
            const sfobjectName = qInfo.field.parentObj && qInfo.field.parentObj.name
            if (!sfobjectName) throw new Error('BLAHH')

          }
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
