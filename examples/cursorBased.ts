import { makeObjects, buildGraphQLObjects } from '../src/buildSchema'
import { createConnections, middleware as cursorMiddleware } from '../src/Pagination/Cursor'
import { describeSalesforceObjects, writeDescribeFiles, importDescribeFiles } from '../src/describe'
import {  mergeObjs, getFieldSet } from '../src/util'
import { ConnectionOptions } from 'jsforce'
import express from 'express'
import graphqlHTTP, { OptionsResult } from 'express-graphql'
import { GraphQLSchema, GraphQLFieldConfig } from 'graphql'
import { flatten } from 'fp-ts/lib/Array'
import { childField, salesforceObjectConfig, BuildObjectsMiddleware } from '../src/types'
import { Endomorphism } from 'fp-ts/lib/function'

if (process.env.SF_USER
  && process.env.SF_PASS
  && process.env.SF_URL
  && process.env.SF_ENV) {

    // get the describe objects from disk or online
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

    const schema = fetchDescribes(false).then(descs => {
      const objects = makeObjects(descs)

      const rootQuery = salesforceObjectConfig(
        'SalesforceQuery'
      , 'Query Salesforce'
      , mergeObjs(...objects.map(c => ({ [c.name]: childField(c.name, c.description) })))
      )

      // use cursor style pagination
      const connectionConfigs = flatten(createConnections([...objects, rootQuery]))

      const resolverMiddleware: Endomorphism<GraphQLFieldConfig<any, any>> = config => ({
        ...config
      , resolve: (_source, _args, _context, info) => {
          // tslint:disable-next-line:no-console
          console.log(info)
          // tslint:disable-next-line:no-console
          console.log(getFieldSet(info))
        }
      })

      const middleware: BuildObjectsMiddleware = (field, fields, parent, objectMap) =>
        resolverMiddleware(cursorMiddleware(field, fields, parent, objectMap))

      const gqlObjects = buildGraphQLObjects([...connectionConfigs, ...objects, rootQuery], middleware)

      const queryObject = gqlObjects[1].SalesforceQuery

      return queryObject
    })

    const app = express()
    // tslint:disable-next-line:no-expression-statement
    app.use('/graphql', graphqlHTTP(
      schema.then(query => {
        const schema = new GraphQLSchema({
          query
        })
        // tslint:disable-next-line:no-console
        console.log('Server is ready')
        return {
          schema
        , graphiql: true
        }
      }) as OptionsResult
    ))

    // tslint:disable-next-line:no-expression-statement
    app.listen(process.env.PORT || 4000)
} else {
  // tslint:disable-next-line:no-console
  console.error('ERROR, env vars not specified')
}