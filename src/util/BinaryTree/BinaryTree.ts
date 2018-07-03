import { Either, left, Left, right } from 'fp-ts/lib/Either'
import { Functor1 } from 'fp-ts/lib/Functor'
import { Foldable1 } from 'fp-ts/lib/Foldable'
import { Setoid, strictEqual } from 'fp-ts/lib/Setoid'
import { Ord, unsafeCompare } from 'fp-ts/lib/Ord'
import { Ordering } from 'fp-ts/lib/Ordering'
import { Semigroup } from 'fp-ts/lib/Semigroup'
import { Monoid } from 'fp-ts/lib/Monoid'
import { Traversable1 } from 'fp-ts/lib/Traversable'
import { Applicative } from 'fp-ts/lib/Applicative'
import { HKT } from 'fp-ts/lib/HKT'
import { Tree, drawTree as drawRose } from 'fp-ts/lib/Tree'
import { Alt1 } from 'fp-ts/lib/Alt'
import { Plus1 } from 'fp-ts/lib/Plus'

declare module 'fp-ts/lib/HKT' {
  interface URI2HKT<A> {
    BiTree: BiTree<A>
  }
}

export const URI = 'BiTree'
export type URI = typeof URI

export type BiTree<A> = Leaf<A> | Node<A>

interface BiTreeBase<A> {
  readonly map: <B>(f: (a: A) => B) => BiTree<B>
  readonly reduce: <B>(b: B, f: (b: B, a: A) => B) => B
  readonly alt: (fa: BiTree<A>) => BiTree<A>
  readonly contains: (S: Setoid<A>, a: A) => boolean
  readonly isLeaf: () => this is Leaf<A>
  readonly isNode: () => this is Node<A>
  readonly preorder: <B>(b: B, f: (b: B, a: A) => B) => B
  readonly postorder: <B>(b: B, f: (b: B, a: A) => B) => B
  readonly inorder: <B>(b: B, f: (b: B, a: A) => B) => B
  readonly equals: (other: BiTree<A>, S?: Setoid<A>) => boolean
  readonly compare: (other: BiTree<A>, O?: Ord<A>) => Ordering
  readonly concat: (other: BiTree<A>) => BiTree<A>
  readonly traverse: <F, B>(F: Applicative<F>, f: (a: A) => HKT<F, B>) => HKT<F, BiTree<B>>
  readonly height: () => number
}

// tslint:disable-next-line:no-class
export class Leaf<A> implements BiTreeBase<A> {
  // tslint:disable:no-this
  readonly _tag: 'Leaf' = 'Leaf'
  readonly _A!: A
  readonly _URI!: URI

  static value: BiTree<never> = new Leaf<never>()

  inspect(): string {
    return this.toString()
  }

  toString(): string {
    return 'empty'
  }

  map<B>(_f: (a: A) => B): BiTree<B> {
    return empty
  }

  reduce<B>(b: B, _f: (b: B, a: A) => B): B {
    return b
  }
  // all reducers only return the initial value for a leaf
  preorder = this.reduce
  inorder = this.reduce
  postorder = this.reduce

  alt(fa: BiTree<A>): BiTree<A> {
    return fa
  }

  contains(_S: Setoid<A>, _a: A): boolean {
    return false
  }

  isLeaf(): this is Leaf<A> {
    return true
  }

  isNode(): this is Node<A> {
    return false
  }

  equals(other: BiTree<A>, _S?: Setoid<A>): boolean {
    return other.isLeaf()
  }

  compare(other: BiTree<A>, _O?: Ord<A>): Ordering {
    return other.isLeaf() ? 0 : -1
  }

  concat(other: BiTree<A>): BiTree<A> {
    return other
  }

  traverse<F, B>(F: Applicative<F>, _f: (a: A) => HKT<F, B>): HKT<F, BiTree<B>> {
    return F.of(empty)
  }

  height(): number {
    return 0
  }
}

export const empty = Leaf.value

// tslint:disable-next-line:no-class max-classes-per-file
export class Node<A> implements BiTreeBase<A> {
  readonly _tag: 'Node' = 'Node'
  readonly _A!: A
  readonly _URI!: URI

  constructor(readonly value: A, readonly left: BiTree<A>, readonly right: BiTree<A>) { }

  inspect(): string {
    return this.toString()
  }

  toString(): string {
    return `new Node(${this.value}, ${this.left.toString()}, ${this.right.toString()})`
  }

  map<B>(f: (a: A) => B): BiTree<B> {
    return new Node(
      f(this.value)
    , this.left.map(f)
    , this.right.map(f)
    )
  }

  traverse<F, B>(F: Applicative<F>, f: (a: A) => HKT<F, B>): HKT<F, BiTree<B>> {
    const l = this.left
    const r = this.right
    const x = this.value

    return F.ap(F.ap(F.map(f(x), node), l.traverse(F, f)), r.traverse(F, f))
  }

  reduce<B>(z: B, f: (b: B, a: A) => B): B {
    // pre-order
    // right first
    const r = this.right.reduce(z, f)
    // then left
    const l = this.left.reduce(r, f)

    // then center
    return f(l, this.value)
  }

  preorder = this.reduce

  postorder<B>(z: B, f: (b: B, a: A) => B): B {
    // center
    const c = f(z, this.value)
    // then right
    const r = this.right.postorder(c, f)
    // then left
    return this.left.postorder(r, f)
  }

