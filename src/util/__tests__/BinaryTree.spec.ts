import { BiTreeNode, BiTreeLeaf, mergeTrees, BiTree } from '../../util/BinaryTree'
import { right, Either, left } from 'fp-ts/lib/Either'

// tslint:disable:no-expression-statement

describe('BiTreeLeaf', () => {
  it('creates a binary tree leaf', () => {
    const leaf = BiTreeLeaf('hi')
    expect(leaf.kind).toEqual('leaf')
    expect(leaf.val).toEqual('hi')
  })
})

describe('BiTreeNode', () => {
  it('creates a binary tree node with no leafs', () => {
    const node = BiTreeNode('hi')
    expect(node.kind).toEqual('node')
    expect(node.left).toEqual(null)
    expect(node.right).toEqual(null)
    expect(node.val).toEqual('hi')
  })

  it('creates a binary tree node with a left leaf', () => {
    const leaf = BiTreeLeaf('there')
    const node = BiTreeNode('hi', leaf)
    expect(node.kind).toEqual('node')
    expect(node.left).toEqual(leaf)
    expect(node.right).toEqual(null)
    expect(node.val).toEqual('hi')
  })

  it('creates a binary tree node with a right leaf', () => {
    const leaf = BiTreeLeaf('there')
    const node = BiTreeNode('hi', null, leaf)
    expect(node.kind).toEqual('node')
    expect(node.left).toEqual(null)
    expect(node.right).toEqual(leaf)
    expect(node.val).toEqual('hi')
  })

  it('creates a binary tree node with both leafs', () => {
    const leaf = BiTreeLeaf('there')
    const leaf2 = BiTreeLeaf('man')

    const node = BiTreeNode('hi', leaf2, leaf)
    expect(node.kind).toEqual('node')
    expect(node.left).toEqual(leaf2)
    expect(node.right).toEqual(leaf)
    expect(node.val).toEqual('hi')
  })
})

describe('mergeTrees', () => {
  const trees
    = [ right(BiTreeNode<string, string>('hey'))
      , right(BiTreeNode<string, string>('there'))
      , left('error1')
      , left('error2')
      ] as Array<Either<string, BiTree<string, string>>>

  it('returns a Left(string) when attempting to merge less than two trees', () => {
    expect(mergeTrees('root', trees[0]).isLeft()).toBeTruthy()
    expect(mergeTrees('root', trees[0]).value).toMatch('Must have at least 2 subtrees to merge')
  })

  it('returns a Right(Tree) when merging two Right(Tree)', () => {
    const [good1, good2] = trees
    const merged = mergeTrees('root', good1, good2)
    expect(merged.isRight()).toBeTruthy()
    expect(merged.value).toEqual(BiTreeNode('root', good1.value as any, good2.value as any))
  })

  it('merges errors when merging two Left(string)', () => {
    const bad1 = trees[2]
    const bad2 = trees[3]
    const merged = mergeTrees('root', bad1, bad2)

    expect(merged.isLeft()).toBeTruthy()
    expect(merged.value).toEqual(`${bad1.value}\n${bad2.value}`)
  })

  it('passes through the left when merging a Right(Tree) and Left(string)', () => {
    const bad = trees[3]
    const good = trees[0]
    const merged1 = mergeTrees('root', bad, good)
    const merged2 = mergeTrees('root', good, bad)

    expect([merged1, merged2].map(m => m.isLeft())).toEqual([true, true])
    expect([merged1, merged2].map(m => m.value)).toEqual([bad.value, bad.value])
  })
})
