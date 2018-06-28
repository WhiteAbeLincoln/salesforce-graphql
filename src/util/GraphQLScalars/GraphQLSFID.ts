import { GraphQLScalarType, ValueNode, GraphQLError } from 'graphql'
import { isStringValueNode } from '../util'
import { toString } from 'fp-ts/lib/function';

const SFID_REGEX = new RegExp(/^[a-zA-Z0-9]{15}|[a-zA-Z0-9]{18}$/)

export const isSFID = (value: string) => SFID_REGEX.test(value)

const coerceSFID = (value: any) => {
  if (typeof value !== 'string') {
    throw new TypeError(`Non-string value can't represent SFID: ${toString(value)}`)
  }

  if (!isSFID(value)) {
    throw new TypeError(`Value does not represent a SFID: ${toString(value)}`)
  }

  return value
}

// tslint:disable-next-line:variable-name
export const GraphQLSFID = new GraphQLScalarType({
  name: 'SFID'
, description: 'A field whose value is a 15 or 18 character Salesforce ID'
, serialize: coerceSFID
, parseValue: coerceSFID
, parseLiteral(valueNode: ValueNode): string {
    if (!isStringValueNode(valueNode)) {
      throw new GraphQLError(`SFID value must be a string, got: ${valueNode.kind}`, [valueNode])
    }

    if (!isSFID(valueNode.value)) {
      throw new GraphQLError(`Expected SFID value but got: ${toString(valueNode.value)}`)
    }

    return valueNode.value
  }
})

export default GraphQLSFID
