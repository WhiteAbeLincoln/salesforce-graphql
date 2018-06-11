import { WhereArguments } from './WhereArgs'
import { Either, right, left, Right } from 'fp-ts/lib/Either'
import { BiTree, BiTreeNode, BiTreeLeaf, mergeTrees } from '../util/BinaryTree'
import { BooleanOp, WhereLeaf, WhereNode, ComparisonStringOp, PossibleValues } from './Where'

export type ComparisonOp = '>' | '<' | '>=' | '<=' | '=' | '!=' | 'LIKE' | 'IN' | 'NOT IN' | 'INCLUDES' | 'EXCLUDES'

export type BiWhereLeaf = {
  field: string
  op: ComparisonOp
  value: string
}

type WTree = BiTree<BooleanOp, BiWhereLeaf>
type WTreeNode = BiTreeNode<BooleanOp, BiWhereLeaf>
type WTreeLeaf = BiTreeLeaf<BiWhereLeaf>

export const getWhereClause = (args: WhereArguments): Either<string, string> => {
  const { filter, filterString } = args
  if (filter) {
    return convertToProperTree(filter).map(inorderTraversal)
  }

  if (filterString) return right(filterString)

  return right('')
}

const opMap: { [key in ComparisonStringOp]: ComparisonOp }
  = {
      gt: '>'
    , lt: '<'
    , gte: '>='
    , lte: '<='
    , eq: '='
    , neq: '!='
    , like: 'LIKE'
    , in: 'IN'
    , not_in: 'NOT IN'
    , includes: 'INCLUDES'
    , excludes: 'EXCLUDES'
    }

const convertOp = (op: ComparisonStringOp): ComparisonOp => opMap[op]

const isDate = (f: string) =>
  /^(\d{4})(-(\d{2}))??(-(\d{2}))??(T(\d{2}):(\d{2})(:(\d{2}))??(\.(\d+))??(([\+\-]{1}\d{2}:\d{2})|Z)??)??$/
  .test(f)

const shouldNotQuote = (f: string) =>
     f === 'TRUE'
  || f === 'FALSE'
  || f === 'null'
  || (f.charAt(0) === '\'' && f.charAt(f.length - 1) === '\'')
  || isDate(f)

const convertString = (s: string) => shouldNotQuote(s) ? s : `'${s}'`

const convertValue = (value: PossibleValues): string => {
  const convert = (value: Exclude<PossibleValues, any[]>): string => {
    if (typeof value === 'string') return convertString(value)
    if (typeof value === 'number') return value.toString()
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
    if (value instanceof Date) return value.toISOString()
    // this ensures that if we forget an if case then the assignment fails
    // (only never can be assigned to the bottom type)
    /* istanbul ignore next */
    const _exhaustiveCheck: never = value
    /* istanbul ignore next */
    return _exhaustiveCheck
  }

  if (Array.isArray(value)) {
    return `( ${(value as any[]).map(convert).join(', ')} )`
  }

  return convert(value)
}

const getLeafOrTree = (leaf: WhereLeaf, field: string): Either<string, WTree> => {
  const end = leaf[field]

  const ops = Object.keys(end) as ComparisonStringOp[]
  const leafs = ops.map(op => {
    const val: BiWhereLeaf = {
      field
    , op: convertOp(op)
    , value: convertValue(end[op]!)
    }

    return right({
      kind: 'leaf'
    , val
    }) as Right<string, WTreeLeaf>
  })

  if (leafs.length === 0) return left(`Must include at least one operator for field ${field}`)
  if (leafs.length === 1) {
    return leafs[0]
  }

  return mergeTrees('AND' as BooleanOp, ...leafs)
}

export const convertToProperTree = (root: WhereNode): Either<string, WTree> => {
  if (root.leaf && root.node) return left('Cannot specify a leaf and node')
  if (!root.leaf && !root.node) return left('Cannot omit both leaf and node')

  if (root.leaf) {
    const leaf = root.leaf
    const fields = Object.keys(root.leaf)
    const ftrees = fields.map(f => getLeafOrTree(leaf, f))

    if (ftrees.length === 0) return left('Must specify a field for leaf node')
    if (ftrees.length === 1) {
      return ftrees[0]
    }

    return mergeTrees('AND' as BooleanOp, ...ftrees)
  }

  const node = root.node!

  if (node.AND && node.AND.length < 2 || node.OR && node.OR.length < 2) {
    return left('Node forest must contain at least two subtrees')
  }

  return binaryFromForest(node)
}

const binaryFromForest = ({ AND, OR, NOT }: NonNullable<WhereNode['node']>): Either<string, WTreeNode> => {
  const node = (AND && { op: 'AND', forest: AND })
    || (OR && { op: 'OR', forest: OR })
    || (NOT && { op: 'NOT', forest: [NOT] })

  if (!node) return left('Must specify an operator (NOT, AND, OR) for node')
  const op = node.op as BooleanOp
  const forest = node.forest

  const eitherTrees = forest.map(convertToProperTree)

  /* null is a valid leaf for our binary tree.
    A NOT node will have a left subtree of a boolean expression and a right subtree of `null`
  */
  // tslint:disable-next-line:no-expression-statement
  if (op === 'NOT') eitherTrees.push(right(null) as any)

  return mergeTrees(op, ...eitherTrees)
}

export const inorderTraversal = (root: WTree | null): string => {
  if (root === null) return ''
  const prefix = root.kind === 'node' ? `(${inorderTraversal(root.left)}` : ''
  const center = getValStr(root)
  const postfix = root.kind === 'node' ? `${inorderTraversal(root.right)})` : ''

  return prefix + addSpace(prefix) + center + addSpace(center) + postfix
}

const addSpace = (s: string) => s[s.length - 1] && s[s.length - 1] !== ' ' ? ' ' : ''

const getValStr = (t: WTree) => {
  if (t.kind === 'node') {
    return t.val
  } else {
    return `${t.val.field} ${t.val.op} ${t.val.value}`
  }
}
