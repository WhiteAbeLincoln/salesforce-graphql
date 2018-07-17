# salesforce-graphql
[![CircleCI](https://circleci.com/gh/WhiteAbeLincoln/salesforce-graphql/tree/master.svg?style=shield)](https://circleci.com/gh/WhiteAbeLincoln/salesforce-graphql/tree/master) [![codecov](https://codecov.io/gh/WhiteAbeLincoln/salesforce-graphql/branch/master/graph/badge.svg)](https://codecov.io/gh/WhiteAbeLincoln/salesforce-graphql) [![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/) [![Greenkeeper badge](https://badges.greenkeeper.io/WhiteAbeLincoln/salesforce-graphql.svg)](https://greenkeeper.io/) 

Create a GraphQL schema for a Salesforce org

## Why?

+ Use tools from the GraphQL ecosystem with salesforce
  - Many developers may not know SOQL but already know GraphQL. They can get up and running fast using salesforce-graphql
  - You can use tools like [apollo]() or [relay]() and access the whole organization, instead of using fetch or xmlhttprequest to query a backend server with predefined queries
  - Visualize your org using existing graphql tools like [graphql-voyager](https://github.com/APIs-guru/graphql-voyager) or [graphqlviz](https://github.com/sheerun/graphqlviz)
+ Overcome some limitations of SOQL
  - SOQL doesn't allow parent queries that query deeper than five levels from the root object. salesforce-graphql splits your graphql query into multiple SOQL requests before resolving to overcome this limitation
  - SOQL doesn't allow nested child queries or nesting a child query within a parent query. salesforce-graphql will split these types of queries into multiple SOQL requests to overcome this limitation

## Usage

See the examples directory for example usage.

## Docs

WIP

## Roadmap

+ [ ] Offset-based Querying
  + [X] Basic Querying
  + [X] Relationship Queries
    + [X] Parent Queries
    + [X] Child Queries
  + [ ] Retrieve all records with queryMore()
  + [ ] Querying for [polymorphic fields](https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/sforce_api_calls_soql_relationships_and_polymorph_keys.htm)
  + [ ] SOQL Function support
    + [ ] Aggregate Functions
      + [ ] AVG()
      + [ ] COUNT()
      + [ ] COUNT(_fieldName_)
      + [ ] COUNT_DISTINCT()
      + [ ] MIN()
      + [ ] MAX()
      + [ ] SUM()
    + [ ] Date Functions
      + [ ] In Queries
      + [ ] In Where Clauses
    + [ ] FORMAT
    + [ ] convertCurrency
  + [ ] Filters
    + [ ] GROUP BY
    + [ ] HAVING
    + [ ] ORDER BY
      + [X] Basic Support
      + [ ] Referencing parent fields
    + [X] LIMIT
    + [X] OFFSET
    + [ ] WITH
    + [ ] FOR _REASON_
  + [ ] Update Tracking and Viewstat
  + [ ] Where clauses
    + [X] Basic support
    + [ ] Reference Parent and Child fields present in query
    + [ ] Semi-join queries
+ [ ] [Cursor-based](https://blog.apollographql.com/understanding-pagination-rest-graphql-and-relay-b10f835549e7) querying
+ [ ] Caching with [dataloader](https://github.com/facebook/dataloader)
