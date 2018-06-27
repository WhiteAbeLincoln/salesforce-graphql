import { Node, mergeTrees, singleton, empty, getSetoid,
  getOrd, getSemigroup, getMonoid, bitree, BiTree } from '../BinaryTree'
import { right, Either, left } from 'fp-ts/lib/Either'
import { cons, array } from 'fp-ts/lib/Array'
import { flip } from '../../functional'
import { setoidNumber } from 'fp-ts/lib/Setoid'
import { ordNumber } from 'fp-ts/lib/Ord'
import { traverse, sequence } from 'fp-ts/lib/Traversable'
import { option, Option, some, none } from 'fp-ts/lib/Option'

// tslint:disable:no-expression-statement

describe('BiTreeLeaf', () => {
  it('creates a binary tree leaf', () => {
    const leaf = singleton('hi')
    expect(leaf.value).toEqual('hi')
  })
})

describe('BiTreeNode', () => {
  it('creates a binary tree node with no leafs', () => {
    const node = singleton('hi')
    expect(node.left).toEqual(empty)
    expect(node.right).toEqual(empty)
    expect(node.value).toEqual('hi')
  })

  it('creates a binary tree node with a left leaf', () => {
    const leaf = singleton('there')
    const node = new Node('hi', leaf, empty)
    expect(node.left).toEqual(leaf)
    expect(node.right).toEqual(empty)
    expect(node.value).toEqual('hi')
  })

  it('creates a binary tree node with a right leaf', () => {
    const leaf = singleton('there')
    const node = new Node('hi', empty, leaf)
    expect(node.left).toEqual(empty)
    expect(node.right).toEqual(leaf)
    expect(node.value).toEqual('hi')
  })

  it('creates a binary tree node with both leafs', () => {
    const leaf = singleton('there')
    const leaf2 = singleton('man')

    const node = new Node('hi', leaf2, leaf)
    expect(node.left).toEqual(leaf2)
    expect(node.right).toEqual(leaf)
    expect(node.value).toEqual('hi')
  })
})

describe('traversal', () => {
  const tree
    = new Node('F'
      , new Node('B'
        , singleton('A')
        , new Node('D'
          , singleton('C')
          , singleton('E')
          )
        )
      , new Node('G'
        , empty
        , new Node('I'
          , singleton('H')
          , empty
          )
        )
      )

  it('properly traverses in preorder', () => {
    const list = tree.preorder([] as string[], flip(cons))

    expect(list).toEqual(['F', 'B', 'A', 'D', 'C', 'E', 'G', 'I', 'H'])
  })

  it('properly traverses in inorder', () => {
    const list = tree.inorder([] as string[], flip(cons))

    expect(list).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'])
  })

  it('properly traverses in postorder', () => {
    const list = tree.postorder([] as string[], flip(cons))

    expect(list).toEqual(['A', 'C', 'E', 'D', 'B', 'H', 'I', 'G', 'F'])
  })
})

