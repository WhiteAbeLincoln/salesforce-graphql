import { DescribeSObjectResult } from 'jsforce'
import { readFileSync } from 'fs'
import { IntermediateObject, isLeafField, isChildField, isParentField } from '../types'
import { GraphQLSFID, GraphQLURL, GraphQLEmailAddress } from '../util/GraphQLScalars'
import { GraphQLBoolean, GraphQLString, GraphQLFloat,
  GraphQLInt, GraphQLNonNull, GraphQLList, GraphQLObjectType,
  GraphQLUnionType, GraphQLSchema, GraphQLFieldConfigMap, getNamedType } from 'graphql'
import { GraphQLDateTime, GraphQLDate, GraphQLTime } from 'graphql-iso-date'
import { makeObjects, buildGraphQLObjects, buildRootFields, buildSchema } from '../buildSchema'
import { joinNames } from '../util'
// tslint:disable:no-expression-statement

const objects: Array<[DescribeSObjectResult, IntermediateObject | undefined]>
  = [ [ JSON.parse(readFileSync('src/__tests__/describes/AccountContactRole.desc.json', 'utf8'))
      , { name: 'AccountContactRole'
        , description: 'Organization Contact Role'
        , fields: {
            Id: {
              kind: 'leaf'
            , type: new GraphQLNonNull(GraphQLSFID)
            , sftype: 'id'
            , filterable: true
            , description: 'Contact Role ID'
            }
          , IsDeleted: {
              kind: 'leaf'
            , type: GraphQLBoolean
            , sftype: 'boolean'
            , filterable: true
            , description: 'Deleted'
            }
          , CreatedDate: {
              kind: 'leaf'
            , type: GraphQLDateTime
            , sftype: 'datetime'
            , filterable: true
            , description: 'Created Date'
            }
          , Base64: {
              kind: 'leaf'
            , type: GraphQLString
            , sftype: 'base64'
            , filterable: true
            , description: 'Created Date'
            }
          , Percent: {
              kind: 'leaf'
            , type: GraphQLFloat
            , sftype: 'percent'
            , filterable: true
            , description: 'Created Date'
            }
          , Email: {
              kind: 'leaf'
            , type: GraphQLEmailAddress
            , sftype: 'email'
            , filterable: true
            , description: 'Created Date'
            }
          , Time: {
              kind: 'leaf'
            , type: GraphQLTime
            , sftype: 'time'
            , filterable: true
            , description: 'Created Date'
            }
          , AccountId: {
              kind: 'leaf'
            , type: GraphQLSFID
            , sftype: 'reference'
            , filterable: true
            , description: 'Organization'
            }
          , Account: {
              kind: 'parent'
            , referenceTo: ['Account']
            , description: 'Parent Relationship to Account'
            }
          , InvalidParentId: {
              kind: 'leaf'
            , type: GraphQLSFID
            , sftype: 'reference'
            , filterable: true
            , description: 'empty referenceTo'
            }
          , AccountRoleId: {
              kind: 'leaf'
            , type: GraphQLSFID
            , sftype: 'reference'
            , filterable: true
            , description: 'Account Contact Union'
            }
          , AccountRole: {
              kind: 'parent'
            , referenceTo: ['Account', 'AccountContactRole']
            , description: 'Parent Relationship to AccountAccountContactRole'
            }
          , Role: {
              kind: 'leaf'
            , type: GraphQLString
            , sftype: 'picklist'
            , filterable: true
            , description: 'Role'
            }
          }
        }
      ]
    , [ JSON.parse(readFileSync('src/__tests__/describes/Account.desc.json', 'utf8'))
      , { name: 'Account'
        , description: 'Organization'
        , fields: {
            ChildAccounts: {
              kind: 'child'
            , referenceTo: 'Account'
            , description: 'Child Relationship to Account'
            }
          , AccountContactRoles: {
              kind: 'child'
            , referenceTo: 'AccountContactRole'
            , description: 'Child Relationship to AccountContactRole'
            }
          , Id: {
              kind: 'leaf'
            , type: new GraphQLNonNull(GraphQLSFID)
            , sftype: 'id'
            , filterable: true
            , description: 'Organization ID'
            }
          , IsDeleted: {
              kind: 'leaf'
            , type: GraphQLBoolean
            , sftype: 'boolean'
            , filterable: true
            , description: 'Deleted'
            }
          , MasterRecordId: {
              kind: 'leaf'
            , type: GraphQLSFID
            , sftype: 'reference'
            , filterable: true
            , description: 'Master Record ID'
            }
          , MasterRecord: {
              kind: 'parent'
            , referenceTo: ['Account']
            , description: 'Parent Relationship to Account'
            }
          , Name: {
              kind: 'leaf'
            , type: GraphQLString
            , sftype: 'string'
            , filterable: true
            , description: 'Organization Name'
            }
          , BillingStreet: {
              kind: 'leaf'
            , type: GraphQLString
            , sftype: 'textarea'
            , filterable: true
            , description: 'Billing Street'
            }
          , BillingLatitude: {
              kind: 'leaf'
            , type: GraphQLFloat
            , sftype: 'double'
            , filterable: true
            , description: 'Billing Latitude'
            }
          , Phone: {
              kind: 'leaf'
            , type: GraphQLString
            , sftype: 'phone'
            , filterable: true
            , description: 'Organization Phone'
            }
          , Website: {
              kind: 'leaf'
            , type: GraphQLURL
            , sftype: 'url'
            , filterable: true
            , description: 'Website'
            }
          , AnnualRevenue: {
              kind: 'leaf'
            , type: GraphQLFloat
            , sftype: 'currency'
            , filterable: true
            , description: 'Annual Revenue'
            }
          , NumberOfEmployees: {
              kind: 'leaf'
            , type: GraphQLInt
            , sftype: 'int'
            , filterable: true
            , description: 'Employees'
            }
          , LastActivityDate: {
              kind: 'leaf'
            , type: GraphQLDate
            , sftype: 'date'
            , filterable: true
            , description: 'Last Activity'
            }
          }
        }
      ]
    , [ JSON.parse(readFileSync('src/__tests__/describes/NoFields.desc.json', 'utf8')), undefined ]
    , [ JSON.parse(readFileSync('src/__tests__/describes/NotQueryable.desc.json', 'utf8')), undefined ]
    ]

