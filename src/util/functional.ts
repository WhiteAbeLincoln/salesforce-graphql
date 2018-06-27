import { Function2 } from 'fp-ts/lib/function'

export const flip = <A, B, C>(f: Function2<A, B, C>) => (b: B, a: A) => f(a, b)
export { flip as flipC } from 'fp-ts/lib/function'
