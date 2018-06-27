import { NonEmptyArray } from '../types/UtilityTypes'
import { Either, left, right, Left, Right } from 'fp-ts/lib/Either'
import { flatten } from 'fp-ts/lib/Array'
import { partition, RoseTree, foldRosePaths, unzipEithers, maxHeight } from '../util'
import { compose, pipe } from 'fp-ts/lib/function'
import { WhereTree, parseTree } from './WhereTree'

export type FilterScope =
  | 'Delegated'
  | 'Everything'
  | 'Mine'
  | 'My_Territory'
  | 'My_Team_Territory'
  | 'Team'

// I would have tried Peano numbers here, but typescript stops evaluating after about three levels of nesting
/*
  interface ParentQuery<N extends Nat = Four> {
    field: string,
    subFields: isZero<N> extends 'T' ? string[] : string[] | ParentQuery<Prev<N>>
  }
*/

// Parent query is a RoseTree<string>
export interface ParentQuery extends RoseTree<string> {
  kind: 'parent'
}

// because we accept strings as subForests, and transform them into ParentQuery objects without children internally,
// there is no need to accept empty arrays for children
export const parentQuery = (field: string, children: NonEmptyArray<ParentQuery | string>): ParentQuery => ({
  kind: 'parent'
, rootLabel: field
, subForest: children.map(c =>
    typeof c === 'string'
      ? parentQuery(c, [] as any) // fudge a little since we do want an empty array here
      : c
  )
})

export interface SOQLQueryFilters {
  limit?: number
  offset?: number
  scope?: FilterScope
  orderBy?: { dir: 'ASC' | 'DESC', nulls?: 'FIRST' | 'LAST' }
  where?: WhereTree
  for?: NonEmptyArray<'VIEW' | 'REFERENCE' | 'UPDATE'>
  update?: NonEmptyArray<'TRACKING' | 'VIEWSTAT'>
}

export interface SOQLQuery extends SOQLQueryFilters {
  object: string
  selections: NonEmptyArray<QuerySelection>
}

export interface ChildQuery extends SOQLQuery {
  kind: 'child'
  // you can't nest a child query, so limit our possible selections to fields or parent queries
  selections: NonEmptyArray<ParentQuery | string>
}

export const childQuery = (field: string,
                           selections: NonEmptyArray<ParentQuery | string>,
                           filters?: SOQLQueryFilters
                          ): ChildQuery => ({
  ...soqlQuery(field, selections, filters) as ChildQuery,
  kind: 'child'
})

export type QuerySelection = ParentQuery | ChildQuery | string

export const soqlQuery = (object: string,
                          selections: NonEmptyArray<QuerySelection>,
                          filters?: SOQLQueryFilters
                         ): SOQLQuery => ({
  object
, selections
, ...filters
})

/**
 * Flattens a rose tree into its paths as strings
 * @param a A parent query rose tree
 * @returns An array of the paths from the root to every leaf as dot separated strings
 */
const flattenParentQuery = compose(
  // we will have extra periods at the end of every path. strip those
  (xs: string[]) => xs.map(x => x.substr(0, x.length - 1)),
  foldRosePaths((a: string, b) => `${a}.${b}`, '')
)

/**
 * Ensures a parent query does not query more than 5 levels away from the root SObject
 * @param query The parent query
 */
const validateParentQuery = (query: ParentQuery): Either<string, ParentQuery> => (
  maxHeight(query) > 5
    ? left('Cannot query foreign key relationships more than 5 levels away from the root SObject')
    : right(query)
)

export const soql = (query: SOQLQuery | ChildQuery): Either<string, string> => {
  if (query.selections.length === 0) {
    return left(`Must specify at least one of 'fields', 'childQueries', or 'parentQueries'`)
  }

  const partitioned = partition(query.selections, {
    children: (q): q is ChildQuery => typeof q !== 'string' && q.kind === 'child'
  , parents: (q): q is ParentQuery => typeof q !== 'string' && q.kind === 'parent'
  , fields: (q): q is string => typeof q === 'string'
  })

  const parentQueries
    = unzipEithers(
        // Validate that our parentQueries (if any) are not nested more than 5 times
        // preferably this would be done in the type system, but its not possible in typescript
        partitioned.parents.map(validateParentQuery)
      )
      .map(pqs => flatten(pqs.map(flattenParentQuery)))
      // No more than 35 child-to-parent relationships can be specified in a query
      .chain(pqs =>
          pqs.length > 35
            ? left(
                ['No more than 35 child-to-parent relationships can be specified in a query']
              ) as Left<string[], string[]>
            : right(pqs) as Right<string[], string[]>
        )

  const fields = right(partitioned.fields) as Right<string[], string[]>

  const childQueries
    = ((partitioned.children.length > 20 // validate the number of child queries
        ? left(['No more than 20 parent-to-child relationships can be specified in a query'])
        : right(partitioned.children)) as Either<string[], ChildQuery[]>
      )
      .chain(cs => unzipEithers(cs.map((c): Either<string, ChildQuery> =>
          typeof c.offset === 'number' && query.limit !== 1
            ? left('A subquery can use OFFSET only if the parent query has a LIMIT 1 clause')
            : right(c)
        ))
      )
      .chain(cs => unzipEithers(cs.map(soql))) // get a full soql query string for each child query
      .map(cs => cs.map(c => `(${c})`)) // wrap the child query string with grouping parens

  const combined = unzipEithers([ fields, parentQueries, childQueries ])
                    .map(flatten)
                    .mapLeft(flatten)

  return combined
    .map(pipe(
  /* SELECT   */   s => `SELECT ${s.join(', ')}`
  /* TYPEOF   */
  /* FROM     */ , append(`FROM ${query.object}`)
  /* SCOPE    */ , append(typeof query.scope === 'string' && `USING SCOPE ${query.scope}`)
  /* WHERE    */ , append(typeof query.where !== 'undefined' && `WHERE ${parseTree(query.where)}`)
  /* WITH     */
  /* GROUP BY */
  /* ORDER BY */ , append(
      typeof query.orderBy !== 'undefined'
        && `ORDER BY ${query.orderBy.dir}${query.orderBy.nulls ? ' ' + query.orderBy : ''}`)
  /* LIMIT    */ , append(typeof query.limit === 'number' && `LIMIT ${query.limit}`)
  /* OFFSET   */ , append(typeof query.offset === 'number' && `OFFSET ${query.offset}`)
  /* FOR      */ , append(typeof query.for !== 'undefined' && `FOR ${[...new Set(query.for)].join(', ')}`)
  /* UPDATE   */ , append(
      typeof query.update !== 'undefined'
        && `UPDATE ${[...new Set(query.update)].join(', ')}`)
    ))
    .mapLeft(s => s.join('\n')) // join errors with newline
}

const append = (appendStr: string | undefined | null | false) => (prependStr: string) =>
  appendStr ? `${prependStr} ${appendStr}` : prependStr
