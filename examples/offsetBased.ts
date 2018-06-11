import { describeSalesforceObjects, writeDescribeFiles, importDescribeFiles } from '../build/describe'
import { ConnectionOptions } from 'jsforce'
import { makeObjects, buildGraphQLObjects } from '../build/buildSchema'
import { middleware as offsetMiddleware } from '../build/Pagination/Offset'
import { GraphQLSchema } from 'graphql'
import { mergeObjs } from '../build/util'
import graphqlHTTP from 'express-graphql'
import express from 'express'
import { salesforceObjectConfig, childField } from '../build/types'

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

      const gqlObjects = buildGraphQLObjects([...objects, rootQuery], offsetMiddleware)

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
