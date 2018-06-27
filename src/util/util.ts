import { Refinement, Predicate, tuple } from 'fp-ts/lib/function'
import { ValueNode, StringValueNode, Kind, IntValueNode } from 'graphql'
import { cons, flatten, lefts, rights } from 'fp-ts/lib/Array'
import { Either, left, right } from 'fp-ts/lib/Either'
import { RefinementType1 } from '../types'

export const joinNames = (n: string[], append = ''): string => {
  return n.reduceRight((p, c) =>
    c.substr(0, 1).toUpperCase() + c.substring(1)
  + p.substr(0, 1).toUpperCase() + p.substring(1), append
  )
}

export function mergeObjs<T>(...objs: Array<{ [x: string]: T}>): { [x: string]: T } {
  return Object.assign({}, ...objs)
}

// tslint:disable:max-line-length
export function mapObj<T, U>(f: (value: T, key: string) => U | { key: string, value: U }): (obj: { [x: string]: T }) => { [x: string]: U }
export function mapObj<T, U>(f: (value: T, key: string) => U | { key: string, value: U }, obj: { [x: string]: T }): { [x: string]: U }
export function mapObj<T, U>(f: (value: T, key: string) => U | { key: string, value: U }, obj?: { [x: string]: T }): ((obj: { [x: string]: T }) => { [x: string]: U }) | { [x: string]: U } {
  const fun = (obj: { [x: string]: T }): { [x: string]: U } =>
    mergeObjs(...Object.keys(obj).map(x => {
      const result = f(obj[x], x)
      if (typeof result === 'object' && (result as any).key && typeof (result as any).value !== 'undefined') {
        return { [(result as any).key]: (result as any).value }
      }
      return { [x]: result }
    }))

  switch (arguments.length) {
    case 1: return fun
    // two or greater
    default: return fun(obj!)
  }
}

export function filterObj<T, U extends T = T>(p: Refinement<T, U> | Predicate<T>): (obj: { [x: string]: T }) => { [x: string]: U }
export function filterObj<T, U extends T = T>(p: Refinement<T, U> | Predicate<T>, obj: { [x: string]: T }): { [x: string]: U }
export function filterObj<T, U extends T = T>(p: Refinement<T, U> | Predicate<T>, obj?: { [x: string]: T }): { [x: string]: U } | ((obj: { [x: string]: T }) => { [x: string]: U }) {
  // tslint:enable:max-line-length
  const fun = (obj: { [x: string]: T }): { [x: string]: U } =>
    Object.keys(obj).filter(k => p(obj[k])).reduce((p, c) => {
      // tslint:disable-next-line:no-expression-statement no-object-mutation
      p[c] = obj[c] as U
      return p
    }, {} as { [x: string]: U })

  switch (arguments.length) {
    case 1: return fun
    default: return fun(obj!)
  }
}

export const isStringValueNode = (v: ValueNode): v is StringValueNode =>
  // typescript doesn't reduce valueNode's type unless we cast here
  v.kind === (Kind.STRING as StringValueNode['kind'])

export const isIntValueNode = (v: ValueNode): v is IntValueNode =>
  // typescript doesn't reduce valueNode's type unless we cast here
  v.kind === (Kind.INT as IntValueNode['kind'])

export const unzip = <A, B>(pair: ReadonlyArray<[A, B]>): [A[], B[]] => (
  pair.reduce((p, c) => tuple(cons(c[0], p[0]), cons(c[1], p[1])), [[], []] as [A[], B[]])
)

export const unzipEithers = <L, R>(es: Array<Either<L, R>>): Either<L[], R[]> => {
  // we should be able to optimize this with a generator
  // and length calculation (it will short circuit as soon as we get one left)
  const eitherLefts = lefts(es)
  return eitherLefts.length > 0 ? left(eitherLefts) : right(rights(es))
}

/**
 * Partitions an array into different subarrays using the provided map.
 *
 * `O(n*k)` running time, where `n` is the array size and `k` is the number of keys of the map
 *
 * Example
 *
 * ```ts
 * partition([1, '2', 3, '4'], {
 *  strings: (s): s is string => typeof s === 'string',
 *  numbers: (s): s is number => typeof s === 'number',
 *  }) // { strings: ['2', '4'], numbers: [1, 3] }
 * ```
 * @param as The array
 * @param map A mapping between names and boolean functions.
 *  If the function returns true when provided an element of the array, then that element will be
 *  grouped under that name in the returned map
 * @param exclusive If false indicates that an element can be in multiple groups
 * @returns A mapping from names to selections of the array `as`
 */
