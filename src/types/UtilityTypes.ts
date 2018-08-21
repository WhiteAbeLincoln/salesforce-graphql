export interface NonEmptyArray<T> extends Array<T> {
  0: T
}

type RefinementTag = { REFTAG: 'REFTAG' }

export type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>
export type Overwrite<T extends object, U extends object> = Omit<T, keyof T & keyof U> & U

export type Arg1<T extends (...args: any[]) => any> =
  T extends (a: infer ARG, ...args: any[]) => any ? ARG : never
export type Arg2<T extends (...args: any[]) => any> =
  T extends (a: any, b: infer ARG, ...args: any[]) => any ? ARG : never
export type Arg3<T extends (...args: any[]) => any> =
  T extends (a: any, b: any, c: infer ARG, ...args: any[]) => any ? ARG : never
export type Arg4<T extends (...args: any[]) => any> =
  T extends (a: any, b: any, c: any, d: infer ARG, ...args: any[]) => any ? ARG : never
export type Arg5<T extends (...args: any[]) => any> =
  T extends (a: any, b: any, c: any, d: any, e: infer ARG, ...args: any[]) => any ? ARG : never

export type RefinementTypeTagged1<T extends (...args: any[]) => boolean> =
  T extends (a: any, ...args: any[]) => a is infer R ? R & RefinementTag : Arg1<T>

export type RefinementTypeTagged2<T extends (...args: any[]) => boolean> =
  T extends (a: any, b: any, ...args: any[]) => b is infer R ? R & RefinementTag : Arg2<T>

export type RefinementTypeTagged3<T extends (...args: any[]) => boolean> =
  T extends (a: any, b: any, c: any, ...args: any[]) => c is infer R ? R & RefinementTag : Arg3<T>

export type RefinementTypeTagged4<T extends (...args: any[]) => boolean> =
  T extends (a: any, b: any, c: any, d: any, ...args: any[]) => d is infer R ? R & RefinementTag : Arg4<T>

export type RefinementTypeTagged5<T extends (...args: any[]) => boolean> =
  T extends (a: any, b: any, c: any, d: any, e: any, ...args: any[]) => e is infer R ? R & RefinementTag : Arg5<T>

/** The refined type of the first argument of a function */
export type RefinementType1<T extends (...args: any[]) => boolean> =
  RefinementTypeTagged1<T> extends (infer R & RefinementTag) ? R : RefinementTypeTagged1<T>

/** The refined type of the second argument of a function */
export type RefinementType2<T extends (...args: any[]) => boolean> =
  RefinementTypeTagged2<T> extends infer R & RefinementTag ? R : RefinementTypeTagged2<T>

/** The refined type of the third argument of a function */
export type RefinementType3<T extends (...args: any[]) => boolean> =
  RefinementTypeTagged3<T> extends infer R & RefinementTag ? R : RefinementTypeTagged3<T>

/** The refined type of the fourth argument of a function */
export type RefinementType4<T extends (...args: any[]) => boolean> =
  RefinementTypeTagged4<T> extends infer R & RefinementTag ? R : RefinementTypeTagged4<T>

/** The refined type of the fifth argument of a function */
export type RefinementType5<T extends (...args: any[]) => boolean> =
  RefinementTypeTagged5<T> extends infer R & RefinementTag ? R : RefinementTypeTagged5<T>

/** The refined type of a function */
export type RefinementType<T extends (...args: any[]) => boolean> =
  RefinementTypeTagged1<T> extends infer R & RefinementTag ? R :
  RefinementTypeTagged2<T> extends infer R & RefinementTag ? R :
  RefinementTypeTagged3<T> extends infer R & RefinementTag ? R :
  RefinementTypeTagged4<T> extends infer R & RefinementTag ? R :
  RefinementTypeTagged5<T> extends infer R & RefinementTag ? R :
  any
