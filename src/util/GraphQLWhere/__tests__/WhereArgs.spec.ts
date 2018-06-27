import { dateOperators, stringlikeOperators, numberOperators,
  booleanOperators, multipicklistOperators } from '../Operators'
import { GraphQLInputObjectType } from 'graphql'
import { tuple } from 'fp-ts/lib/function'
import { FieldType } from 'jsforce'
import { GraphQLEmailAddress, GraphQLURL, GraphQLSFID } from '../../GraphQLScalars'
import { createWhereLeaf, createWhere } from '../WhereArgs'

// tslint:disable:no-expression-statement
const getLeafFields = () => {
  const dates: Array<[[string, FieldType], ReturnType<typeof dateOperators>]>
    = [ [ ['a', 'date'], dateOperators('date') ]
      , [ ['b', 'datetime'], dateOperators('datetime') ]
      , [ ['c', 'time'], dateOperators('time') ]
      ]

  const emailURL: Array<[[string, FieldType], ReturnType<typeof stringlikeOperators>]>
    = [ [ ['a', 'email'], stringlikeOperators(GraphQLEmailAddress) ]
      , [ ['b', 'url'], stringlikeOperators(GraphQLURL) ]
      ]

  const refId: Array<[[string, FieldType], ReturnType<typeof stringlikeOperators>]>
    = [ [ ['a', 'reference'], stringlikeOperators(GraphQLSFID) ]
      , [ ['b', 'id'], stringlikeOperators(GraphQLSFID) ]
      ]

  const numbers: Array<[[string, FieldType], ReturnType<typeof numberOperators>]>
    = [ [ ['a', 'int'], numberOperators('int') ]
      , [ ['b', 'double'], numberOperators('double') ]
      , [ ['c', 'percent'], numberOperators('percent') ]
      , [ ['d', 'currency'], numberOperators('currency') ]
      ]

  const booleans: Array<[[string, FieldType], ReturnType<typeof booleanOperators>]>
    = [ [ ['a', 'boolean'], booleanOperators() ] ]

  const strings: Array<[[string, FieldType], ReturnType<typeof stringlikeOperators>]>
    = [ [ ['a', 'string'], stringlikeOperators() ]
      , [ ['b', 'encryptedstring'], stringlikeOperators() ]
      , [ ['c', 'base64'], stringlikeOperators() ]
      , [ ['d', 'anyType'], stringlikeOperators() ]
      , [ ['e', 'combobox'], stringlikeOperators() ]
      , [ ['f', 'phone'], stringlikeOperators() ]
      ]

  const multipicklist: Array<[[string, FieldType], ReturnType<typeof multipicklistOperators>]>
    = [ [ ['a', 'multipicklist'], multipicklistOperators() ] ]

  return [dates, emailURL, numbers, booleans, refId, strings, multipicklist]
}

describe('createWhereLeaf', () => {
  it('creates a GraphQL Input Object', () => {
    const whereLeaf = createWhereLeaf([['a', 'string'], ['b', 'string']])
    expect(whereLeaf instanceof GraphQLInputObjectType).toBeTruthy()
  })

  it('creates an input object with the correct field names', () => {
    const names = ['a', 'b', 'c']
    const fields = names.map(n => tuple(n, 'string' as FieldType))
    const whereLeaf = createWhereLeaf(fields)

    const whereFields = whereLeaf.getFields()
    names.map(n => expect(n in whereFields).toBeTruthy())
  })

  it('creates an object with the correct field types', () => {
    const wheres = getLeafFields()

    wheres.map(where => {
      where.map(([fieldDef, expected]) => {
        const [name] = fieldDef
        const leaf = createWhereLeaf([ fieldDef ])
        const field = leaf.getFields()

        expect(field[name].type instanceof GraphQLInputObjectType).toBeTruthy()

        const type = field[name].type as GraphQLInputObjectType
        const operatorMap = type.getFields()

        Object.keys(expected).map(k => {
          expect(operatorMap[k]).toBeDefined()
          const expectedType = expected[k].type
          expect(operatorMap[k].type).toEqual(expectedType)
        })
      })
    })
  })
})

describe('createWhere', () => {
  const leaf = createWhereLeaf([['a', 'string'], ['b', 'string'], ['c', 'string']])
  it('creates a GraphQL Input Object', () => {
    const where = createWhere(leaf)
    expect(where instanceof GraphQLInputObjectType).toBeTruthy()
    expect(where.name).toMatch('Where')
  })

  it('creates an input object with the correct field names', () => {
    const node = createWhere(leaf)
    const fields = node.getFields()
    expect('node' in fields).toBeTruthy()
    expect('leaf' in fields).toBeTruthy()
  })

  it('creates an object with the correct field types', () => {
    const node = createWhere(leaf)
    const fields = node.getFields()
    const fnode = fields.node
    const fleaf = fields.leaf

    expect(fnode.type instanceof GraphQLInputObjectType).toBeTruthy()
    expect((fnode.type as GraphQLInputObjectType).name).toMatch('WhereNode')
    expect(fleaf.type instanceof GraphQLInputObjectType).toBeTruthy()
    expect((fleaf.type as GraphQLInputObjectType).name).toMatch('WhereLeaf')
  })

  it('has a \'node\' subobject with fields OR AND and NOT', () => {
    const node = createWhere(leaf)
    const fields = node.getFields()
    const fnode = fields.node

    const nodeFields = (fnode.type as GraphQLInputObjectType).getFields()

    expect(nodeFields.AND).toBeDefined()
    expect(nodeFields.OR).toBeDefined()
    expect(nodeFields.NOT).toBeDefined()
  })
})
