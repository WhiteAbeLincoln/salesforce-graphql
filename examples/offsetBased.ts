import { describeSalesforceObjects, writeDescribeFiles, importDescribeFiles } from '../src/describe'
import { ConnectionOptions } from 'jsforce'
import { makeObjects, buildGraphQLObjects } from '../src/buildSchema'
import { middleware as offsetMiddleware } from '../src/Pagination/Offset'
import { resolver } from '../src/Pagination/Offset/Resolve'
import { GraphQLSchema, GraphQLFieldConfig } from 'graphql'
import { mergeObjs } from '../src/util'
import graphqlHTTP from 'express-graphql'
import express from 'express'
import { salesforceObjectConfig, childField, BuildObjectsMiddleware } from '../src/types'
import { Endomorphism } from 'fp-ts/lib/function'
import { GetExecutionInfo } from '../src/util/resolve/execute'

if (process.env.SF_USER
  && process.env.SF_PASS
  && process.env.SF_URL
  && process.env.SF_ENV) {
    const options: ConnectionOptions = {
      loginUrl: process.env.SF_URL
    , instanceUrl: process.env.SF_ENV
    }
    // tslint:disable:no-console

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

      const login: GetExecutionInfo = context => {
        // tslint:disable:no-expression-statement no-object-mutation
        if (!context.sf_user) {
          context.sf_user = process.env.SF_USER!
        }

        if (!context.sf_pass) {
          context.sf_pass = process.env.SF_PASS!
        }

        if (!context.sf_options) {
          context.sf_options = options
        }

        return { username: context.sf_user, password: context.sf_pass, options: context.sf_options }
        // tslint:enable:no-expression-statement no-object-mutation
      }

      const resolverMiddleware: Endomorphism<GraphQLFieldConfig<any, any>> = config => ({
        ...config
      , resolve: resolver(rootQuery, objectMap, login)
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
