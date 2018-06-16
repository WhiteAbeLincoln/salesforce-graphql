import { NonEmptyArray } from '../types/UtilityTypes'
import { Either, left, right, Left, Right } from 'fp-ts/lib/Either'
import { flatten } from 'fp-ts/lib/Array'
import { partition, RoseTree, foldRose, unzipEithers, maxHeight } from './util'
import { compose } from 'fp-ts/lib/function'

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

interface SOQLQueryBase {
  object: string
  selections: NonEmptyArray<QuerySelection>
  limit?: number
  offset?: number
}

export interface ChildQuery extends SOQLQueryBase {
  kind: 'child'
  // you can't nest a child query
  selections: NonEmptyArray<ParentQuery | string>
}

export type QuerySelection = ParentQuery | ChildQuery | string

export interface SOQLQuery extends SOQLQueryBase {
  object: string
  limit?: number
  offset?: number
}

const flattenParentQuery = compose(
  // we will have extra periods at the end of every path. strip those
  (xs: string[]) => xs.map(x => x.substr(0, x.length - 1)),
  foldRose((a: string, b) => `${a}.${b}`, '')
)

const validateParentQuery = (query: ParentQuery): Either<string, ParentQuery> => {
  if (maxHeight(query) > 5) {
    return left('Cannot query foreign key relationships more than 5 levels away from the root SObject')
  }

  return right(query)
}

export const soql = (query: SOQLQuery | ChildQuery): Either<string, string> => {
  if (query.selections.length === 0) {
    return left(`Must specify at least one of 'fields', 'childQueries', or 'parentQueries'`)
  }

  const partitioned = partition(query.selections, {
    children: (q): q is ChildQuery => typeof q !== 'string' && q.kind === 'child'
  , parents: (q): q is ParentQuery => typeof q !== 'string' && q.kind === 'parent'
  , fields: (q): q is string => typeof q === 'string'
  })

  // 1. Validate that our parentQueries (if any) are not nested more than 5 times
  // preferably this would be done in the type system, but its not possible in typescript
  const parentQueries
    = unzipEithers(
        (partitioned.parents as ParentQuery[])
          .map(validateParentQuery)
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

  const fields = partitioned.fields

  // this immediately evaluated function is a horrible hack to let me have a local variable binding
  // within the ternary. We need /if expressions/, not /if statements/
  const childQueriesTemp: Either<string[], ChildQuery[]>
    = partitioned.children.length > 20
      ? left(['No more than 20 parent-to-child relationships can be specified in a query'])
      : right(partitioned.children)

  const childQueries = childQueriesTemp.chain(cs => unzipEithers(cs.map(soql))).map(cs => cs.map(c => `(${c})`))

  const combined = unzipEithers([ parentQueries, childQueries, right(fields) as Right<string[], string[]> ])
                    .map(flatten)
                    .mapLeft(flatten)

  return combined
    .map(s => `SELECT ${s.join(', ')} FROM ${query.object}`)
    .map(s => query.limit ? `${s} LIMIT ${query.limit}` : s)
    .map(s => query.offset ? `${s} OFFSET ${query.offset}` : s)
    .mapLeft(s => s.join('\n'))
}