export function partition<
                          T,
                          RefMap extends { readonly [key: string]: Refinement<T, T> | Predicate<T> }
                         >(as: ReadonlyArray<T>,
                           map: RefMap,
                           exclusive = true
                          ): { [k in keyof RefMap]: Array<RefinementType1<RefMap[k]>> } {
  // initially we want a map with the same fields as `map` but empty arrays as values
  const initial: ReturnType<typeof partition> = mapObj(() => [], map)

  // for every item in the array,
  // iterate over every function in the map,
  // adding to the corresponding array if the item applied to the function is true
  return as.reduce((p, c) => {
    // tslint:disable-next-line:no-expression-statement
    for (const key of Object.keys(initial)) {
      const fun = map[key]
      if (fun(c)) {
        // tslint:disable-next-line:no-expression-statement
        p[key].push(c)

        // skip the other tests if user elected for exclusive filtering
        if (exclusive) {
          return p
        }
      }
    }

    return p
  }, initial) as any
}

export interface RoseTree<A> {
  rootLabel: A
  subForest: this[]
}

// tslint:disable-next-line:variable-name
export const Node = <A>(rootLabel: A, subForest: Array<RoseTree<A>>): RoseTree<A> => ({ rootLabel, subForest })

/**
 * Finds the maximum height of a rose tree
 * @param t The rose tree
 */
export const maxHeight = (t: RoseTree<any>): number => {
  if (t.subForest.length === 0) return 1
  return 1 + Math.max(...t.subForest.map(t => maxHeight(t)))
}

/**
 * Folds the function f over all the paths of a rose tree
 * @param f The folding function
 * @param init The initial value (used if the rose tree has an empty forest)
 * @param tree The rose tree
 */
export function foldRosePaths<A, B>(f: (a: A, b: B) => B): (init: B) => (tree: RoseTree<A>) => B[]
/**
 * Folds the function f over all the paths of a rose tree
 * @param f The folding function
 * @param init The initial value (used if the rose tree has an empty forest)
 * @param tree The rose tree
 */
export function foldRosePaths<A, B>(f: (a: A, b: B) => B, init: B): (tree: RoseTree<A>) => B[]
/**
 * Folds the function f over all the paths of a rose tree
 * @param f The folding function
 * @param init The initial value (used if the rose tree has an empty forest)
 * @param tree The rose tree
 */
export function foldRosePaths<A, B>(f: (a: A, b: B) => B, init: B, tree: RoseTree<A>): B[]
export function foldRosePaths<A, B>(f: (a: A, b: B) => B, init?: B, tree?: RoseTree<A>): any {
  /*
  https://stackoverflow.com/a/24032528
  Haskell code
  foldRose f z (Node x []) = [f x z]
  foldRose f z (Node x ns) = [f x y | n <- ns, y <- foldRose f z n]
  */
  const fun = (init: B) => (tree: RoseTree<A>): B[] => {
    const x = tree.rootLabel
    const ns = tree.subForest
    if (ns.length === 0) {
      // foldRose f z (Node x []) = [f x z]
      return [f(x, init)]
    } else {
      // foldRose f z (Node x ns) = [f x y | n <- ns, y <- foldRose f z n]
      /* desugar the list comprehension:
        https://patternsinfp.wordpress.com/comprehensions
        e is an expression, q is a sequence of zero or more qualifiers
          a qualifier may be:
            a filter: boolean B
            a generator: (a <- x) where x is a list
          Rules:
            [e | -] = [e] -- (where - is the empty qualifier sequence)
            [e | B] = if B then [e] else []
            [e | a <- x] = map (\a -> e a) x  -- not quite accurate, since 'e' may not be a function that takes 'a'
            [e | q, q'] = concat [[e | q'] | q]

        Translation:
          [f x y | n <- ns, y <- foldRose f z n]
            let q = n <- ns, q' = y <- foldRose f z n, e = f x y
          = concat [[f x y | y <- foldRose f z n] | n <- ns]
          = concat [map (\y -> f x y) (foldRose f z n) | n <- ns]
          = concat [map (f x) (foldRose f z n) | n <- ns]
            let ff = \n -> map (f x) (foldRose f z n)
          = concat [ff n | n <- ns]
          = concat $ map (\n -> ff n) ns
          = concat $ map ff ns
      */
      // fp-ts calls `concat` `flatten` for arrays
      const ff = (n: RoseTree<A>) => foldRosePaths(f, init, n).map(y => f(x, y))
      return flatten(ns.map(ff))
    }

  }

  // allow curried or uncurried application
  switch (arguments.length) {
    case 1: return fun
    case 2: return fun(init!)
    default: return fun(init!)(tree!)
  }
}
