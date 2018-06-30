import { Function2, Predicate, Refinement } from 'fp-ts/lib/function'

export const flip = <A, B, C>(f: Function2<A, B, C>) => (b: B, a: A) => f(a, b)
export { flip as flipC } from 'fp-ts/lib/function'

export function and<A, B extends A, C extends B>(p1: Refinement<A, B>, p2: Refinement<B, C>): Refinement<A, C>
export function and<A, B extends A>(p1: Refinement<A, B>, p2: Predicate<B>): Refinement<A, B>
export function and<A, B extends A>(p1: Predicate<A>, p2: Refinement<A, B>): Refinement<A, B>
export function and<A>(p1: Predicate<A>, p2: Predicate<A>): Predicate<A>
export function and<A>(p1: Predicate<A>, p2: Predicate<A>): Predicate<A> {
  return (a: A) => p1(a) && p2(a)
}
