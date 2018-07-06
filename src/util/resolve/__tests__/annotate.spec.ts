import { SalesforceObjectConfig, BuildObjectsMiddleware,
  ResolverMiddleware, salesforceObjectConfig, leafField, parentField, childField, Arg3 } from '../../../types'
import { mergeObjs } from '../../util'
import { middleware, resolver as offsetResolver } from '../../../Pagination/Offset'
import { Endomorphism } from 'fp-ts/lib/function'
import { GraphQLFieldConfig, GraphQLSchema, graphql, GraphQLString, GraphQLResolveInfo } from 'graphql'
import { buildGraphQLObjects } from '../../../buildSchema'
import { annotateFieldSet, AnnotatedAbstractFieldSet } from '../annotate'
import { getFieldSet } from '../../GraphQLUtils'

// tslint:disable:no-expression-statement

const boilerplate = (objects: SalesforceObjectConfig[],
                     rootQuery: SalesforceObjectConfig,
                     test: (objMap: { [x: string]: SalesforceObjectConfig }, info: GraphQLResolveInfo) => void,
                     res: (query: string) => Promise<any[] | null>,
                     gqlQuery: string) => {
  const objectMap = mergeObjs(...objects.map(o => ({ [o.name]: o })))

  const resolveFun: ResolverMiddleware = (root, objMap) => (source, args, context, info) => {
    test(objMap, info)
    return offsetResolver(_ => res)(root, objMap)(source, args, context, info)
  }

  const resolverMiddleware: Endomorphism<GraphQLFieldConfig<any, any>>
    = config => ({ ...config, resolve: resolveFun(rootQuery, objectMap) })

  const mdw: BuildObjectsMiddleware = (f, fs, p, o) => resolverMiddleware(middleware(f, fs, p, o))

  const gqlObjects = buildGraphQLObjects(objects, mdw)
  const query = gqlObjects[1][rootQuery.name]

  const schema = new GraphQLSchema({ query })

  return graphql(schema, gqlQuery).then(e => {
    if (e.errors) {
      throw e.errors[0]
    }

    return e.data
  })
}

describe('annotateFieldSet', () => {
  it('properly annotates a concrete object', () => {
    const jedi = salesforceObjectConfig('Jedi', 'A Jedi', {
      says: leafField(GraphQLString, 'string', true, 'Hello There')
    , name: leafField(GraphQLString, 'string', true, 'This jedi\'s name')
    , Master: parentField(['Jedi'], 'This jedi\'s Master')
    , Padawans: childField('Jedi', 'This jedi\'s trainees')
    })

    const rootQuery = salesforceObjectConfig('Query', 'Query', {
      [jedi.name]: childField(jedi.name, jedi.description),
    })

    const resolve = (_query: string): Promise<any[] | null> => {
      return Promise.resolve([{ name: 'Obi-Wan Kenobi', __typename: 'Jedi' }])
    }

    // tslint:disable-next-line:no-let prefer-const
    let depth = 1

    const test: Arg3<typeof boilerplate> = (objectMap, info) => {
      const parentObj = info.parentType
      const fieldSet = getFieldSet(info)
      const annotatedFields = annotateFieldSet(parentObj, fieldSet, objectMap)
      expect(annotatedFields.parentConfigObj).toBeDefined()
      expect(annotatedFields.configField).toBeDefined()

      if (depth === 1) {
        expect(annotatedFields.parentConfigObj).toEqual(rootQuery)
        expect(annotatedFields.configField).toEqual(rootQuery.fields[jedi.name])
      }

      if (depth === 2) {
        expect(annotatedFields.parentConfigObj).toEqual(jedi)
        expect(annotatedFields.configField).toEqual(jedi.fields.name)
      }

      depth++
    }

    const gqlQuery = `
      query {
        Jedi {
          name
        }
      }
    `

    return boilerplate([jedi, rootQuery], rootQuery, test, resolve, gqlQuery)
  })

  it('properly annotates an abstract object', () => {
    const jedi = salesforceObjectConfig('Jedi', 'A Jedi', {
      name: leafField(GraphQLString, 'string', true, 'This jedi\'s name')
    , Master: parentField(['Jedi'], 'This jedi\'s Master')
    , Padawans: childField('Jedi', 'This jedi\'s trainees')
    })

    const sith = salesforceObjectConfig('Sith', 'A Sith', {
      name: leafField(GraphQLString, 'string', true, 'This jedi\'s name')
    , Master: parentField(['Jedi'], 'This jedi\'s Master')
    , Apprentice: parentField(['Sith'], 'This sith\'s apprentice')
    })

    const forceUser = salesforceObjectConfig('ForceUser', 'A Force User', {
      user: parentField(['Jedi', 'Sith'], 'A Force User')
    })

    const rootQuery = salesforceObjectConfig('Query', 'Query', {
      forceUsers: childField('ForceUser', 'Force Users')
    })

    // tslint:disable-next-line:no-let prefer-const
    let depth = 1

    const resolve = (_query: string): Promise<any> => {
      return Promise.resolve([{ Id: 1, user: { Id: 11, name: 'Obi-Wan Kenobi' } }])
    }

    const test: Arg3<typeof boilerplate> = (objectMap, info) => {
      const parentObj = info.parentType
      const fieldSet = getFieldSet(info)
      const annotatedFields = annotateFieldSet(parentObj, fieldSet, objectMap)
      expect(annotatedFields.parentConfigObj).toBeDefined()
      expect(annotatedFields.configField).toBeDefined()

      if (depth === 2) {
        expect(annotatedFields.parentConfigObj).toEqual(forceUser)
        expect(annotatedFields.configField).toEqual(forceUser.fields.user)
        const possibleSets = (annotatedFields as AnnotatedAbstractFieldSet).possibleSets
        expect(possibleSets).toBeDefined()
        expect(possibleSets).toHaveLength(2)

        const jediSet = possibleSets.find(p => p.type.name === 'Jedi')!
        const sithSet = possibleSets.find(p => p.type.name === 'Sith')!

        expect(jediSet).toBeDefined()
        expect(sithSet).toBeDefined()

        expect(jediSet.kind).toBe('concreteCondition')
        expect(sithSet.kind).toBe('concreteCondition')

        if (jediSet.kind === 'concreteCondition') {
          expect(jediSet.typeConfig).toBeDefined()
          expect(jediSet.typeConfig).toEqual(jedi)
        }

        if (sithSet.kind === 'concreteCondition') {
          expect(sithSet.typeConfig).toBeDefined()
          expect(sithSet.typeConfig).toEqual(sith)
        }
      }

      depth++
    }

    const gqlQuery = `
      query {
        forceUsers {
          user {
            __typename
            ... on Jedi {
              __typename
              name
            }
            ... on Sith {
              __typename
              name
            }
          }
        }
      }
    `

    return boilerplate([jedi, sith, forceUser, rootQuery], rootQuery, test, resolve, gqlQuery)
  })
})
