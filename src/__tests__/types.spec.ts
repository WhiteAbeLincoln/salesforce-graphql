import { isChildField, isParentField, isLeafField,
  leafField, parentField, childField } from '../types'
import { GraphQLString } from 'graphql'

// tslint:disable:no-expression-statement

const child = childField('hey', 'hi')

const parent = parentField(['a'], 'b')

const leaf = leafField(
  GraphQLString
, 'string'
, true
, 'hey'
)

describe('isChildField', () => {
  it('returns true given a ChildField', () => {
    expect(isChildField(child)).toBeTruthy()
  })

  it('returns false given a not ChildField', () => {
    expect(isChildField(parent)).toBeFalsy()
    expect(isChildField(leaf)).toBeFalsy()
  })
})

describe('isParentField', () => {
  it('returns true given a ParentField', () => {
    expect(isParentField(parent)).toBeTruthy()
  })

  it('returns false given a not ParentField', () => {
    expect(isParentField(child)).toBeFalsy()
    expect(isParentField(leaf)).toBeFalsy()
  })
})

describe('isLeafField', () => {
  it('returns true given a LeafField', () => {
    expect(isLeafField(leaf)).toBeTruthy()
  })

  it('returns false given a not LeafField', () => {
    expect(isLeafField(parent)).toBeFalsy()
    expect(isLeafField(child)).toBeFalsy()
  })
})
