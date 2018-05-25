import { Option, none, some } from 'fp-ts/lib/Option'
import { GraphQLBoolean, GraphQLFieldConfig, GraphQLFloat,
  GraphQLInt, GraphQLLeafType, GraphQLList,
  GraphQLNonNull, GraphQLObjectType, GraphQLSchema,
  GraphQLString, GraphQLUnionType, GraphQLFieldConfigMap } from 'graphql'
import { Field as SObjectField, DescribeSObjectResult, ChildRelationship } from 'jsforce'
import mem from 'mem'
import { ListArguments, createListArgs } from './Arguments'
import { AdditionalInfo, ChildField, Field, LeafField, IntermediateObject, ParentField } from './types'
import { joinNames, mapObj, mergeObjs, somes } from './util'
import { GraphQLSFID, GraphQLURL, GraphQLEmailAddress } from './util/GraphQLScalars'
import { GraphQLDateTime, GraphQLDate, GraphQLTime } from 'graphql-iso-date'

export const makeObjects = (describes: ReadonlyArray<DescribeSObjectResult>) =>
  somes(describes.filter(d => d.queryable).map(makeObject))

const makeObject = (metadata: DescribeSObjectResult) => {
  const metafields = metadata.fields || []
  const parentRelations = somes(
    metafields.filter(f => f && f.type === 'reference').map(makeParentRel)
  )

  const leafFields = somes(
    metafields.filter(Boolean).map(makeLeafField)
  )

  const childRelations = somes(
    (metadata.childRelationships || [])
      .filter((v): v is ChildRelationship => Boolean(v)).map(makeChildRel)
  )

  const fields = mergeObjs<Field>([...parentRelations, ...leafFields, ...childRelations])

  if (Object.keys(metafields).length > 0) {
    const intermediateObject: IntermediateObject
      = { name: metadata.name
        , description: metadata.label
        , fields
        }

    return some(intermediateObject)
  }

  return none
}

const makeLeafField = (field: SObjectField) => (
  getFieldType(field).map(t => {
    const leaf: LeafField
      = { kind: 'leaf'
        , type: t
        , sftype: field.type
        , description: field.label
        , filterable: field.filterable }
    return { [field.name]: leaf }
  })
)

const makeParentRel = (field: SObjectField) => {
  const type = field.referenceTo
            && field.referenceTo.length
            && field.relationshipName
            ? some(field.referenceTo.filter((x): x is string => Boolean(x)))
            : none

  return type.map(t => {
    const parentRel: ParentField
      = { kind: 'parent'
        , referenceTo: t
        , description: 'Parent Relationship to ' + joinNames(t)
        }
    return { [field.relationshipName!]: parentRel }
  })
}

const makeChildRel = (rel: ChildRelationship) => {
  const referenceTo = rel.childSObject
  if (rel.relationshipName) {
    const childRel: ChildField
      = { kind: 'child'
        , referenceTo
        , description: 'Child Relationship to ' + referenceTo
        }
    return some({ [rel.relationshipName]: childRel })
  }
  return none
}

const getFieldType = (field: SObjectField): Option<GraphQLLeafType | GraphQLNonNull<GraphQLLeafType>> => {
  /* Salesforce scalar types:
  calculated: string
  combobox: string
  currency: double
  email: string
  encryptedstring: string
  id: string
  junctionIdList: string[]
  multipicklist: string - with options separated by semicolon (perhaps split at semicolon and return as string[])
  percent: double
  phone: string
  picklist:
  reference: string
  textarea: string
  url: string
  PRIMITIVES
  base64: base64 string => String
  boolean => Boolean
  byte => String
  date => String
  dateTime => String
  double => Float
  int => Int
  time => String
  */

  switch (field.type) {
    case 'string':
    case 'encryptedstring':
    case 'base64':
    case 'textarea':
    case 'phone':
    case 'combobox':
    case 'picklist':
    case 'multipicklist':
      return some(GraphQLString)
    case 'boolean':         return some(GraphQLBoolean)
    case 'int':             return some(GraphQLInt)
    case 'double':
    case 'currency':
    case 'percent':
      return some(GraphQLFloat)
    case 'date':            return some(GraphQLDate)
    case 'datetime':        return some(GraphQLDateTime)
    case 'id':              return some(new GraphQLNonNull(GraphQLSFID))
    case 'reference':       return some(GraphQLSFID)
    case 'url':             return some(GraphQLURL)
    case 'email':           return some(GraphQLEmailAddress)
    case 'time':            return some(GraphQLTime)

    case 'anyType':
    case 'location':
      return none
  }
}

const createUnion = mem(
  (name: string, types: GraphQLObjectType[]) => new GraphQLUnionType({ name, types }),
  { cacheKey: (n: string, _: any) => n }
)

export const buildGraphQLObjects = (objects: IntermediateObject[]) => {
  type Output = GraphQLFieldConfig<any, any, any> & AdditionalInfo

  /** cache for the new graphql objects that we create */
  const newObjects: { [name: string]: GraphQLObjectType } = {}

  const genFields = ((fields: { [x: string]: Field }) => (
    mapObj<Field, Output>(field => {
      switch (field.kind) {
        case 'child': {
          const type = new GraphQLList(newObjects[field.referenceTo])
          const args = createListArgs(fields)
          return {
            ...field
          , type
          , args
          }
        }
        case 'parent': {
          const references = field.referenceTo

          // if we have more than one name in the references array, then the type is a union of those
          const union = references.length > 1
            && createUnion(joinNames(references, 'Union'), references.map(r => newObjects[r]))

          // if we had more than one item in the references array, union is defined
          // otherwise use something from our objects map
          const type = union || newObjects[references[0]]

          return {
            ...field
          , type
          }
        }
        case 'leaf': return field
      }
    })(fields)
  ))

  const newObjList = objects.map(obj => (
    new GraphQLObjectType({
      ...obj
    , fields: () => genFields(obj.fields)
    })
  ))

  // Add our created objects to the map so that when fields are generated there can be references
  // tslint:disable-next-line:no-expression-statement no-object-mutation
  newObjList.map(o => { newObjects[o.name] = o })

  return newObjList
}

export const buildRootFields = (objects: GraphQLObjectType[]) => (
  mergeObjs(objects.map(o => ({
    [o.name]: ({
      // we will always recieve a list of items from the root
      type: new GraphQLList(o)
    , description: o.description
    // TODO: Finish the resolve function
    // , resolve: (async (obj, args, context, info) => {})
    , args: createListArgs(o.getFields() as any)
    } as GraphQLFieldConfig<any, any, ListArguments>)
  })))
)

export const buildSchema = (queryFields: GraphQLFieldConfigMap<any, any>) => (
  new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'SalesforceQuery'
    , description: 'Query Salesforce'
    , fields: queryFields
    })
  })
)
