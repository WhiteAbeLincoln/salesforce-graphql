import { GraphQLScalarType, ValueNode, GraphQLError } from 'graphql'
import { isIntValueNode } from '../util'

export const isUnsignedInt = (num: number) => !Number.isNaN(num) && Number.isInteger(num) && num > 0

const coerceInt = (value: any) => {
  if (typeof value !== 'number') {
    throw new TypeError(`Non-number value can't represent UnsignedInt: ${value}`)
  }

  if (!isUnsignedInt(value)) {
    throw new TypeError(`Value is not a positive integer: ${value}`)
  }

  return value
}

// tslint:disable-next-line:variable-name
export const GraphQLUnsignedInt = new GraphQLScalarType({
  name: 'UnsignedInt'
, description: 'Integers greater than 0'
, serialize: coerceInt
, parseValue: coerceInt
, parseLiteral(valueNode: ValueNode): number {
    if (!isIntValueNode(valueNode)) {
      throw new GraphQLError(`UnsignedInt value must be an integer, got: ${valueNode.kind}`, [valueNode])
    }

    const value = parseInt(valueNode.value, 10)

    if (!isUnsignedInt(value)) {
      throw new GraphQLError(`Expected UnsignedInt but got: ${value}`, [valueNode])
    }

    return value
  }
})

export default GraphQLUnsignedInt
