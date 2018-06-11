import { WhereNode, createWhereNode, createWhereLeaf } from './Where'
import { GraphQLArgumentConfig, GraphQLString } from 'graphql'
import { FieldType } from 'jsforce'

export interface WhereArguments {
  filter?: WhereNode
  filterString?: string
}

export const createWhereArgs = (leafFields: Array<[string, FieldType]>) => {
  const config: { [name in keyof Required<WhereArguments>]: GraphQLArgumentConfig }
    = {
        filter: {
          type: createWhereNode(createWhereLeaf(leafFields))
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
