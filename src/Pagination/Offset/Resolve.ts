import { getFieldSet } from '../../util'
import { annotateFieldSet, AnnotatedFieldSet, AnnotatedConcreteFieldSetCondition } from '../../util/resolve/annotate'
import { getQueryInfo, parseChildren,
  parseFieldsAndParents, ConcreteQueryInfo, ConditionalQueryInfo} from '../../util/resolve/execute'
import { Either, right, left, either } from 'fp-ts/lib/Either'
import { isChildField, isParentField, isLeafField, ResolverMiddleware } from '../../types'
import { getWhereClause } from '../../util/GraphQLWhere/Parse'
import { singleton, getFakeSemigroup, getMonoid, BiTree, Node } from '../../util/BinaryTree'
import { BooleanExpression, WhereTree, BooleanOp, parseTree } from '../../SOQL/WhereTree'
import { soqlQuery, soql } from '../../SOQL/SOQL'
import { partitionMap, flatten, array } from 'fp-ts/lib/Array'
import { sequence } from 'fp-ts/lib/Traversable'
import { identity, pipe } from 'fp-ts/lib/function'
import { getRecordMonoid, getArrayMonoid } from 'fp-ts/lib/Monoid'
import { liftA2 } from 'fp-ts/lib/Apply'
import { concat, foldr1C } from '../../util/functional'
import { GraphQLObjectType } from 'graphql'

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
  const parentObj = annotatedFields.parentConfigObj!.name

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
    .map(pipe(
      queryFun(context),
      p => p.then(v => {
        // this really shouldn't happen, since we already got a parent
        // object with this id in a previous query, so this query should give a result
        /* istanbul ignore if */
        if (!v || v.length === 0) return null

        // because we filter by Id then there should only be one result
        return v[0][queryInfo.field.fieldName]
      })
    ))
}

