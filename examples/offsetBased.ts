import { describeSalesforceObjects, writeDescribeFiles, importDescribeFiles } from '../src/describe'
import { ConnectionOptions } from 'jsforce'
import { buildSchema } from '../src/Pagination/Offset/Build'
import { resolver } from '../src/Pagination/Offset/Resolve'
import { GraphQLSchema } from 'graphql'
import graphqlHTTP from 'express-graphql'
import express from 'express'
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

    const rootQuery = fetchDescribes(false).then(buildSchema(resolver(login)))

    const app = express()

    // tslint:disable-next-line:no-expression-statement
    app.use('/graphql', graphqlHTTP(
      rootQuery.then(query => {
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
