import { Option, none, some } from 'fp-ts/lib/Option'
import { GraphQLBoolean, GraphQLFieldConfig, GraphQLFloat,
  GraphQLInt, GraphQLLeafType, GraphQLNonNull,
  GraphQLObjectType, GraphQLString, GraphQLUnionType } from 'graphql'
import { Field as SObjectField, DescribeSObjectResult, ChildRelationship } from 'jsforce'
import mem from 'mem'
import { SalesforceFieldConfig, BuildObjectsMiddleware,
  salesforceObjectConfig, parentField,
  leafField, childField, ObjectConfig,
  isChildField, isParentField, isLeafField,
  isReferenceField, ExcludeKey} from './types'
import { joinNames, mapObj, mergeObjs } from './util'
import { GraphQLSFID, GraphQLURL, GraphQLEmailAddress } from './util/GraphQLScalars'
import { GraphQLDateTime, GraphQLDate, GraphQLTime } from 'graphql-iso-date'
import { catOptions, partitionMap } from 'fp-ts/lib/Array'
import { right, left, Either } from 'fp-ts/lib/Either'
import { tuple } from 'fp-ts/lib/function'

export const makeObjects = (describes: ReadonlyArray<DescribeSObjectResult>) => {
  const queryPartitioned =
    partitionMap(describes as DescribeSObjectResult[],
      (d): Either<string, DescribeSObjectResult> => !d.queryable ? left(d.name) : right(d))
  return catOptions(queryPartitioned.right.map(q => makeObject(q, queryPartitioned.left)))
}

const makeObject = (queryable: DescribeSObjectResult, notQueryable: string[]) => {
  if (!queryable || !queryable.fields) return none
  const metafields = queryable.fields.filter(Boolean) || []
  const parentRelations = catOptions(
    metafields.filter(f => f.type === 'reference')
              .map(f => {
                // TODO: optimize this set difference calculation
                const queryableRefs = f.referenceTo && f.referenceTo.filter(r => !notQueryable.includes(r))
                return {
                  ...f,
                  referenceTo: queryableRefs
                }
              })
              .map(makeParentRel)
  )

  const leafFields = catOptions(
    metafields.map(makeLeafField)
  )

  const childRelations = catOptions(
    (queryable.childRelationships || [])
      .filter(f => !notQueryable.includes(f.childSObject)).map(makeChildRel)
  )

  const fields = mergeObjs<SalesforceFieldConfig>(...parentRelations, ...leafFields, ...childRelations)

  if (Object.keys(fields).length > 0) {
    const intermediateObject
      = salesforceObjectConfig(queryable.name, queryable.label, fields)

    return some(intermediateObject)
  }

  return none
}

const makeLeafField = (field: SObjectField) => (
  getFieldType(field).map(t => {
    const leaf = leafField(t, field.type, field.filterable, field.label)
    return { [field.name]: leaf }
  })
)

const makeParentRel = (field: SObjectField) => {
  const type = field.referenceTo
            && field.referenceTo.length
            && field.relationshipName
            ? some(field.referenceTo)
            : none

  return type.map(t => {
    const parentRel = parentField(t, 'Parent Relationship to ' + joinNames(t))
    return { [field.relationshipName!]: parentRel }
  })
}

const makeChildRel = (rel: ChildRelationship) => {
  const referenceTo = rel.childSObject
  if (rel.relationshipName) {
    const childRel = childField(referenceTo, 'Child Relationship to ' + referenceTo)
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
    case 'complexvalue':
    case 'address':
      return none
  }
}

const createUnion = mem(
  (names: string[], types: GraphQLObjectType[]) =>
    new GraphQLUnionType({ name: joinNames(names, 'Union')
                         , description: `A union of ${names.join(', ')}`
                         , types }),
  { cacheKey: (n: string[], _: any) => n.join() }
)

const genFields = (obj: Readonly<ObjectConfig>,
                   objectConfigs: { readonly [name: string]: Readonly<ObjectConfig> },
                   gqlObjects: { readonly [name: string]: GraphQLObjectType },
                   middleware: BuildObjectsMiddleware) => {
  const fields = obj.fields
  type ValueOf<T> = T extends { [x: string]: infer U } ? U : T
  type input = ValueOf<typeof fields>

  return mapObj<input, GraphQLFieldConfig<any, any>>(field => {
    if (isLeafField(field)) return middleware(field, fields, obj, gqlObjects)

    if (isReferenceField(field)) {
      const fieldtype = field.type
      const wrapper: NonNullable<typeof field.wrapper> = field.wrapper || (x => x)

      const type = typeof fieldtype === 'string'
        ? wrapper(gqlObjects[fieldtype])
        : wrapper(fieldtype)

      return middleware(
        { ...field
        , type
        }, fields, obj, gqlObjects
      )
    }

    if (isChildField(field)) {
        const type = gqlObjects[field.referenceTo]
        const configRef = objectConfigs[field.referenceTo] as ObjectConfig | undefined
        return middleware(
          { ...field
          , type
          }, (configRef && configRef.fields) || {}, obj, gqlObjects
        )
    }

    if (isParentField(field)) {
      const references = field.referenceTo

      // if we have more than one name in the references array, then the type is a union of those
      const union = references.length > 1
        && createUnion(references, references.map(r => gqlObjects[r]))

      // if we had more than one item in the references array, union is defined
      // otherwise use something from our objects map
      const type = union || gqlObjects[references[0]]

      return middleware(
        { ...field
        , type
        }, fields, obj, gqlObjects
      )
    }

    const _exhaustive: never = field
    return _exhaustive
  }, fields)
}

/**
 * Handles creating the graphql objects and linking references between them
 * @param objects A list of intermediate objects
 * @param initialMap Cache for the new graphql objects that we create
 * @param middleware An optional function to run on field definitions before GraphQL sees them
 */
export const buildGraphQLObjects =
(objects: ReadonlyArray<ObjectConfig>,
 middleware: BuildObjectsMiddleware,
 initialMap: { readonly [name: string]: GraphQLObjectType } = {}
): [ Array<GraphQLObjectType & ExcludeKey<ObjectConfig, 'fields'>>
   , { readonly [name: string]: GraphQLObjectType & ExcludeKey<ObjectConfig, 'fields'> }
   ] => {
  type MergedGraphQLObject = GraphQLObjectType & ExcludeKey<ObjectConfig, 'fields'>

  const createdObjects: MergedGraphQLObject[] = []
  const objectsMap = mergeObjs(...objects.map(obj => ({ [obj.name]: obj })))

  const newObjMap: { [name: string]: MergedGraphQLObject }
    = mergeObjs(initialMap, ...objects.map(obj => {
      const gqlobj = new GraphQLObjectType({
        // we want to keep some properties in the final object, so spread and cast to any to fix the type
        /* FIXME: This is undefined behavior: GraphQLJS doesn't say anything about
            keeping fields from the passed configuration object on the constructed object
        */
        ...obj as any
      , fields: () => genFields(obj, objectsMap, newObjMap, middleware)
      }) as MergedGraphQLObject

      // we're being mutable here for the sake of performance
      // tslint:disable-next-line:no-expression-statement
      createdObjects.push(gqlobj)

      return {
        [obj.name]: gqlobj
      }
    })) as any as { [name: string]: MergedGraphQLObject }

  return tuple(createdObjects, newObjMap)
}
