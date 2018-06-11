import { SalesforceObjectConfig, salesforceObjectConfig,
  childField, } from '../../types'
import { Connection, createConnections } from '../Cursor/Cursor'

// tslint:disable:no-expression-statement

describe('Connection', () => {
  it('creates a tuple of edge and connection', () => {
    const conn = Connection('from', 'to')
    expect(conn).toHaveLength(2)
    expect(conn[0].fields.cursor).toBeDefined()
    expect(conn[0].fields.node).toBeDefined()
    expect(conn[0].fields.node.type).toEqual('to')

    expect(conn[1].fields.pageInfo).toBeDefined()
    expect(conn[1].fields.edges).toBeDefined()
    expect(conn[1].fields.edges.type).toEqual(conn[0].name)
  })

  it('doesn\'t create duplicate edge-connection tuples', () => {
    const conn1 = Connection('from', 'to')
    const conn2 = Connection('from', 'to')

    expect(conn1).toBe(conn2)
    expect(conn1[0]).toBe(conn2[0])
    expect(conn1[1]).toBe(conn2[1])
  })
})

const sfObjects: SalesforceObjectConfig[]
  = [ salesforceObjectConfig('First', 'first',
        { toFirst: childField('First', 'to first')
        , toSecond: childField('Second', 'to second')
        }
      )
    , salesforceObjectConfig('Second', 'second',
        { toFirst: childField('First', 'to first')
        , toSecond: childField('Second', 'to second')
        }
      )
    ]

describe('createConnections', () => {
  it('creates connections for the child fields in the input object', () => {
    const connections = createConnections(sfObjects)
    const firstFirstConnection = connections.find(c => !!c[0].name.match(/^FirstFirst/))
    const firstSecondConnection = connections.find(c => !!c[0].name.match(/^FirstSecond/))
    const secondFirstConnection = connections.find(c => !!c[0].name.match(/^SecondFirst/))
    const secondSecondConnection = connections.find(c => !!c[0].name.match(/^SecondSecond/))
    const connectionList = [firstFirstConnection, firstSecondConnection, secondFirstConnection, secondSecondConnection]
    // tests if the connections exist and if they have the correct names
    expect(connectionList).toEqual(connections)
  })
})

// describe('transformChildFields', () => {
//   it('replaces child fields with reference fields', () => {
//     const transformed = transformChildFields(sfObjects)
//     expect(transformed).toHaveLength(2)

//     const first = transformed.find(t => t.name === 'First')!
//     const second = transformed.find(t => t.name === 'Second')!

//     expect(first).toBeDefined()
//     expect(second).toBeDefined()

//     expect(isReferenceField(first.fields.toFirst)).toBeTruthy()
//     expect(isReferenceField(first.fields.toSecond)).toBeTruthy()
//     expect((first.fields.toFirst as ReferenceField).type).toMatch('FirstFirstConnection')
//     expect((first.fields.toSecond as ReferenceField).type).toMatch('FirstSecondConnection')

//     expect(isReferenceField(second.fields.toFirst)).toBeTruthy()
//     expect(isReferenceField(second.fields.toSecond)).toBeTruthy()
//     expect((second.fields.toFirst as ReferenceField).type).toMatch('SecondFirstConnection')
//     expect((second.fields.toSecond as ReferenceField).type).toMatch('SecondSecondConnection')
//   })
// })
