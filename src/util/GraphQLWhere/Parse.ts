import { WhereArguments, FilterNode, FilterLeaf } from './WhereArgs'
import { Either, left, right, Right } from 'fp-ts/lib/Either'
import { convertOp, ComparisonStringOp } from './Operators'
import { WhereTreeNode, BooleanOp, WhereTree, parseTree, BooleanExpression } from '../../SOQL/WhereTree'
import { mergeTrees, empty, singleton } from '../BinaryTree'

export const getWhereClause = (args: WhereArguments): Either<string, string> => {
  const { filter, filterString } = args
  if (filter) {
    return convertToProperTree(filter).map(parseTree)
  }

  if (filterString) {
    // TODO: Attempt to verify that filterString is a valid where clause
    return right(filterString)
  }

  return right('')
}

const binaryFromForest = ({ AND, OR, NOT }: NonNullable<FilterNode['node']>): Either<string, WhereTreeNode> => {
  const node = (AND && { op: 'AND', forest: AND })
    || (OR && { op: 'OR', forest: OR })
    || (NOT && { op: 'NOT', forest: [NOT] })

  if (!node) return left('Must specify an operator (NOT, AND, OR) for node')
  const op = node.op as BooleanOp
  const forest = node.forest

  const eitherTrees = forest.map(convertToProperTree)

  /*
    A NOT node will have a left subtree of a boolean expression and a right subtree of leaf
  */
  // tslint:disable-next-line:no-expression-statement
  if (op === 'NOT') eitherTrees.push(right(empty as WhereTree))

  return mergeTrees(op, ...eitherTrees)
}

export const convertToProperTree = (root: FilterNode): Either<string, WhereTree> => {
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

const getLeafOrTree = (leaf: FilterLeaf, field: string): Either<string, WhereTree> => {
  const end = leaf[field]

  const ops = Object.keys(end) as ComparisonStringOp[]
  const leafs = ops.map(op => {
    const val = {
      field
    , op: convertOp(op)
    , value: end[op]!
    } as BooleanExpression

    return right(singleton(val)) as Right<string, WhereTreeNode>
  })

  if (leafs.length === 0) return left(`Must include at least one operator for field ${field}`)
  if (leafs.length === 1) {
    return leafs[0]
  }

  return mergeTrees('AND' as BooleanOp, ...leafs)
}
