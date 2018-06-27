import { isChildField, IntermediateObjectConfig,
  ReferenceField, SalesforceObjectConfig,
  ObjectConfig, referenceField, intermediateObjectConfig,
  BuildObjectsMiddleware } from '../../types'
import { filterObj, joinNames, mapObj } from '../../util'
import { GraphQLNonNull, GraphQLString, GraphQLList,
  GraphQLOutputType, GraphQLFieldConfigArgumentMap, GraphQLObjectType, GraphQLBoolean } from 'graphql'
import mem from 'mem'
import { createWhereArgs } from '../../util/GraphQLWhere/WhereArgs'
import { getArgFields } from '../../util/arguments'
import { GraphQLUnsignedInt } from '../../util/GraphQLScalars'

export interface EdgeObjectConfig extends IntermediateObjectConfig {
  fields: {
    cursor: ReferenceField
    node: ReferenceField
  }
}

export interface ConnectionObjectConfig extends IntermediateObjectConfig {
  fields: {
    pageInfo: ReferenceField
    edges: ReferenceField
  }
}

// tslint:disable-next-line:variable-name
export const GraphQLPageInfo = new GraphQLObjectType({
  name: 'PageInfo'
, fields: {
    hasNextPage: {
      type: new GraphQLNonNull(GraphQLBoolean)
    },
    hasPreviousPage: {
      type: new GraphQLNonNull(GraphQLBoolean)
    }
  }
})

const childFields = (obj: SalesforceObjectConfig) =>
  filterObj(isChildField)(obj.fields)

// tslint:disable-next-line:variable-name
export const Connection =
  mem((from: string, to: string | GraphQLOutputType): [EdgeObjectConfig, ConnectionObjectConfig] => {
    const edge
      = intermediateObjectConfig(
          joinNames([from, to.toString()], 'Edge')
        , `Edge from ${from} to ${to}`
        , { cursor: referenceField(new GraphQLNonNull(GraphQLString))
          , node: referenceField(to)
          }
        ) as EdgeObjectConfig

    const connection
      = intermediateObjectConfig(
          joinNames([from, to.toString()], 'Connection')
        , `Connection from ${from} to ${to}`
        , { pageInfo: referenceField(GraphQLPageInfo)
          , edges: referenceField(edge.name, undefined, o => new GraphQLList(o))
          }
        ) as ConnectionObjectConfig

    return [edge, connection]
  }, { cacheKey: (from: string, to: string | GraphQLOutputType) => from + to.toString() })

export const createConnections =
(objects: ReadonlyArray<SalesforceObjectConfig>): Array<[EdgeObjectConfig, ConnectionObjectConfig]> => {
  // ensures that the created objects are unique
  const newObjSet = objects.reduce((set, obj) => {
    const childs = childFields(obj)

    return Object.keys(childs).reduce((set, key) => {
      const child = childs[key]

      const pair = Connection(obj.name, child.referenceTo)

      return set.add(pair)
    }, set)
  }, new Set<[EdgeObjectConfig, ConnectionObjectConfig]>())

  return [...newObjSet.values()]
}

/**
 * Replaces ChildFields with ReferenceFields pointing to the corresponding connection object
 * @param objects A list of object configs
 */
export const transformChildFields = (objects: ReadonlyArray<Readonly<SalesforceObjectConfig>>): ObjectConfig[] => {
  // transforms all ChildFields to ReferenceFields
  return objects.reduce((newObjs, o) => {
    const childs = childFields(o)

    const newChilds = mapObj(child => {
      const connection = Connection(o.name, child.referenceTo)
      // replace the ChildField with the connection for the child object
      return referenceField(connection[1].name, child.description)
    }, childs)

    // TODO: figure out proper types: I'm fudging something here.
    return [...newObjs, Object.keys(childs).length > 0 ? { ...o, fields: { ...o.fields, ...newChilds } } : o] as any[]
  }, [] as ObjectConfig[])
}

export const cursorArguments = (forward: boolean, back: boolean): GraphQLFieldConfigArgumentMap => {
  const fwdArgs: GraphQLFieldConfigArgumentMap = {
    first: {
      type: GraphQLUnsignedInt
    , description: 'Limits the number of results returned in the page. Default 10'
    }
  , after: {
      type: GraphQLString
    , description: 'Cursor pointing to an item on the previous page'
    }
  }

  const backArgs: GraphQLFieldConfigArgumentMap = {
    last: {
      type: GraphQLUnsignedInt
    , description: 'Limits the number of results returned in the page. Default 10'
    }
  , before: {
      type: GraphQLString
    , description: 'Cursor pointing to an item on the next page'
    }
  }

  return {
    ...(forward ? fwdArgs : {})
  , ...(back ? backArgs : {})
  }
}

export const middleware: BuildObjectsMiddleware = (field, fields, parent, gqlObjs) => {
  if (isChildField(field)) {
    const connection = Connection(parent.name, field.referenceTo)
    const connectionObj = gqlObjs[connection[1].name]
    if (!connectionObj) {
      throw new Error(`Connection ${connection[1].name} not found in object map`)
    }

    const leafFields = getArgFields(fields as any)

    return {
      ...field
    , type: connectionObj
    , args: { ...createWhereArgs(leafFields), ...cursorArguments(true, false) }
    }
  }

  return field
}
