import { Function2, Predicate, Refinement, curry, Curried2 } from 'fp-ts/lib/function'
import { Semigroup } from 'fp-ts/lib/Semigroup'
import { URIS, Type, HKT } from 'fp-ts/lib/HKT'
import { Foldable1, Foldable, foldr } from 'fp-ts/lib/Foldable'
import { none, some, Option } from 'fp-ts/lib/Option'

export const flip = <A, B, C>(f: Function2<A, B, C>) => (b: B, a: A) => f(a, b)
export { flip as flipC } from 'fp-ts/lib/function'

export function and<A, B extends A, C extends B>(p1: Refinement<A, B>, p2: Refinement<B, C>): Refinement<A, C>
export function and<A, B extends A>(p1: Refinement<A, B>, p2: Predicate<B>): Refinement<A, B>
export function and<A, B extends A>(p1: Predicate<A>, p2: Refinement<A, B>): Refinement<A, B>
export function and<A>(p1: Predicate<A>, p2: Predicate<A>): Predicate<A>
export function and<A>(p1: Predicate<A>, p2: Predicate<A>): Predicate<A> {
  return (a: A) => p1(a) && p2(a)
}

export const concat = <A>(S: Semigroup<A>) => curry(S.concat)

// tslint:disable-next-line:max-line-length
export function foldr1<F extends URIS>(F: Foldable1<F>): <A, B>(f: Function2<A, B, B> | Curried2<A, B, B>) => (fa: Type<F, A>) => B
export function foldr1<F>(F: Foldable<F>): <A, B>(f: Function2<A, B, B>) => (fa: HKT<F, A>) => B
export function foldr1<F>(F: Foldable<F>): <A, B>(f: Function2<A, B, B>) => (fa: HKT<F, A>) => B {
  return <A, B>(f: Function2<A, B, B>) => (xs: HKT<F, A>) => {
    const mf = (x: A, m: Option<B>) => some(m.isNone() ? x : f(x, m.value))

    return foldr(F)(xs, none, mf as any).getOrElseL(() => { throw new Error('foldr1: empty structure') }) as any
  }
}

// tslint:disable-next-line:max-line-length
export function foldr1C<F extends URIS>(F: Foldable1<F>): <A, B>(f: Curried2<A, B, B> | Curried2<A, B, B>) => (fa: Type<F, A>) => B
export function foldr1C<F>(F: Foldable<F>): <A, B>(f: Curried2<A, B, B>) => (fa: HKT<F, A>) => B
export function foldr1C<F>(F: Foldable<F>): <A, B>(f: Curried2<A, B, B>) => (fa: HKT<F, A>) => B {
  return <A, B>(f: Curried2<A, B, B>) => {
    const fn: Function2<A, B, B> = (a, b) => f(a)(b)

    return foldr1(F)(fn)
  }
}
