import { DescribeSObjectResult } from 'jsforce'
import { readFileSync } from 'fs'
import { SalesforceObjectConfig, isLeafField, isChildField, isParentField,
          salesforceObjectConfig, childField, parentField, leafField } from '../types'
import { GraphQLSFID, GraphQLURL, GraphQLEmailAddress } from '../util/GraphQLScalars'
import { GraphQLBoolean, GraphQLString, GraphQLFloat,
  GraphQLInt, GraphQLNonNull, GraphQLList, GraphQLObjectType,
  GraphQLUnionType, getNamedType } from 'graphql'
import { GraphQLDateTime, GraphQLDate, GraphQLTime } from 'graphql-iso-date'
import { makeObjects, buildGraphQLObjects } from '../buildSchema'
import { joinNames } from '../util'
import { middleware as offsetMiddleware } from '../Pagination/Offset/Offset'
// tslint:disable:no-expression-statement

const objects: Array<[DescribeSObjectResult, SalesforceObjectConfig | undefined]>
  = [ [ JSON.parse(readFileSync('src/__tests__/describes/AccountContactRole.desc.json', 'utf8'))
      , salesforceObjectConfig('AccountContactRole', 'Organization Contact Role',
          {
            Id: leafField(
              new GraphQLNonNull(GraphQLSFID)
            , 'id'
            , true
            , 'Contact Role ID'
            )
          , IsDeleted: leafField(
              GraphQLBoolean
            , 'boolean'
            , true
            , 'Deleted'
            )
          , CreatedDate: leafField(
              GraphQLDateTime
            , 'datetime'
            , true
            , 'Created Date'
            )
          , Base64: leafField(
              GraphQLString
            , 'base64'
            , true
            , 'Created Date'
            )
          , Percent: leafField(
              GraphQLFloat
            , 'percent'
            , true
            , 'Created Date'
            )
          , Email: leafField(
              GraphQLEmailAddress
            , 'email'
            , true
            , 'Created Date'
            )
          , Time: leafField(
              GraphQLTime
            , 'time'
            , true
            , 'Created Date'
            )
          , AccountId: leafField(
              GraphQLSFID
            , 'reference'
            , true
            , 'Organization'
            )
          , Account: parentField(
              ['Account']
            , 'Parent Relationship to Account'
            )
          , InvalidParentId: leafField(
              GraphQLSFID
            , 'reference'
            , true
            , 'empty referenceTo'
            )
          , AccountRoleId: leafField(
              GraphQLSFID
            , 'reference'
            , true
            , 'Account Contact Union'
            )
          , AccountRole: parentField(
              ['Account', 'AccountContactRole']
            , 'Parent Relationship to AccountAccountContactRole'
            )
          , Role: leafField(
              GraphQLString
            , 'picklist'
            , true
            , 'Role'
            )
          }
        )
      ]
    , [ JSON.parse(readFileSync('src/__tests__/describes/Account.desc.json', 'utf8'))
      , salesforceObjectConfig('Account', 'Organization',
          {
            ChildAccounts: childField(
              'Account'
            , 'Child Relationship to Account'
            )
          , AccountContactRoles: childField(
              'AccountContactRole'
            , 'Child Relationship to AccountContactRole'
            )
          , Id: leafField(
              new GraphQLNonNull(GraphQLSFID)
            , 'id'
            , true
            , 'Organization ID'
            )
          , IsDeleted: leafField(
              GraphQLBoolean
            , 'boolean'
            , true
            , 'Deleted'
            )
          , MasterRecordId: leafField(
              GraphQLSFID
            , 'reference'
            , true
            , 'Master Record ID'
            )
          , MasterRecord: parentField(
              ['Account']
            , 'Parent Relationship to Account'
            )
          , Name: leafField(
              GraphQLString
            , 'string'
            , true
            , 'Organization Name'
            )
          , BillingStreet: leafField(
              GraphQLString
            , 'textarea'
            , true
            , 'Billing Street'
            )
          , BillingLatitude: leafField(
              GraphQLFloat
            , 'double'
            , true
            , 'Billing Latitude'
            )
          , Phone: leafField(
              GraphQLString
            , 'phone'
            , true
            , 'Organization Phone'
            )
          , Website: leafField(
              GraphQLURL
            , 'url'
            , true
            , 'Website'
            )
          , AnnualRevenue: leafField(
              GraphQLFloat
            , 'currency'
            , true
            , 'Annual Revenue'
            )
          , NumberOfEmployees: leafField(
              GraphQLInt
            , 'int'
            , true
            , 'Employees'
            )
          , LastActivityDate: leafField(
              GraphQLDate
            , 'date'
            , true
            , 'Last Activity'
            )
          }
        )
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
  const inters = objects.map(([_, inter]) => inter).filter((i): i is SalesforceObjectConfig => Boolean(i))
  const objs = buildGraphQLObjects(inters, offsetMiddleware)[1]

  inters.forEach(({ name, description, fields }) => {
    const object = objs[name]

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
    const account: SalesforceObjectConfig
      = salesforceObjectConfig('Account', 'Account Description',
          { owner: parentField(['Account'], 'Account Owner')
          , group: parentField(['AccountGroup'], 'Parent Group')
          }
    )

    const accountGroup: SalesforceObjectConfig
      = salesforceObjectConfig('AccountGroup', 'A Group of Accounts',
        { members: childField('Account', 'GroupMembers') })

    const objects = buildGraphQLObjects([account, accountGroup], offsetMiddleware)[1]
    expect(Object.keys(objects)).toHaveLength(2)

    const accountObj = objects[account.name]
    const accountGroupObj = objects[accountGroup.name]

    expect(accountObj).toBeDefined()
    expect(accountGroupObj).toBeDefined()

    expect(accountObj.getFields().owner.type).toBe(accountObj)
    expect(accountObj.getFields().group.type).toBe(accountGroupObj)

    expect(accountGroupObj.getFields().members.type).toEqual(new GraphQLList(accountObj))
    expect(getNamedType(accountGroupObj.getFields().members.type)).toBe(accountObj)
  })
})