  inorder<B>(z: B, f: (b: B, a: A) => B): B {
    // right first
    const r = this.right.inorder(z, f)
    // then center
    const c = f(r, this.value)
    // then left
    return this.left.inorder(c, f)
  }

  alt(_fa: BiTree<A>): BiTree<A> {
    return this
  }

  equals(other: BiTree<A>, S?: Setoid<A>): boolean {
    return other.isNode() &&
      (typeof S !== 'undefined'
        ? S.equals(this.value, other.value)
        : strictEqual(this.value, other.value))
        && this.left.equals(other.left, S) && this.right.equals(other.right, S)
  }

  compare(other: BiTree<A>, O?: Ord<A>): Ordering {
    if (!other.isNode()) return 1
    const valueOrdering = (typeof O !== 'undefined'
      ? O.compare(this.value, other.value)
      : unsafeCompare(this.value, other.value))

    // left tree is greater than right, and current value is greater than left
    // only do additional checks if the current value was equal
    if (valueOrdering !== 0) return valueOrdering

    const leftOrdering = this.left.compare(other.left, O)

    if (leftOrdering !== 0) return leftOrdering

    return this.right.compare(other.right, O)
  }

  contains(S: Setoid<A>, a: A): boolean {
    return this.postorder(false, (b, v) => b || S.equals(v, a))
    // return S.equals(this.value, a) || this.left.contains(S, a) || this.right.contains(S, a)
  }

  isLeaf(): this is Leaf<A> {
    return false
  }

  isNode(): this is Node<A> {
    return true
  }

  concat(other: BiTree<A>): BiTree<A> {
    // TODO: ideally just attach the tree on the first leaf node breadth-wise
    // however I don't know how to do that (using a zipper would work)

    // will replace all leafs with the other tree. not right
    // return new Node(this.value, this.left.concat(other), this.right.concat(other))

    // will replace the rightmost leaf
    return new Node(this.value, this.left, this.right.concat(other))
  }

  height(): number {
    return 1 + Math.max(this.left.height(), this.right.height())
  }
}

export const singleton = <A>(a: A) => new Node(a, empty, empty)
export const node = <A>(a: A) => (l: BiTree<A>) => (r: BiTree<A>) => new Node(a, l, r)

export const getSetoid = <A>(S: Setoid<A>): Setoid<BiTree<A>> => (
  {
    equals: (x, y) => x.equals(y, S)
  }
)

export const getOrd = <A>(O: Ord<A>): Ord<BiTree<A>> => (
  {
    ...getSetoid(O)
  , compare: (x, y) => x.compare(y, O)
  }
)

export const getSemigroup = <A = never>(): Semigroup<BiTree<A>> => (
  {
    concat: (x, y) => x.concat(y)
  }
)

export const getMonoid = <A = never>(): Monoid<BiTree<A>> => (
  {
    ...getSemigroup<A>()
  , empty
  }
)

/** A TypeRep for the BiTree's Typeclasses */
export const bitree: Functor1<URI>
                   & Foldable1<URI>
                   & Alt1<URI>
                   & Plus1<URI>
                   & Traversable1<URI> = {
  URI
, map: (fa, f) => fa.map(f)
, reduce: (fa, b, f) => fa.reduce(b, f)
, traverse: F => (ta, f) => ta.traverse(F, f)
, alt: (fx, fy) => fx.alt(fy)
, zero: () => empty
}

export const convertToRose = <T>(tree: Node<T>): Tree<T> => {
  const left = tree.left.isLeaf() ? [] : [convertToRose(tree.left)]
  const right = tree.right.isLeaf() ? [] : [convertToRose(tree.right)]
  return new Tree(tree.value, [...left, ...right])
}

const convertStringTree = (tree: BiTree<string>): Node<string> => {
  if (tree.isLeaf()) return singleton('()')
  const left = convertStringTree(tree.left)
  const right = convertStringTree(tree.right)
  return new Node(`(${tree.value})`, left, right)
}

export const drawTree = (tree: BiTree<string>): string => {
  // replace all leafs with a singleton('()')
  // map all node values to '(${v})'
  // then convert
  return drawRose(convertToRose(convertStringTree(tree))).trim()
}

/**
 * Transforms all nodes at depth n+1 to leaves
 * @param depth The desired maximum depth of the tree
 */
export const truncateToDepth = <T>(depth: number, tree: BiTree<T>): BiTree<T> => {
  if (depth === 0) return empty
  if (tree.isLeaf()) return tree
  const left = truncateToDepth(depth - 1, tree.left)
  const right = truncateToDepth(depth - 1, tree.right)

  return new Node(tree.value, left, right)
}

/**
 * Connects a list of subtrees with nodes, creating a new tree
 * @param val Value for each new node
 * @param trees Subtrees to connect
 */
export const mergeTrees
  = <N>(val: N, ...trees: Array<Either<string, BiTree<N>>>): Either<string, Node<N>> => {
    if (trees.length < 2) return left(`Must have at least 2 subtrees to merge with key '${val.toString()}'`)

    return trees.reduce((p, c) => {
      if (p.isLeft() && c.isLeft()) {
        // combine errors if both left
        return left<string, BiTree<N>>(`${p.value}\n${c.value}`)
      } else if (p.isLeft() || c.isLeft()) {
        // one is a left, return only the error
        return p.isLeft() ? p as Left<string, BiTree<N>> : c as Left<string, BiTree<N>>
      } else {
        // both rights, join the trees
        return right(new Node(val, p.value, c.value))
      }
    }) as Either<string, Node<N>>
  }
