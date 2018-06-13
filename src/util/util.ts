import { Refinement, Predicate, tuple } from 'fp-ts/lib/function'
import { ValueNode, StringValueNode, Kind, IntValueNode } from 'graphql'
import { cons } from 'fp-ts/lib/Array'

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

  return typeof obj === 'undefined' ? fun : fun(obj)
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

  return typeof obj === 'undefined' ? fun : fun(obj)
}

export const isStringValueNode = (v: ValueNode): v is StringValueNode =>
  // typescript doesn't reduce valueNode's type unless we cast here
  v.kind === (Kind.STRING as StringValueNode['kind'])

export const isIntValueNode = (v: ValueNode): v is IntValueNode =>
  // typescript doesn't reduce valueNode's type unless we cast here
  v.kind === (Kind.INT as IntValueNode['kind'])

export const unzip = <A, B>(pair: Array<[A, B]>): [A[], B[]] => (
  pair.reduce((p, c) => tuple(cons(c[0], p[0]), cons(c[1], p[1])), [[], []] as [A[], B[]])
)
