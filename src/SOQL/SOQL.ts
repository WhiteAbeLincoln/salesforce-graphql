import { NonEmptyArray } from '../types/UtilityTypes'
import { Either, left, right, Left, Right } from 'fp-ts/lib/Either'
import { flatten } from 'fp-ts/lib/Array'
import { partition, foldRosePaths, unzipEithers, maxHeight } from '../util'
import { compose, pipe } from 'fp-ts/lib/function'
import { WhereTree, parseTree } from './WhereTree'
import { Tree } from 'fp-ts/lib/Tree'
import { Option, none, some } from 'fp-ts/lib/Option'

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
    subFields: isZero<N> extends 'T' ? string[] : Array<string | ParentQuery<Prev<N>>>
  }
*/

// Parent query is a RoseTree<string>
export type ParentQueryValue = { kind: 'object' | 'field', value: string }
export type ParentQuery = Tree<ParentQueryValue>

export function parentQuery(field: string,
                            selections: ReadonlyArray<ParentQuery | string>,
                            unsafe = false): Either<string, ParentQuery> {
  if (selections.length === 0) return left('A parent query must have a non-empty selection set')

  const tree = new Tree({ kind: 'object' as 'object', value: field }
    , selections.map(c =>
      typeof c === 'string'
        ? new Tree({ kind: 'field' as 'field', value: c }, [])
        : c
    )
  )

  if (unsafe) {
    // don't validate height of tree if unsafe is true
    // FIXME: This is a hack to let me parse the graphql query from bottom-up
    // see parseFieldsAndParents in src/util/resolve/execute.ts
    return right(tree)
  }

  return validateParentQuery(tree)
}

export interface SOQLQueryFilters {
  limit?: number
  offset?: number
  scope?: FilterScope
  orderBy?: { fields: NonEmptyArray<string>, dir: 'ASC' | 'DESC', nulls?: 'FIRST' | 'LAST' }
  where?: WhereTree | string
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

export interface TypeofQuery {
  field: 'Owner' | 'Who' | 'What'
  when: NonEmptyArray<{ object: string, fields: NonEmptyArray<string> }>
  else?: NonEmptyArray<string>
}

export const childQuery = (field: string,
                           selections: ReadonlyArray<ParentQuery | string>,
                           filters?: SOQLQueryFilters
                          ): Either<string, ChildQuery> => (
  soqlQuery(field, selections, filters).map(c =>
    ({
      ...(c as ChildQuery)
    , kind: 'child' as 'child'
    })
  )
)

export type QuerySelection = ParentQuery | ChildQuery | TypeofQuery | string

export const soqlQuery = (object: string,
                          selections: ReadonlyArray<QuerySelection>,
                          filters?: SOQLQueryFilters
                         ): Either<string, SOQLQuery> => {
  if (selections.length === 0) {
    return left('Must select at least one field, child query, or parent query')
  }

  return right(
    { object
    , selections: selections as NonEmptyArray<QuerySelection>
    , ...filters
    }
  )
}

/**
 * Flattens a rose tree into its paths as strings
 * @param a A parent query rose tree
 * @returns An array of the paths from the root to every leaf as dot separated strings
 */
const flattenParentQuery = compose(
  // we will have extra periods at the end of every path. strip those
  (xs: string[]) => xs.map(x => x.substr(0, x.length - 1)),
  foldRosePaths((a: string, b) => `${a}.${b}`, ''),
  (t: ParentQuery) => t.map(v => v.value)
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
  const partitioned = partition(query.selections, {
    children: (q): q is ChildQuery => typeof q !== 'string' && (q as any).kind === 'child'
  , parents: (q): q is ParentQuery => typeof q !== 'string' && q instanceof Tree
  , typeof: (q): q is TypeofQuery => typeof q !== 'string' && (q as any).when && (q as any).field
  , fields: (q): q is string => typeof q === 'string'
  })

  const pqs
    = flatten(partitioned.parents.map(flattenParentQuery))
      // No more than 35 child-to-parent relationships can be specified in a query
  const parentQueries
    = pqs.length > 35
        ? left(
            ['No more than 35 child-to-parent relationships can be specified in a query']
          ) as Left<string[], string[]>
        : right(pqs) as Right<string[], string[]>

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
  pipe(
  /* SELECT   */   s => `SELECT ${s.join(', ')}`
  /* TYPEOF   */ , append(partitioned.typeof.length > 0 && partitioned.typeof.map(parseTypeof).join('\n'))
  /* FROM     */ , append(`FROM ${query.object}`)
  )
  /* SCOPE    */ , append(typeof query.scope === 'string' && `USING SCOPE ${query.scope}`)
  /* WHERE    */ , append(typeof query.where !== 'undefined'
    && getWhere(query.where).map(w => `WHERE ${w}`).getOrElse(''))
  /* WITH     */
  /* GROUP BY */
  /* ORDER BY */ , append(
      typeof query.orderBy !== 'undefined'
        // tslint:disable-next-line:max-line-length
        && `ORDER BY ${query.orderBy.fields.join(', ')} ${query.orderBy.dir}${query.orderBy.nulls ? ' NULLS ' + query.orderBy.nulls : ''}`)
  /* LIMIT    */ , append(typeof query.limit === 'number' && `LIMIT ${query.limit}`)
  /* OFFSET   */ , append(typeof query.offset === 'number' && `OFFSET ${query.offset}`)
  /* FOR      */ , append(typeof query.for !== 'undefined' && `FOR ${[...new Set(query.for)].join(', ')}`)
  /* UPDATE   */ , append(
      typeof query.update !== 'undefined'
        && `UPDATE ${[...new Set(query.update)].join(', ')}`)
    ))
    .mapLeft(s => s.join('\n')) // join errors with newline
}

const parseTypeof = (query: TypeofQuery): string => (
`TYPEOF ${query.field}
  ${query.when.map(w =>
  `WHEN ${w.object} THEN ${w.fields.join(', ')}`
  ).join('\n')}
  ${query.else ?
  `ELSE ${query.else.join(', ')}`
  : ''}
END
`
)

const getWhere = (where: string | WhereTree): Option<string> => {
  const whereStr = typeof where === 'string' ? where : parseTree(where)

  return whereStr === '' ? none : some(whereStr)
}

const append = (appendStr: string | undefined | null | false) => (prependStr: string) =>
  appendStr ? `${prependStr} ${appendStr}` : prependStr
