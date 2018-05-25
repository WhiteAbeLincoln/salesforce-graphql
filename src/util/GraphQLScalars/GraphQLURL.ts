import { GraphQLScalarType, ValueNode, GraphQLError } from 'graphql'
import { isStringValueNode } from '../util'

// tslint:disable-next-line:max-line-length
const URL_REGEX = new RegExp(/(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9]\.[^\s]{2,})/)

export const isURL = (value: string) => URL_REGEX.test(value)

const coerceURL = (value: any) => {
  if (typeof value !== 'string') {
    throw new TypeError(`Non-string value can't represent URL: ${value}`)
  }

  if (!isURL(value)) {
    throw new TypeError(`Value does not represent a URL: ${value}`)
  }

  return value
}

// tslint:disable-next-line:variable-name
export const GraphQLURL = new GraphQLScalarType({
  name: 'URL'
// tslint:disable-next-line:max-line-length
, description: 'A field whose value conforms to the standard URL format as specified in RF3986: https://www.ietf.org/rfc/rfc3986.txt.'
, serialize: coerceURL
, parseValue: coerceURL
, parseLiteral(valueNode: ValueNode): string {
    if (!isStringValueNode(valueNode)) {
      throw new GraphQLError('URL value must be a string', [valueNode])
    }

    if (!isURL(valueNode.value)) {
      throw new GraphQLError(`Expected URL value but got: ${valueNode.value}`, [valueNode])
    }

    return valueNode.value
  }
})

export default GraphQLURL