const basicRequest
  = (queryInfo: ConcreteQueryInfo,
     whereMap: (w: string | WhereTree) => string | WhereTree = identity) => {
      return parseFieldsAndParents(queryInfo).chain(({ object, fields, parents, args }) =>
        parseChildren(queryInfo.childs).chain(cs =>
          getWhereClause(args)
            .map(whereMap)
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
    }

type BranchRequest = {
  where: BiTree<BooleanOp | BooleanExpression>
  parents: Array<{ p: ConcreteQueryInfo, type: GraphQLObjectType }>
}

const branchMappingFun = (p: ConcreteQueryInfo) => (b: ConditionalQueryInfo): BranchRequest => {
  const polymorphicField = p.field.fieldName
  const objectConfig = (b.field as AnnotatedConcreteFieldSetCondition).typeConfig
  const newParent = {
    ...p
  , leafs: [...p.leafs, ...b.leafs]
  , childs: [...p.childs, ...b.childs]
  , parents: [...p.parents, ...b.parents]
  , branches: []
  }

  const whereLeaf: BiTree<BooleanOp | BooleanExpression> = singleton<BooleanExpression>({
    field: `${polymorphicField}.Type`,
    op: '=',
    value: objectConfig.name
  })

  return { parents: [{ p: newParent, type: b.field.type as GraphQLObjectType }], where: whereLeaf }
}

const monoid = getRecordMonoid<BranchRequest>({
  where: getMonoid(getFakeSemigroup<BooleanOp | BooleanExpression>('AND' as 'AND'))
, parents: getArrayMonoid()
})

const prod = liftA2(array)(concat(monoid))
const getCombinations = foldr1C(array)(prod)

const rootResolver = (
  context: any,
  annotatedFields: AnnotatedFieldSet,
  queryFun: (context: any) => (query: string) => Promise<any[] | null>
) => {
  const queryInfo = getQueryInfo(annotatedFields)

  const parents = partitionMap(queryInfo.parents,
    (p): Either<ConcreteQueryInfo, ConcreteQueryInfo> => p.field.kind === 'abstract' ? left(p) : right(p)
  )

  // abstract parents
  if (parents.left.length > 0) {
    // we combine the parents into a single request using AND where query
    // we have to create all combinations of branches with parent requests
    /* for a request like
      enemy {
        ... on Sith
        ... on Jedi
      }
      friend {
        ... on Jedi
      }
      we recieve something like the following from mapping over our parents and their branches
      [
        [ {where enemy.Type = Sith}, {where enemy.Type = Jedi} ]
        [ {where friend.Type = Jedi} ]
      ]

      we need to produce the following
      [ {where enemy.Type = Sith AND friend.type = Jedi}, {where enemy.Type = Jedi AND friend.type = Jedi} ]

      This is the cartesian product
      in haskell we do:

      > import Control.Applicative
      > let first = ["enemy.Type = Sith", "enemy.Type = Jedi"]
      > let second = ["friend.Type = Jedi"]
      > prod fst snd = (\a b -> a ++ " AND " ++ b) <$> fst <*> snd
      > prod first second

      ["enemy.Type = Sith AND friend.Type = Jedi", "enemy.Type = Jedi AND friend.Type = Jedi"]

      notice that this is the definition of liftA2
      liftA2 f x y = f <$> x <*> y
      therefore

      > prod = liftA2 (\a b -> a ++ " AND " ++ b)

      notice that ++ is `mappend` for lists
      if we create a monoid instance for our returned object, then the command should be as simple as
      prod = liftA2 mappend

      we can fold the list of lists to apply our cartesian product function over every one

      > let combs = [first, second, ["mentor.Type = Sith"]]
      > foldr1 prod combs

      ["enemy.Type = Sith AND friend.Type = Jedi AND mentor.Type = Sith",
        "enemy.Type = Jedi AND friend.Type = Jedi AND mentor.type = Sith"]
    */

    const combs = getCombinations(parents.left.map(p => p.branches.map(branchMappingFun(p))))
    const queries = combs
                    .map(query => {
                      const combinedQueryInfo = {
                        ...queryInfo
                      , parents: [...parents.right, ...query.parents.map(p => p.p)]
                      , branches: []
                      }

                      const fieldMappings = query.parents.map(p => ({ field: p.p.field.fieldName, type: p.type }))

                      const whereLeaf = query.where
                      return basicRequest(combinedQueryInfo, w =>
                        typeof w === 'string' ? `(( ${w} ) AND ${parseTree(whereLeaf)})`
                        : w.isLeaf()          ? whereLeaf
                        : new Node('AND' as 'AND', w, whereLeaf)
                      )
                      .chain(soql)
                      .map(pipe(
                        queryFun(context),
                        p => p.then(v =>
                          v && v.map(v =>
                            fieldMappings.reduce((value, field) => ({
                              ...value
                            , [field.field]: { ...value[field.field], __gqltype: field.type }
                            }), v)
                          )
                        )
                      ))
                    })

    return sequence(either, array)(queries).map(pipe(
      ps => Promise.all(ps),
      p => p.then(vs => {
      const combArr: Array<{Id: string}> = flatten(vs.filter((v): v is any[] => v !== null))
      // we need to merge elements with the same id so that the resolver works
      const hash = combArr.reduce((map, c) => {
        return map.set(c.Id, Object.assign(map.get(c.Id) || {}, c))
      }, new Map())
      return hash.values()
    })))
  }

  // concrete
  return basicRequest(queryInfo)
      .chain(soql)
      .map(queryFun(context))
}

const parentResolver = (
  source: any,
  context: any,
  annotatedFields: AnnotatedFieldSet,
  queryFun: (context: any) => (query: string) => Promise<any[] | null>
) => {
  // TODO: Handle polymorphic relationships
  // TODO: Remove code duplication between this and rootResolver
  const queryInfo = getQueryInfo(annotatedFields)
  const parentObj = annotatedFields.parentConfigObj.name
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
  .map(pipe(
    queryFun(context),
    ps => ps.then(v =>
      // parent resolvers will always return an object
      v && v[0]
    )
  ))
}

export const resolver
  = (queryFun: (context: any) => (query: string) => Promise<any[] | null>): ResolverMiddleware =>
    (rootQuery, objectMap) =>
    (source, _args, context, info) => {
      const parentObj = info.parentType
      const annotatedFields = annotateFieldSet(parentObj, getFieldSet(info), objectMap)

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
