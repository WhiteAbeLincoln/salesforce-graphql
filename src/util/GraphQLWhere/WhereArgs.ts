import { GraphQLArgumentConfig, GraphQLString, GraphQLInputObjectType, GraphQLList } from 'graphql'
import { FieldType } from 'jsforce'
import mem from 'mem'
import { createHash } from 'crypto'
import { createOperatorObject, Operators } from './Operators'
import { mergeObjs } from '../util'

export interface FilterNode {
  node?: {
    OR?: FilterNode[]
    AND?: FilterNode[]
    NOT?: FilterNode
  }
  leaf?: FilterLeaf
}

export interface FilterLeaf {
  [field: string]: Partial<Operators>
}

export interface WhereArguments {
  filter?: FilterNode
  filterString?: string
}

const getHash = (str: string) => {
  const match = /_(.*)/.exec(str)
  return match && match[1]
}

// tslint:disable-next-line:variable-name
const WhereNode = mem((whereNode: GraphQLInputObjectType) => (
  new GraphQLInputObjectType({
    name: `WhereNode_${getHash(whereNode.name) || whereNode.name}`
  , fields: () => ({
      OR: { type: new GraphQLList(whereNode), description: 'A logical OR of the values' }
    , AND: { type: new GraphQLList(whereNode), description: 'A logical AND of the values' }
    , NOT: { type: whereNode, description: 'A logical NOT of the value' }
    })
  })
), { cacheKey: (where: GraphQLInputObjectType) => where.name })

export const createWhere = mem((whereLeaf: GraphQLInputObjectType) => {
  // memoization replaces: if (name in whereNodeMap) return whereNodeMap[name]
  const node: GraphQLInputObjectType =  new GraphQLInputObjectType({
    name: `Where_${getHash(whereLeaf.name) || whereLeaf.name}`
  , description: 'A Boolean expression as a tree'
  , fields: () => ({
      node: {
        type: WhereNode(node)
      }
    , leaf: {
        type: whereLeaf
      }
    })
  })

  return node
}, { cacheKey: (leaf: GraphQLInputObjectType) => leaf.name })

const hashPairs = mem((fields: Array<[string, string]>) =>
  createHash('md5')
    .update(fields.map(f => `${f[0]}:${f[1]}`).join())
    .digest('hex')
)

// tslint:disable-next-line:variable-name
export const createWhereLeaf = mem((fields: Array<[string, FieldType]>) => (
  // tesxtarea cannot be specified in the where clause of a queryString of a query call
  new GraphQLInputObjectType({
    name: `WhereLeaf_${hashPairs(fields)}`
  , description: 'A leaf of a boolean expression tree: an expression that evaluates to a boolean'
  , fields: () => mergeObjs(...fields.map(f => ({ [f[0]]: { type: createOperatorObject(f[1]) } })))
  })
))

export const createWhereArgs = (leafFields: Array<[string, FieldType]>) => {
  const config: { [name in keyof Required<WhereArguments>]: GraphQLArgumentConfig }
    = {
        filter: {
          type: createWhere(createWhereLeaf(leafFields))
        // tslint:disable-next-line:max-line-length
        , description: `A tree representing a SOQL Where clause. Takes priority over 'filterString' if both are specified`
        }
      , filterString: {
          type: GraphQLString
        , description: 'A SOQL Where clause'
        }
      }

  return config
}
