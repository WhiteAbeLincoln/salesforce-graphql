import { filterObj } from './util'
import { and, compose, tuple } from 'fp-ts/lib/function'
import { LeafField, isLeafField, SalesforceFieldConfig } from '../types'

const mapping = (obj: { [x: string]: LeafField }) => Object.keys(obj).map(k => tuple(k, obj[k].sftype))
const filtering =
  filterObj(and(isLeafField, f => (f as LeafField).filterable) as (f: SalesforceFieldConfig) => f is LeafField)
/**
 * Given a map of Fields, returns a list of (fieldName, sftype) tuples
 * constructed from the LeafFields in the Field map
 * @param a a map of fields
 */
export const getArgFields = compose(mapping, filtering)
