import { Option, isSome } from 'fp-ts/lib/Option'
import { Refinement } from 'fp-ts/lib/function'
import { ValueNode, StringValueNode, Kind, IntValueNode } from 'graphql'

export const somes = <T>(options: Array<Option<T>>): T[] => {
  return options.filter(isSome).map(o => o.value)
}

export const joinNames = (n: string[], append = ''): string => {
  return n.reduceRight((p, c) =>
    c.substr(0, 1).toUpperCase() + c.substring(1)
  + p.substr(0, 1).toUpperCase() + p.substring(1), append
  )
}

export const mergeObjs = <T>(objs: Array<{ [x: string]: T}>): { [x: string]: T } => (
  Object.assign({}, ...objs)
)

export const mapObj = <T, U>(f: (value: T, key: string) => U | { key: string, value: U }) =>
  (obj: { [x: string]: T }): { [x: string]: U } => (
    mergeObjs(Object.keys(obj).map(x => {
      const result = f(obj[x], x)
      if (typeof result === 'object' && (result as any).key && typeof (result as any).value !== 'undefined') {
        return { [(result as any).key]: (result as any).value }
      }
      return { [x]: result }
    }))
)

export const filterObj = <T, U extends T = T>(p: Refinement<T, U>) => (obj: { [x: string]: T }): { [x: string]: U } => (
  Object.keys(obj).filter(k => p(obj[k])).reduce((p, c) => {
    // tslint:disable-next-line:no-expression-statement no-object-mutation
    p[c] = obj[c] as U
    return p
  }, {} as { [x: string]: U })
)

export const isStringValueNode = (v: ValueNode): v is StringValueNode =>
  // typescript doesn't reduce valueNode's type unless we cast here
  v.kind === (Kind.STRING as StringValueNode['kind'])

export const isIntValueNode = (v: ValueNode): v is IntValueNode =>
  // typescript doesn't reduce valueNode's type unless we cast here
  v.kind === (Kind.INT as IntValueNode['kind'])