describe('Typeclasses', () => {
  const tree1
    = new Node(2
      , singleton(-1)
      , singleton(1)
      )

  const tree1b
    = new Node(2
      , singleton(-1)
      , singleton(1)
      )

  const tree1c
    = new Node(2
      , singleton(-1)
      , singleton(1)
      )

  const tree2
    = new Node(2
      , singleton(1)
      , empty
      )

  const tree3
    = new Node(2
      , singleton(1)
      , singleton(1)
      )

  describe('Setoid', () => {
    const S = getSetoid(setoidNumber)
    it('fulfills the Reflexivity law', () => {
      // Reflexivity: S.equals(a, a) === true
      expect(S.equals(tree1, tree1)).toBe(true)
    })

    it('fulfills the Symmetry law', () => {
      expect(S.equals(tree1, tree2)).toBe(false)
      // Symmetry: S.equals(a, b) === S.equals(b, a)
      expect(S.equals(tree1, tree2)).toBe(S.equals(tree2, tree1))
    })

    it('fulfills the Transitivity law', () => {
      // Transitivity: S.equals(a, b) && S.equals(b, c) then S.equals(a, c) === true
      if (S.equals(tree1, tree1b) && S.equals(tree1b, tree1c)) {
        expect(S.equals(tree1, tree1c)).toBe(true)
      }
    })
  })

  describe('Ord', () => {
    const O = getOrd(ordNumber)
    it('fulfills the Reflexivity law', () => {
      // Reflexivity: S.equals(a, a) === true
      expect(O.compare(tree1, tree1)).toBeLessThanOrEqual(0)
    })

    it('fulfills the Antisymmetry law', () => {
      // Antisymmetry: if O.compare(a, b) <= 0 and O.compare(b, a) <= 0 then a = b
      if (O.compare(tree1, tree2) <= 0 && O.compare(tree2, tree1) <= 0) {
        expect(O.equals(tree1, tree2)).toBe(true)
      }

      expect(O.compare(tree1, tree1b)).toBeLessThanOrEqual(0)
      expect(O.compare(tree1b, tree1)).toBeLessThanOrEqual(0)
      expect(O.equals(tree1, tree1b)).toBe(true)
    })

    it('fulfills the Transitivity law', () => {
      // Transitivity: if O.compare(a, b) <= 0 and O.compare(b, c) <= 0 then O.compare(a, c) <= 0
      expect(O.compare(tree1, tree2)).toBeLessThanOrEqual(0)
      expect(O.compare(tree2, tree3)).toBeLessThanOrEqual(0)
      expect(O.compare(tree1, tree3)).toBeLessThanOrEqual(0)
    })
  })

  describe('Semigroup', () => {
    const S = getSemigroup<number>()

    it('fulfills the Associativity law', () => {
      // a.concat(b).concat(c) === a.concat(b.concat(c))
      expect(
        S.concat(S.concat(tree1, tree2), tree3)
      ).toEqual(
        S.concat(tree1, S.concat(tree2, tree3))
      )
    })
  })

  describe('Monoid', () => {
    const M = getMonoid<string>()

    it('fulfills the Right Identity law', () => {
      expect(M.concat(singleton('X'), M.empty)).toEqual(singleton('X'))
    })

    it('fulfills the Left Identity law', () => {
      expect(M.concat(M.empty, singleton('X'))).toEqual(singleton('X'))
    })
  })

  describe('Functor', () => {
    it('fulfills the Identity law', () => {
      expect(bitree.map(tree1, x => x)).toEqual(tree1)
    })

    it('fulfills the Composition law', () => {
      const f = (x: number) => x + 1
      const g = (x: number) => `${x}`

      expect(
        bitree.map(bitree.map(tree1, f), g)
      ).toEqual(
        bitree.map(tree1, x => g(f(x)))
      )
    })
  })

  describe('Foldable', () => {
    it('fulfills the really weird Foldable law', () => {
      const toArray = <A>(xs: BiTree<A>) => xs.reduce(
        [] as A[], (acc, x) => acc.concat([x])
      )

      const add = (p: number, c: number) => p + c

      expect(
        tree1.reduce(0, add)
      ).toEqual(
        toArray(tree1).reduce(add, 0)
      )
    })
  })

  describe('Traversable', () => {
    it('fulfills the Identity law', () => {
      const F = array
      // u.traverse(F, F.of) === F.of(u)
      expect(
        traverse(F, bitree)(tree1, F.of)
      ).toEqual(
        F.of(tree1)
      )
    })

    it('fulfills the Naturality law', () => {
      const G = array
      const F = option
      // We have two Applicative types (F :: Option) (G :: Array)
      // and some function t :: F a -> G a
      const t = <A>(l: Option<A>) => l.reduce([] as A[], flip(cons))
      // u :: BiTree<F a>
      const u = new Node(some('A'), singleton(none), singleton(none))
      // t(u.sequence(F)) === u.traverse(G, t)
      expect(
        t(sequence(F, bitree)(u))
      ).toEqual(
        traverse(G, bitree)(u, t)
      )
    })

    // TODO: Write composition law
    it.skip('fulfills the Composition law')
  })
})

describe('mergeTrees', () => {
  const trees
    = [ right(singleton('hey'))
      , right(singleton('there'))
      , left('error1')
      , left('error2')
      ] as Array<Either<string, Node<string>>>

  it('returns a Left(string) when attempting to merge less than two trees', () => {
    expect(mergeTrees('root', trees[0]).isLeft()).toBeTruthy()
    expect(mergeTrees('root', trees[0]).value).toMatch('Must have at least 2 subtrees to merge')
  })

  it('returns a Right(Tree) when merging two Right(Tree)', () => {
    const [good1, good2] = trees
    const merged = mergeTrees('root', good1, good2)
    expect(merged.isRight()).toBeTruthy()
    expect(merged.value).toEqual(new Node('root', good1.value as any, good2.value as any))
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
