import { filterObj } from './util'
import { and } from './functional'
import { compose, tuple } from 'fp-ts/lib/function'
import { LeafField, isLeafField, Overwrite } from '../types'

const mapping = (obj: { [x: string]: LeafField }) => Object.keys(obj).map(k => tuple(k, obj[k].sftype))
const filterableLeafs =
  and(isLeafField, (f): f is Overwrite<LeafField, { filterable: true }> => f.filterable)
const filter = filterObj(filterableLeafs)
/**
 * Given a map of Fields, returns a list of (fieldName, sftype) tuples
 * constructed from the LeafFields in the Field map
 * @param a a map of fields
 */
export const getArgFields = compose(mapping, filter)
