import { Node, BiTree } from '../util/BinaryTree'

export type ScalarComparisonOp = '>' | '<' | '>=' | '<=' | '=' | '!=' | 'LIKE'
export type ArrayComparisonOp = 'IN' | 'NOT IN'
export type MPicklistComparisonOp = 'INCLUDES' | 'EXCLUDES'
export type ComparisonOp = ScalarComparisonOp | ArrayComparisonOp | MPicklistComparisonOp

type OpPair<V, O> = { value: V, op: O }

export type ScalarOpPairs =
  | OpPair<Date | null, Exclude<ScalarComparisonOp, 'LIKE'>>
  | OpPair<string | null, ScalarComparisonOp>
  | OpPair<number | null, Exclude<ScalarComparisonOp, 'LIKE'>>
  | OpPair<string | null, '=' | '!='> // multipicklist
  | OpPair<boolean | null, '=' | '!='>

export type ArrayOpPairs =
  | OpPair<Date[], ArrayComparisonOp>
  | OpPair<string[], ArrayComparisonOp>
  | OpPair<number[], ArrayComparisonOp>
  | OpPair<boolean[], ArrayComparisonOp>

export type MPickListOpPairs =
  OpPair<string[], MPicklistComparisonOp>

export type OpPairs = ScalarOpPairs | ArrayOpPairs | MPickListOpPairs
export type OpPairValue<T extends OpPair<any, any>> = T extends OpPair<infer V, any> ? V : never
export type PossibleValues = OpPairs extends OpPair<infer V, any> ? V : never

export type BooleanExpression = {
  field: string
} & OpPairs

export type BooleanOp = 'AND' | 'OR' | 'NOT'
export type WhereTree = BiTree<BooleanOp | BooleanExpression>
export type WhereTreeNode = Node<BooleanOp | BooleanExpression>

export const dateLiterals = [
  'YESTERDAY'
, 'TODAY'
, 'TOMORROW'
, 'LAST_WEEK'
, 'THIS_WEEK'
, 'NEXT_WEEK'
, 'LAST_MONTH'
, 'THIS_MONTH'
, 'NEXT_MONTH'
, 'LAST_90_DAYS'
, 'NEXT_90_DAYS'
, 'THIS_FISCAL_QUARTER'
, 'LAST_FISCAL_QUARTER'
, 'NEXT_FISCAL_QUARTER'
, 'THIS_FISCAL_YEAR'
, 'LAST_FISCAL_YEAR'
, 'NEXT_FISCAL_YEAR'
]

const isDate = (f: string) =>
  /^(\d{4})(-(\d{2}))??(-(\d{2}))??(T(\d{2}):(\d{2})(:(\d{2}))??(\.(\d+))??(([\+\-]{1}\d{2}:\d{2})|Z)??)??$/
  .test(f)
  || dateLiterals.includes(f)
  || /^NEXT_N_YEARS:(\d+)$/.test(f) || /^LAST_N_YEARS:(\d+)$/.test(f)
  || /^NEXT_N_FISCAL_QUARTERS:(\d+)$/.test(f) || /^LAST_N_FISCAL_QUARTERS:(\d+)$/.test(f)
  || /^NEXT_N_FISCAL_YEARS:(\d+)$/.test(f) || /^LAST_N_FISCAL_YEARS:(\d+)$/.test(f)

const representsLiteral = (f: string) =>
     f === 'TRUE' || f === 'FALSE' // boolean literal
  || f === 'null' // null literal
  || (f.charAt(0) === '\'' && f.charAt(f.length - 1) === '\'') // string literal
  || isDate(f) // date literal

const convertValue = (value: PossibleValues): string => {
  const convert = (value: Exclude<PossibleValues, any[]>): string => {
    if (typeof value === 'string') return representsLiteral(value) ? value : `'${value}'`
    if (typeof value === 'number') return value.toString()
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
    if (value instanceof Date) return value.toISOString()
    if (value === null) return 'null'
    // this ensures that if we forget an if case then the assignment fails
    // (only never can be assigned to the bottom type)
    /* istanbul ignore next */
    const _exhaustiveCheck: never = value
    /* istanbul ignore next */
    return _exhaustiveCheck
  }

  return Array.isArray(value)
    // typescript doesn't allow function calls on unions so we cast to any
    ? `( ${(value as any[]).map(convert).join(', ')} )`
    : convert(value)
}

// TODO: this outputs redundant parens. Optimize
// TODO: Can we use the tree's built-in inorder fold?
export const parseTree = (root: WhereTree): string => {
  if (root.isLeaf()) return ''
  // if the root doesn't have a parent, we don't need to add parens
  const prefix = `(${parseTree(root.left)} `
  const center = getValStr(root)
  const postfix = ` ${parseTree(root.right)})`

  return prefix + center + postfix
}

const getValStr = (t: Node<BooleanOp | BooleanExpression>): string => {
  if (typeof t.value === 'string') {
    return t.value
  } else {
    return `${t.value.field} ${t.value.op} ${convertValue(t.value.value)}`
  }
}
