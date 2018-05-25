import { Either, left, Left, right } from 'fp-ts/lib/Either'

export type BiTree<N, L> = BiTreeNode<N, L> | BiTreeLeaf<L>

export interface BiTreeNode<N, L> {
  kind: 'node'
  val: N
  left: BiTree<N, L> | null
  right: BiTree<N, L> | null
}

export interface BiTreeLeaf<L> {
  kind: 'leaf'
  val: L
}

/**
 * Creates a binary tree node
 * @param val Node value
 * @param left Left subtree
 * @param right Right subtree
 */
// tslint:disable-next-line:variable-name
export const BiTreeNode = <N, L>(val: N, left?: BiTree<N, L> | null, right?: BiTree<N, L> | null): BiTreeNode<N, L> =>
  ({
    kind: 'node'
  , val
  , left: left || null
  , right: right || null
  })

/**
 * Creates a binary tree leaf
 * @param val Leaf value
 */
// tslint:disable-next-line:variable-name
export const BiTreeLeaf = <L>(val: L): BiTreeLeaf<L> => ({ kind: 'leaf', val })

/**
 * Connects a list of subtrees with nodes, creating a new tree
 * @param val Value for each new node
 * @param trees Subtrees to connect
 */
export const mergeTrees
  = <N, L>(val: N, ...trees: Array<Either<string, BiTree<N, L>>>): Either<string, BiTreeNode<N, L>> => {
    if (trees.length < 2) return left(`Must have at least 2 subtrees to merge with key '${val.toString()}'`)

    return trees.reduce((p, c) => {
      if (p.isLeft() && c.isLeft()) {
        // combine errors if both left
        return left<string, BiTree<N, L>>(`${p.value}\n${c.value}`)
      } else if (p.isLeft() || c.isLeft()) {
        // one is a left, return only the error
        return p.isLeft() ? p as Left<string, BiTree<N, L>> : c as Left<string, BiTree<N, L>>
      } else {
        // both rights
        return right(BiTreeNode(val, p.value, c.value))
      }
    }) as Either<string, BiTreeNode<N, L>>
  }
