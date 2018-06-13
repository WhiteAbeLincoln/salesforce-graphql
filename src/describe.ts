import { promisify } from 'util'
import { readdir, readFile as readfile, mkdir, writeFile as writefile, stat as Stat, Stats } from 'fs'
import { resolve } from 'path'
import { DescribeSObjectResult, Connection, ConnectionOptions } from 'jsforce'

const readDir = promisify(readdir)
const readFile = promisify(readfile)
const writeFile = promisify(writefile)
const mkDir = promisify(mkdir)
const stat = promisify(Stat)

type StatPair = [string, Stats]

const getStatPair = (f: string) => stat(f).then(s => [f, s] as [string, Stats])
const getFiles = (sp: ReadonlyArray<StatPair>) => sp.filter(s => s[1].isFile()).map(s => s[0])
const getDirectories = (sp: ReadonlyArray<StatPair>) => sp.filter(s => s[1].isDirectory()).map(s => s[0])

export type DescribeList = ReadonlyArray<Promise<DescribeSObjectResult>>

/**
 * Reads describe files and parses to an object
 * @param paths A list of json files and directories
 * @returns A promise for an array of promises which resolve to SObjectMetadata objects
 */
export async function importDescribeFiles(...paths: string[]): Promise<DescribeList> {
  // tslint:enable:readonly-array
  const statPairs = await Promise.all(paths.map(p => resolve(p)).map(getStatPair))

  const files = getFiles(statPairs)
  const dirs = getDirectories(statPairs)

  const subFiles = await Promise.all(
    dirs.map(d =>
      readDir(d)
        .then(fs => fs.map(f => resolve(d, f)).map(getStatPair))
        .then(sps => Promise.all(sps))
        .then(getFiles)
    )
  ).then(dirFiles => dirFiles.reduce((p, c) => [...p, ...c], []))

  return [...files, ...subFiles].map(file => readFile(file, 'utf8').then(s => JSON.parse(s)))
}

/**
 * Writes salesforce objects as json files
 * @param describes An array of SObjectMetadata objects
 * @param directory Directory to write describe files to
 * @returns An array of promises which resolve to the filename when a file is written
 */
export async function writeDescribeFiles(describes: ReadonlyArray<DescribeSObjectResult>,
                                         directory: string): Promise<ReadonlyArray<Promise<string>>> {
  try {
    // tslint:disable-next-line:no-expression-statement
    await mkDir(directory)
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err
    }
  }

  return describes.map(o => {
    const name = `${directory}/${o.name}.desc.json`
    return writeFile(`${directory}/${o.name}.desc.json`, JSON.stringify(o)).then(() => name)
  })
}

/**
 * Describes the salesforce objects of an instance
 * @param conn A logged in connection to your salesforce instance
 * @returns An array of promises which resolve to SObjectMetadata objects
 */
export async function describeSalesforceObjects(username: string,
                                                password: string,
                                                options: ConnectionOptions): Promise<DescribeList> {
  const conn = new Connection(options)

  // tslint:disable-next-line:no-expression-statement
  await conn.login(username, password)

  const global = await conn.describeGlobal()
  return global.sobjects.map(o => conn.sobject(o.name).describe())
}
