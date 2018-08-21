import { getFieldSet, FieldSet, FieldSetCondition } from '../GraphQLUtils'
// import { StarWarsSchema } from './__helper__/starWarsSchema.helper'
import { graphql, buildSchema, GraphQLResolveInfo, GraphQLString, GraphQLNonNull, GraphQLList } from 'graphql'

// tslint:disable:no-expression-statement typedef

describe('getFieldSet', () => {
  const swSimpleSchema = buildSchema(`
    type Human {
      id: String!
      name(encoding: String): String
    }
    type Query {
      hero(episode: Int): Human!
    }
  `)

  const simpleResolver = () => ({
    hero(_1: never, _2: never, info: GraphQLResolveInfo) {
      expect.assertions(15)
      const value = getFieldSet(info)

      expect(value).toBeDefined()
      expect(value.kind).toBe('concrete')
      if (value && value.kind === 'concrete') {
        expect(value.children).toBeDefined()
        expect(value.children).toHaveLength(2)

        expect(value.fieldName).toEqual('hero')
        expect(value.type).toEqual(new GraphQLNonNull(swSimpleSchema.getType('Human')!))
        expect(value.args).toEqual({ episode: 1 })

        const id = value.children!.find(c => c.name === 'id')
        const name = value.children!.find(c => c.name === 'name')
        expect(id).toBeDefined()
        expect(name).toBeDefined()

        if (id) {
          expect(id.fieldName).toEqual('id')
          expect(id.type).toEqual(new GraphQLNonNull(GraphQLString))
          expect(id.args).toEqual({})
        }

        if (name) {
          expect(name.fieldName).toEqual('name')
          expect(name.type).toEqual(GraphQLString)
          expect(name.args).toEqual({ encoding: 'UTF-8' })
        }
      }

      return { name: 'hey', id: '100' }
    }
  })

  it('returns a FieldSet with correct names, types, and arguments for simple query', () => {
    const query = `
      query Simple {
        hero(episode: 1) {
          name(encoding: "UTF-8")
          id
        }
      }
    `
    return graphql(swSimpleSchema, query, simpleResolver()).then(data => {
      if (data.errors && data.errors.length > 0) {
        throw data.errors[0]
      }
    })
  })

  it('returns a FieldSet with correct names, types, and arguments for simple query with aliases', () => {
    const query = `
      query Simple {
        hero(episode: 1) {
          unicode: name(encoding: "UTF-8")
          ascii: name(encoding: "ASCII")
          id
        }
      }
    `

    const rootResolver = ({
      hero(_1: never, _2: never, info: GraphQLResolveInfo) {
        expect.assertions(19)
        const value = getFieldSet(info)

        expect(value).toBeDefined()
        expect(value.kind).toBe('concrete')
        if (value && value.kind === 'concrete') {
          expect(value.children).toBeDefined()
          expect(value.children).toHaveLength(3)

          expect(value.fieldName).toEqual('hero')
          expect(value.type).toEqual(new GraphQLNonNull(swSimpleSchema.getType('Human')!))
          expect(value.args).toEqual({ episode: 1 })

          const id = value.children!.find(c => c.name === 'id')
          const unicode = value.children!.find(c => c.name === 'unicode')
          const ascii = value.children!.find(c => c.name === 'ascii')

          expect(id).toBeDefined()
          expect(unicode).toBeDefined()
          expect(ascii).toBeDefined()

          if (id) {
            expect(id.fieldName).toEqual('id')
            expect(id.type).toEqual(new GraphQLNonNull(GraphQLString))
            expect(id.args).toEqual({})
          }

          if (unicode) {
            expect(unicode.fieldName).toEqual('name')
            expect(unicode.type).toEqual(GraphQLString)
            expect(unicode.args).toEqual({ encoding: 'UTF-8' })
          }

          if (ascii) {
            expect(ascii.fieldName).toEqual('name')
            expect(ascii.type).toEqual(GraphQLString)
            expect(ascii.args).toEqual({ encoding: 'ASCII' })
          }
        }

        return { name: 'hey', id: '100' }
      }
    })

    return graphql(swSimpleSchema, query, rootResolver).then(data => {
      if (data.errors && data.errors.length > 0) {
        throw data.errors[0]
      }
    })
  })

  it('returns a correct FieldSet for simple query with inline fragments', () => {
    const query = `
      query Simple {
        hero(episode: 1) {
          ... on Human {
            name(encoding: "UTF-8")
          }
          ... {
            id
          }
        }
      }
    `

    return graphql(swSimpleSchema, query, simpleResolver()).then(data => {
      if (data.errors && data.errors.length > 0) {
        throw data.errors[0]
      }
    })
  })

  it('returns a correct FieldSet for simple query with fragment spreads', () => {
    const query = `
      fragment nameFrag on Human {
        id
        name(encoding: "UTF-8")
      }
      query Simple {
        hero(episode: 1) {
          ...nameFrag
        }
      }
    `

    return graphql(swSimpleSchema, query, simpleResolver()).then(data => {
      if (data.errors && data.errors.length > 0) {
        throw data.errors[0]
      }
    })
  })

  const swSchema = buildSchema(`
    enum Episode { NEWHOPE, EMPIRE, JEDI }
    interface Character {
      id: String!
      name(encoding: String): String
      friends: [Character]
      appearsIn: [Episode]
    }

    type Human implements Character {
      id: String!
      name(encoding: String): String
      friends: [Character]
      appearsIn: [Episode]
      homePlanet: String
    }

    type Droid implements Character {
      id: String!
      name(encoding: String): String
      friends: [Character]
      appearsIn: [Episode]
      primaryFunction: String
    }

    type Query {
      hero(episode: Episode): Character
      human(id: String!): Human
      droid(id: String!): Droid
    }
  `)

  it('returns a correct FieldSet for interface query with no fragments', () => {
    expect.assertions(12)

    const query = `
      query Interfaced {
        hero(episode: NEWHOPE) {
          name
          appearsIn
        }
      }
    `

    const rootResolver
      = {
        hero(_1: never, _2: never, info: GraphQLResolveInfo) {
          const fieldset = getFieldSet(info)

          expect(fieldset).toBeDefined()
          expect(fieldset.kind).toBe('abstract')

          if (fieldset && fieldset.kind === 'abstract') {
            expect(fieldset.children).toHaveLength(2)
            expect(fieldset.possibleSets).toHaveLength(0)

            const name = fieldset.children.find(c => c.fieldName === 'name')
            const appearsIn = fieldset.children.find(c => c.fieldName === 'appearsIn')

            expect(name).toBeDefined()
            expect(appearsIn).toBeDefined()

            if (name) {
              expect(name.fieldName).toEqual('name')
              expect(name.type).toEqual(GraphQLString)
              expect(name.args).toEqual({})
            }

            if (appearsIn) {
              expect(appearsIn.fieldName).toEqual('appearsIn')
              expect(appearsIn.type).toEqual(new GraphQLList(swSchema.getType('Episode')!))
              expect(appearsIn.args).toEqual({})
            }
          }
        }
      }

    return graphql(swSchema, query, rootResolver).then(data => {
      if (data.errors && data.errors.length > 0) {
        throw data.errors[0]
      }
    })
  })

  it('returns a correct FieldSet for nested interface query', () => {
    expect.assertions(17)

    const query = `
      query Interfaced {
        hero(episode: NEWHOPE) {
          friends {
            name
            appearsIn
          }
        }
      }
    `

    const rootResolver
      = {
        hero(_1: never, _2: never, info: GraphQLResolveInfo) {
          const fieldset = getFieldSet(info)

          expect(fieldset).toBeDefined()
          expect(fieldset.kind).toBe('abstract')

          if (fieldset && fieldset.kind === 'abstract') {
            expect(fieldset.children).toHaveLength(1)
            expect(fieldset.possibleSets).toHaveLength(0)

            const friends = fieldset.children.find(c => c.fieldName === 'friends')
            expect(friends).toBeDefined()

            if (friends) {
              expect(friends.fieldName).toEqual('friends')
              expect(friends.type).toEqual(new GraphQLList(swSchema.getType('Character')!))
              expect(friends.kind).toBe('abstract')
              if (friends.kind === 'abstract') {
                expect(friends.children).toHaveLength(2)
                const friendset = friends.children

                const name = friendset.find(c => c.fieldName === 'name')
                const appearsIn = friendset.find(c => c.fieldName === 'appearsIn')

                expect(name).toBeDefined()
                expect(appearsIn).toBeDefined()

                if (name) {
                  expect(name.fieldName).toEqual('name')
                  expect(name.type).toEqual(GraphQLString)
                  expect(name.args).toEqual({})
                }

                if (appearsIn) {
                  expect(appearsIn.fieldName).toEqual('appearsIn')
                  expect(appearsIn.type).toEqual(new GraphQLList(swSchema.getType('Episode')!))
                  expect(appearsIn.args).toEqual({})
                }
              }
            }
          }
        }
      }

    return graphql(swSchema, query, rootResolver).then(data => {
      if (data.errors && data.errors.length > 0) {
        throw data.errors[0]
      }
    })
  })

  const inlineResolver = () => ({
    hero(_1: never, _2: never, info: GraphQLResolveInfo) {
      expect.assertions(13)
      const fieldset = getFieldSet(info)

      expect(fieldset).toBeDefined()
      expect(fieldset.kind).toBe('abstract')

      if (fieldset && fieldset.kind === 'abstract') {
        expect(fieldset.children).toHaveLength(2)
        expect(fieldset.possibleSets).toHaveLength(0)
        expect(fieldset.args).toEqual({ episode: 'NEWHOPE' })

        const name = fieldset.children.find(c => c.name === 'name')
        const appearsIn = fieldset.children.find(c => c.name === 'appearsIn')

        expect(name).toBeDefined()
        expect(appearsIn).toBeDefined()

        if (name) {
          expect(name.fieldName).toEqual('name')
          expect(name.type).toEqual(GraphQLString)
          expect(name.args).toEqual({ encoding: 'UTF-8' })
        }

        if (appearsIn) {
          expect(appearsIn.fieldName).toEqual('appearsIn')
          expect(appearsIn.type).toEqual(new GraphQLList(swSchema.getType('Episode')!))
          expect(appearsIn.args).toEqual({})
        }
      }
    }
  })

  it('returns a correct FieldSet for interface query with inline fragment not having condition', () => {
    expect.assertions(12)

    const query = `
      query Interfaced {
        hero(episode: NEWHOPE) {
          ... {
            name(encoding: "UTF-8")
            appearsIn
          }
        }
      }
    `

    return graphql(swSchema, query, inlineResolver()).then(data => {
      if (data.errors && data.errors.length > 0) {
        throw data.errors[0]
      }
    })
  })

  it('returns a correct FieldSet for interface query with inline fragment having directive', () => {
    expect.assertions(12)
    const query = `
      query Interfaced {
        hero(episode: NEWHOPE) {
          ... @include(if: true) {
            name(encoding: "UTF-8")
            appearsIn
          }
          ... @include(if: false) {
            friends {
              name
            }
          }
        }
      }
    `

    return graphql(swSchema, query, inlineResolver()).then(data => {
      if (data.errors && data.errors.length > 0) {
        throw data.errors[0]
      }
    })
  })

  it('returns a correct FieldSet for interface query with inline fragment conditioned on the interface type', () => {
    expect.assertions(12)

    const query = `
      query Interfaced {
        hero(episode: NEWHOPE) {
          ... on Character {
            name(encoding: "UTF-8")
            appearsIn
          }
        }
      }
    `

    return graphql(swSchema, query, inlineResolver()).then(data => {
      if (data.errors && data.errors.length > 0) {
        throw data.errors[0]
      }
    })
  })

  it('returns a correct FieldSet for interface query with inline fragment type and directive', () => {
    expect.assertions(12)

    const query = `
      query Interfaced {
        hero(episode: NEWHOPE) {
          ... on Character {
            name(encoding: "UTF-8")
            appearsIn
          }

          ... on Human @include(if: false) {
            name(encoding: "UTF-8")
            appearsIn
          }

          ... on Droid @skip(if: true) {
            name(encoding: "UTF-8")
            appearsIn
          }

          ... on Droid @skip(if: true) @include(if: false) {
            name(encoding: "UTF-8")
            appearsIn
          }
        }
      }
    `

    return graphql(swSchema, query, inlineResolver()).then(data => {
      if (data.errors && data.errors.length > 0) {
        throw data.errors[0]
      }
    })

  })

  it('returns a correct FieldSet for interface query with inline fragment', () => {
    expect.assertions(26)

    const query = `
      query Interfaced {
        hero(episode: NEWHOPE) {
          ... on Human {
            name
            homePlanet
          }
          ... on Droid {
            name(encoding: "DROIDESE")
            primaryFunction
          }
        }
      }
    `
    const rootResolver
      = {
        hero(_1: never, _2: never, info: GraphQLResolveInfo) {
          const fieldset = getFieldSet(info)

          expect(fieldset).toBeDefined()
          expect(fieldset.kind).toBe('abstract')

          if (fieldset && fieldset.kind === 'abstract') {
            expect(fieldset.children).toHaveLength(0)
            expect(fieldset.possibleSets).toHaveLength(2)
            const ifHuman = fieldset.possibleSets.find(s => s.type.name === 'Human')
            const ifDroid = fieldset.possibleSets.find(s => s.type.name === 'Droid')

            expect(ifHuman).toBeDefined()
            expect(ifDroid).toBeDefined()

            if (ifHuman) {
              expect(ifHuman.type).toBe(info.schema.getType('Human')!)
              const humanFields = ifHuman.children as FieldSet[]
              expect(humanFields).toHaveLength(2)

              const humanName = humanFields.find(f => f.fieldName === 'name')
              const humanPlanet = humanFields.find(f => f.fieldName === 'homePlanet')

              expect(humanName).toBeDefined()
              expect(humanPlanet).toBeDefined()

              if (humanName) {
                expect(humanName.fieldName).toBe('name')
                expect(humanName.type).toEqual(GraphQLString)
                expect(humanName.args).toEqual({})
              }

              if (humanPlanet) {
                expect(humanPlanet.fieldName).toBe('homePlanet')
                expect(humanPlanet.type).toEqual(GraphQLString)
                expect(humanPlanet.args).toEqual({})
              }
            }

            if (ifDroid) {
              expect(ifDroid.type).toBe(info.schema.getType('Droid')!)

              const droidFields = ifDroid.children as FieldSet[]
              expect(droidFields).toHaveLength(2)

              const droidName = droidFields.find(f => f.fieldName === 'name')
              const droidFunction = droidFields.find(f => f.fieldName === 'primaryFunction')

              expect(droidName).toBeDefined()
              expect(droidFunction).toBeDefined()

              if (droidName) {
                expect(droidName.fieldName).toBe('name')
                expect(droidName.type).toEqual(GraphQLString)
                expect(droidName.args).toEqual({ encoding: 'DROIDESE' })
              }

              if (droidFunction) {
                expect(droidFunction.fieldName).toBe('primaryFunction')
                expect(droidFunction.type).toEqual(GraphQLString)
                expect(droidFunction.args).toEqual({})
              }
            }
          }
        }
      }

    return graphql(swSchema, query, rootResolver).then(data => {
      if (data.errors && data.errors.length > 0) {
        throw data.errors[0]
      }
    })
  })

  it('returns a correct FieldSet for interface query with inline fragment and shared fields', () => {
    expect.assertions(28)

    const query = `
      query Interfaced {
        hero(episode: NEWHOPE) {
          __typename
          ... {
            name(encoding: "UTF-8")
          }

          ... on Human {
            homePlanet
          }
          ... on Droid {
            primaryFunction
          }
        }
      }
    `

    const rootResolver
      = {
        hero(_1: never, _2: never, info: GraphQLResolveInfo) {
          const fieldset = getFieldSet(info)

          expect(fieldset).toBeDefined()
          expect(fieldset.kind).toBe('abstract')

          if (fieldset && fieldset.kind === 'abstract') {
            expect(fieldset.possibleSets).toHaveLength(2)
            expect(fieldset.children).toHaveLength(2)

            const sharedFields = fieldset.children

            const typename = sharedFields.find(f => f.fieldName === '__typename')
            const name = sharedFields.find(f => f.fieldName === 'name')

            expect(typename).toBeDefined()
            expect(name).toBeDefined()

            expect(typename!.kind).toBe('concrete')
            expect(name!.kind).toBe('concrete')

            if (typename && typename.kind === 'concrete') {
              expect(typename.fieldName).toBe('__typename')
              expect(typename.type).toEqual(new GraphQLNonNull(GraphQLString))
              expect(typename.args).toEqual({})
            }

            if (name && name.kind === 'concrete') {
              expect(name.fieldName).toBe('name')
              expect(name.type).toEqual(GraphQLString)
              expect(name.args).toEqual({ encoding: 'UTF-8' })
            }

            const ifHuman = fieldset.possibleSets.find(s => s.type.name === 'Human')
            const ifDroid = fieldset.possibleSets.find(s => s.type.name === 'Droid')

            expect(ifHuman).toBeDefined()
            expect(ifDroid).toBeDefined()

            if (ifHuman) {
              expect(ifHuman.type).toBe(info.schema.getType('Human')!)
              const humanFields = ifHuman.children as FieldSet[]
              expect(humanFields).toHaveLength(1)

              const humanPlanet = humanFields.find(f => f.fieldName === 'homePlanet')

              expect(humanPlanet).toBeDefined()

              if (humanPlanet) {
                expect(humanPlanet.fieldName).toBe('homePlanet')
                expect(humanPlanet.type).toEqual(GraphQLString)
                expect(humanPlanet.args).toEqual({})
              }
            }

            if (ifDroid) {
              expect(ifDroid.type).toBe(info.schema.getType('Droid')!)

              const droidFields = ifDroid.children as FieldSet[]
              expect(droidFields).toHaveLength(1)

              const droidFunction = droidFields.find(f => f.fieldName === 'primaryFunction')

              expect(droidFunction).toBeDefined()

              if (droidFunction) {
                expect(droidFunction.fieldName).toBe('primaryFunction')
                expect(droidFunction.type).toEqual(GraphQLString)
                expect(droidFunction.args).toEqual({})
              }
            }
          }
        }
      }

    return graphql(swSchema, query, rootResolver).then(data => {
      if (data.errors && data.errors.length > 0) {
        throw data.errors[0]
      }
    })
  })

  it('returns a correct FieldSet for interface query with fragment spreads and shared fields', () => {
    expect.assertions(28)

    const query = `
      fragment HumanFrag on Human {
        homePlanet
      }
      fragment DroidFrag on Droid {
        primaryFunction
      }
      query Interfaced {
        hero(episode: NEWHOPE) {
          __typename
          name(encoding: "UTF-8")
          ...HumanFrag
          ...DroidFrag
        }
      }
    `
    const rootResolver
      = {
        hero(_1: never, _2: never, info: GraphQLResolveInfo) {
          const fieldset = getFieldSet(info)

          expect(fieldset).toBeDefined()
          expect(fieldset.kind).toBe('abstract')

          if (fieldset && fieldset.kind === 'abstract') {
            expect(fieldset.possibleSets).toHaveLength(2)
            expect(fieldset.children).toHaveLength(2)

            const sharedFields = fieldset.children

            const typename = sharedFields.find(f => f.fieldName === '__typename')
            const name = sharedFields.find(f => f.fieldName === 'name')
            expect(typename).toBeDefined()
            expect(name).toBeDefined()

            expect(typename!.kind).toBe('concrete')
            expect(name!.kind).toBe('concrete')

            if (typename && typename.kind === 'concrete') {
              expect(typename.fieldName).toBe('__typename')
              expect(typename.type).toEqual(new GraphQLNonNull(GraphQLString))
              expect(typename.args).toEqual({})
            }

            if (name && name.kind === 'concrete') {
              expect(name.fieldName).toBe('name')
              expect(name.type).toEqual(GraphQLString)
              expect(name.args).toEqual({ encoding: 'UTF-8' })
            }

            const ifHuman = fieldset.possibleSets.find(s => s.type.name === 'Human')
            const ifDroid = fieldset.possibleSets.find(s => s.type.name === 'Droid')

            expect(ifHuman).toBeDefined()
            expect(ifDroid).toBeDefined()

            if (ifHuman) {
              expect(ifHuman.type).toBe(info.schema.getType('Human')!)
              const humanFields = ifHuman.children as FieldSet[]
              expect(humanFields).toHaveLength(1)

              const humanPlanet = humanFields.find(f => f.fieldName === 'homePlanet')

              expect(humanPlanet).toBeDefined()

              if (humanPlanet) {
                expect(humanPlanet.fieldName).toBe('homePlanet')
                expect(humanPlanet.type).toEqual(GraphQLString)
                expect(humanPlanet.args).toEqual({})
              }
            }

            if (ifDroid) {
              expect(ifDroid.type).toBe(info.schema.getType('Droid')!)

              const droidFields = ifDroid.children as FieldSet[]
              expect(droidFields).toHaveLength(1)

              const droidFunction = droidFields.find(f => f.fieldName === 'primaryFunction')

              expect(droidFunction).toBeDefined()

              if (droidFunction) {
                expect(droidFunction.fieldName).toBe('primaryFunction')
                expect(droidFunction.type).toEqual(GraphQLString)
                expect(droidFunction.args).toEqual({})
              }
            }
          }
        }
      }

    return graphql(swSchema, query, rootResolver).then(data => {
      if (data.errors && data.errors.length > 0) {
        throw data.errors[0]
      }
    })
  })

  it('returns a correct FieldSet for interface query with fragment spreads conditioned on the interface type', () => {
    expect.assertions(12)

    const query = `
      fragment Frag on Character {
        name(encoding: "UTF-8")
        appearsIn
      }

      query Interfaced {
        hero(episode: NEWHOPE) {
          ...Frag
        }
      }
    `

    return graphql(swSchema, query, inlineResolver()).then(data => {
      if (data.errors && data.errors.length > 0) {
        throw data.errors[0]
      }
    })
  })

  // tslint:disable-next-line:max-line-length
  it('returns a correct FieldSet for interface query with self-referencing fragment spreads on the interface type', () => {
    const query = `
      fragment nameFrag on Character {
        name(encoding: "UTF-8")
      }

      fragment allFrag on Character {
        ...nameFrag
        appearsIn
      }

      query Interfaced {
        hero(episode: NEWHOPE) {
          ...allFrag
        }
      }
    `

    return graphql(swSchema, query, inlineResolver()).then(data => {
      if (data.errors && data.errors.length > 0) {
        throw data.errors[0]
      }
    })
  })

  it('returns a correct FieldSet for interface query with self-referencing fragment spreads', () => {
    expect.assertions(14)

    const query = `
      fragment allFrag on Human {
        ...nameFrag
        appearsIn
      }

      fragment nameFrag on Character {
        name(encoding: "UTF-8")
      }

      query Interfaced {
        hero(episode: NEWHOPE) {
          ...allFrag
        }
      }
    `
    const rootResolver = {
      hero(_1: never, _2: never, info: GraphQLResolveInfo) {
        const fieldset = getFieldSet(info)

        expect(fieldset).toBeDefined()
        expect(fieldset.kind).toBe('abstract')

        if (fieldset && fieldset.kind === 'abstract') {
          expect(fieldset.children).toHaveLength(0)
          expect(fieldset.possibleSets).toHaveLength(1)

          const ifHuman = fieldset.possibleSets.find(c => c.type.name === 'Human')
          expect(ifHuman).toBeDefined()

          if (ifHuman) {
            const humanFields = ifHuman.children as FieldSet[]
            expect(humanFields).toHaveLength(2)

            const name = humanFields.find(c => c.fieldName === 'name')
            const appearsIn = humanFields.find(c => c.fieldName === 'appearsIn')

            expect(name).toBeDefined()
            expect(appearsIn).toBeDefined()

            if (name) {
              expect(name.fieldName).toEqual('name')
              expect(name.type).toEqual(GraphQLString)
              expect(name.args).toEqual({ encoding: 'UTF-8' })
            }

            if (appearsIn) {
              expect(appearsIn.fieldName).toEqual('appearsIn')
              expect(appearsIn.type).toEqual(new GraphQLList(swSchema.getType('Episode')!))
              expect(appearsIn.args).toEqual({})
            }
          }
        }
      }
    }

    return graphql(swSchema, query, rootResolver).then(data => {
      if (data.errors && data.errors.length > 0) {
        throw data.errors[0]
      }
    })
  })

  const swUnionSchema = buildSchema(`
    enum Episode { NEWHOPE, EMPIRE, JEDI }

    union Character = Human | Droid

    type Human {
      id: String!
      name(encoding: String): String
      friends: [Character]
      appearsIn: [Episode]
      homePlanet: String
    }

    type Droid {
      id: String!
      name(encoding: String): String
      friends: [Character]
      appearsIn: [Episode]
      primaryFunction: String
    }

    type Query {
      hero(episode: Episode): Character
      human(id: String!): Human
      droid(id: String!): Droid
    }
  `)

  const unionResolver = () => ({
    hero(_1: never, _2: never, info: GraphQLResolveInfo) {
      expect.assertions(29)
      const fieldset = getFieldSet(info)

      expect(fieldset).toBeDefined()
      expect(fieldset.kind).toBe('abstract')

      if (fieldset && fieldset.kind === 'abstract') {
        expect(fieldset.possibleSets).toHaveLength(2)
        expect(fieldset.children).toHaveLength(1)

        const typename = fieldset.children.find(f => f.name === '__typename')
        expect(typename).toBeDefined()
        expect(typename!.kind).toBe('concrete')

        if (typename && typename.kind === 'concrete') {
          expect(typename.fieldName).toBe('__typename')
          expect(typename.type).toEqual(new GraphQLNonNull(GraphQLString))
          expect(typename.args).toEqual({})
        }

        const ifHuman = fieldset.possibleSets.find(c => c.type.name === 'Human')
        const ifDroid = fieldset.possibleSets.find(c => c.type.name === 'Droid')
        expect(ifHuman).toBeDefined()
        expect(ifDroid).toBeDefined()

        if (ifHuman) {
          const humanFields = ifHuman.children as FieldSet[]
          expect(humanFields).toHaveLength(2)

          const name = humanFields.find(c => c.name === 'name')
          const appearsIn = humanFields.find(c => c.name === 'appearsIn')

          expect(name).toBeDefined()
          expect(appearsIn).toBeDefined()

          if (name) {
            expect(name.fieldName).toEqual('name')
            expect(name.type).toEqual(GraphQLString)
            expect(name.args).toEqual({})
          }

          if (appearsIn) {
            expect(appearsIn.fieldName).toEqual('appearsIn')
            expect(appearsIn.type).toEqual(new GraphQLList(swUnionSchema.getType('Episode')!))
            expect(appearsIn.args).toEqual({})
          }
        }

        if (ifDroid) {
          const droidFields = ifDroid.children as FieldSet[]
          expect(droidFields).toHaveLength(2)

          const droidName = droidFields.find(c => c.name === 'name')
          const droidAppearsIn = droidFields.find(c => c.name === 'appearsIn')

          expect(droidName).toBeDefined()
          expect(droidAppearsIn).toBeDefined()

          if (droidName) {
            expect(droidName.fieldName).toEqual('name')
            expect(droidName.type).toEqual(GraphQLString)
            expect(droidName.args).toEqual({ encoding: 'UTF-8' })
          }

          if (droidAppearsIn) {
            expect(droidAppearsIn.fieldName).toEqual('appearsIn')
            expect(droidAppearsIn.type).toEqual(new GraphQLList(swUnionSchema.getType('Episode')!))
            expect(droidAppearsIn.args).toEqual({})
          }
        }
      }
    }
  })

  it('returns a correct FieldSet for union query with inline fragment and shared field', () => {
    const query = `
      query Unioned {
        hero(episode: NEWHOPE) {
          __typename
          ... on Human {
            name
            appearsIn
          }
          ... on Droid {
            name(encoding: "UTF-8")
            appearsIn
          }
        }
      }
    `

    return graphql(swUnionSchema, query, unionResolver()).then(data => {
      if (data.errors && data.errors.length > 0) {
        throw data.errors[0]
      }
    })

  })

  it('returns a correct FieldSet for union query with fragment spreads and shared field', () => {
    const query = `
      fragment forHuman on Human {
        name
        appearsIn
      }
      fragment forDroid on Droid {
        name(encoding: "UTF-8")
        appearsIn
      }
      query Unioned {
        hero(episode: NEWHOPE) {
          __typename
          ...forHuman
          ...forDroid
        }
      }
    `

    return graphql(swUnionSchema, query, unionResolver()).then(data => {
      if (data.errors && data.errors.length > 0) {
        throw data.errors[0]
      }
    })
  })

  it('returns a correct FieldSet for nested union query with fragment spreads and shared field', () => {
    const query = `
      fragment forHuman on Human {
        name
        appearsIn
        friends {
          __typename
          ...forDroid
        }
      }
      fragment forDroid on Droid {
        name(encoding: "UTF-8")
        appearsIn
      }
      query Unioned {
        hero(episode: NEWHOPE) {
          __typename
          ...forHuman
          ...forDroid
        }
      }
    `

    const droidCheck = (possibleSets: FieldSetCondition[]) => {
      const ifDroid = possibleSets.find(c => c.type.name === 'Droid')
      expect(ifDroid).toBeDefined()
      if (ifDroid) {
        const droidFields = ifDroid.children as FieldSet[]
        expect(droidFields).toHaveLength(2)

        const droidName = droidFields.find(c => c.fieldName === 'name')
        const droidAppearsIn = droidFields.find(c => c.fieldName === 'appearsIn')

        expect(droidName).toBeDefined()
        expect(droidAppearsIn).toBeDefined()

        if (droidName) {
          expect(droidName.fieldName).toEqual('name')
          expect(droidName.type).toEqual(GraphQLString)
          expect(droidName.args).toEqual({ encoding: 'UTF-8' })
        }

        if (droidAppearsIn) {
          expect(droidAppearsIn.fieldName).toEqual('appearsIn')
          expect(droidAppearsIn.type).toEqual(new GraphQLList(swUnionSchema.getType('Episode')!))
          expect(droidAppearsIn.args).toEqual({})
        }
      }
    }

    const rootResolver = ({
      hero(_1: never, _2: never, info: GraphQLResolveInfo) {
        expect.assertions(44)
        const fieldset = getFieldSet(info)

        expect(fieldset).toBeDefined()
        expect(fieldset.kind).toBe('abstract')

        if (fieldset && fieldset.kind === 'abstract') {
          expect(fieldset.possibleSets).toHaveLength(2)
          expect(fieldset.children).toHaveLength(1)

          const typename = fieldset.children.find(f => f.fieldName === '__typename')
          expect(typename).toBeDefined()
          expect(typename!.kind).toBe('concrete')

          if (typename && typename.kind === 'concrete') {
            expect(typename.fieldName).toBe('__typename')
            expect(typename.type).toEqual(new GraphQLNonNull(GraphQLString))
            expect(typename.args).toEqual({})
          }

          droidCheck(fieldset.possibleSets)
          const ifHuman = fieldset.possibleSets.find(c => c.type.name === 'Human')
          expect(ifHuman).toBeDefined()

          if (ifHuman) {
            const humanFields = ifHuman.children as FieldSet[]
            expect(humanFields).toHaveLength(3)

            const name = humanFields.find(c => c.fieldName === 'name')
            const appearsIn = humanFields.find(c => c.fieldName === 'appearsIn')
            const friends = humanFields.find(c => c.fieldName === 'friends')

            expect(name).toBeDefined()
            expect(appearsIn).toBeDefined()
            expect(friends).toBeDefined()

            if (name) {
              expect(name.fieldName).toEqual('name')
              expect(name.type).toEqual(GraphQLString)
              expect(name.args).toEqual({})
            }

            if (appearsIn) {
              expect(appearsIn.fieldName).toEqual('appearsIn')
              expect(appearsIn.type).toEqual(new GraphQLList(swUnionSchema.getType('Episode')!))
              expect(appearsIn.args).toEqual({})
            }

            if (friends) {
              expect(friends.fieldName).toEqual('friends')
              expect(friends.type).toEqual(new GraphQLList(swUnionSchema.getType('Character')!))
              expect(friends.args).toEqual({})
              expect(friends.kind).toBe('abstract')
              if (friends.kind === 'abstract') {
                droidCheck(friends.possibleSets)
              }
            }
          }
        }
      }
    })

    return graphql(swUnionSchema, query, rootResolver).then(data => {
      if (data.errors && data.errors.length > 0) {
        throw data.errors[0]
      }
    })
  })

})
