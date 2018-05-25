import { GraphQLScalarType, ValueNode, GraphQLError } from 'graphql'
import { isStringValueNode } from '../util'
import { validate } from 'isemail'

export const isEmail = (value: string) => validate(value, { allowUnicode: true })

const coerceAddress = (value: any) => {
  if (typeof value !== 'string') {
    throw new TypeError(`Non-string value can't represent EmailAddress: ${value}`)
  }

  if (!isEmail(value)) {
    throw new TypeError(`Value does not represent an email: ${value}`)
  }

  return value
}

// tslint:disable-next-line:variable-name
export const GraphQLEmailAddress = new GraphQLScalarType({
  name: 'EmailAddress'
// tslint:disable-next-line:max-line-length
, description: 'A field whose value conforms to the standard internet email address format as specified in RFCs 5321, 5322, 6530 and others'
, serialize: coerceAddress
, parseValue: coerceAddress
, parseLiteral(valueNode: ValueNode): string {
    if (!isStringValueNode(valueNode)) {
      throw new GraphQLError(`Email address value must be a string, got: ${valueNode.kind}`, [valueNode])
    }

    if (!isEmail(valueNode.value)) {
      throw new GraphQLError(`Expected email address value but got: ${valueNode.value}`, [valueNode])
    }

    return valueNode.value
  }
})

export default GraphQLEmailAddress