describe('makeObjects', () => {
  objects.forEach(([describe, expected]) => {
    it(`returns the expected intermediate object for ${describe.name}`, () => {
      const [out] = makeObjects([describe])
      expect(out).toEqual(expected)
    })
  })
})

describe('buildGraphQLObjects', () => {
  const inters = objects.map(([_, inter]) => inter).filter((i): i is IntermediateObject => Boolean(i))
  const objs = buildGraphQLObjects(inters)

  inters.forEach(({ name, description, fields }) => {
    const object = objs.find(v => v.name === name)!

    it(`creates a GraphQL object with the same name for ${name}`, () => {
      expect(object).toBeDefined()
    })

    it(`creates a GraphQL object with the same description for ${name}`, () => {
      expect(object.description).toEqual(description)
    })

    const gqlFields = object.getFields()

    it(`creates a GraphQL object with the same fields for ${name}`, () => {
      expect(Object.keys(gqlFields)).toEqual(Object.keys(fields))
      Object.keys(fields).forEach(name => {
        const field = fields[name]
        const gqField = gqlFields[name]

        expect(gqField.description).toEqual(field.description)
      })
    })

    it(`creates a GraphQL object with the correct field types for ${name}`, () => {
      Object.keys(fields).forEach(name => {
        const field = fields[name]
        const gqField = gqlFields[name]

        if (isLeafField(field)) {
          expect(gqField.type).toBe(field.type)
        } else if (isChildField(field)) {
          /* TODO: the following checks only determine if the types have the same name
            Extend the check to full object equality
          */
          const type = new GraphQLList(new GraphQLObjectType({
            name: field.referenceTo
          , description: field.description
          , fields: {}
          }))

          expect(type.toString()).toEqual(gqField.type.toString())
        } else if (isParentField(field)) {
          const type = field.referenceTo.length > 1
            ? new GraphQLUnionType({
                name: joinNames(field.referenceTo, 'Union')
              , types: [new GraphQLObjectType({ name: 'Singleton', fields: {} })]
              })
            : new GraphQLObjectType({
                name: field.referenceTo[0]
              , fields: {}
              })

          expect(type.toString()).toEqual(gqField.type.toString())
        }
      })
    })
  })

  it('doesn\'t create duplicate objects', () => {
    const account: IntermediateObject
      = { name: 'Account'
        , description: 'Account Description'
        , fields: {
            owner: {
              kind: 'parent'
            , referenceTo: ['Account']
            , description: 'Account Owner'
            }
          , group: {
              kind: 'parent'
            , referenceTo: ['AccountGroup']
            , description: 'Parent Group'
            }
          }
        }

    const accountGroup: IntermediateObject
      = { name: 'AccountGroup'
        , description: 'A Group of Accounts'
        , fields: {
            members: {
              kind: 'child'
            , referenceTo: 'Account'
            , description: 'Group Members'
            }
          }
        }

    const objects = buildGraphQLObjects([account, accountGroup])
    expect(objects).toHaveLength(2)

    const accountObj = objects.find(o => o.name === account.name)!
    const accountGroupObj = objects.find(o => o.name === accountGroup.name)!

    expect(accountObj).toBeDefined()
    expect(accountGroupObj).toBeDefined()

    expect(accountObj.getFields().owner.type).toBe(accountObj)
    expect(accountObj.getFields().group.type).toBe(accountGroupObj)

    expect(accountGroupObj.getFields().members.type).toEqual(new GraphQLList(accountObj))
    expect(getNamedType(accountGroupObj.getFields().members.type)).toBe(accountObj)
  })
})

describe('buildRootFields', () => {
  const inters = objects.map(([_, inter]) => inter).filter((i): i is IntermediateObject => Boolean(i))
  const objs = buildGraphQLObjects(inters)

  const rootFieldConfig = buildRootFields(objs)

  objs.forEach(o => {
    it(`created a root field for ${o.name}`, () => {
      expect(rootFieldConfig[o.name]).toBeDefined()
    })

    it(`gave the correct type to the field for ${o.name}`, () => {
      expect(rootFieldConfig[o.name].type).toEqual(new GraphQLList(o))
    })
  })
})

describe('buildSchema', () => {
  const rootFieldConfig: GraphQLFieldConfigMap<any, any> = {
    int: {
      type: GraphQLInt
    }
  }

  const schema = buildSchema(rootFieldConfig)

  it('created a GraphQL schema', () => {
    expect(schema instanceof GraphQLSchema).toBeTruthy()
  })

  it('created the root Query object', () => {
    const queryType = schema.getQueryType()
    expect(queryType).toBeDefined()
    expect(queryType.name).toEqual('SalesforceQuery')
    expect(queryType.getFields()).toMatchObject(rootFieldConfig)
  })
})
