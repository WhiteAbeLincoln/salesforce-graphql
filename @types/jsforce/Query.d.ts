import { RecordFilterFunction, RecordMapFunction, RecordResult,
        Record, CallbackFunc } from './global';
import { Serializable } from './RecordStream';
import { Connection } from './Connection';
import { Batch } from './Bulk';

type ExecuteQueryOptions = {
    autoFetch?: boolean,
    maxFetch?: number,
    scanAll?: boolean
};

export type ExplainInfo = any;

export class Query<T> implements Promise<T> {
  then<TResult1 = T, TResult2 = never>(onfulfilled?: (value: T) => TResult1 | PromiseLike<TResult1>, onrejected?: (reason: any) => TResult2 | PromiseLike<TResult2>): Promise<TResult1 | TResult2>
  catch<TResult = never>(onrejected?: (reason: any) => TResult | PromiseLike<TResult>): Promise<T | TResult>
  protected constructor(conn: Connection, config: Object | string, locator?: string);
  [Symbol.toStringTag]: "Promise";
  static filter: (fn: RecordFilterFunction) => Serializable
  static map: (fn: RecordMapFunction) => Serializable
  autoFetch(autoFetch: boolean): Query<T>
  destroy(type?: string, callback?: CallbackFunc<Array<RecordResult>>): Batch
  del(type?: string, callback?: CallbackFunc<Array<RecordResult>>): Batch
  delete(type?: string, callback?: CallbackFunc<Array<RecordResult>>): Batch

  execute(options: ExecuteQueryOptions, callback?: CallbackFunc<T>): Query<T>
  exec(options: ExecuteQueryOptions, callback?: CallbackFunc<T>): Query<T>
  run(options: ExecuteQueryOptions, callback?: CallbackFunc<T>): Query<T>

  explain(callback?: CallbackFunc<ExplainInfo>): Promise<ExplainInfo>
  include(childRelName: string, conditions: Object | string, fields: Object | string[]  | string, options: {
      limit?: number,
      offset?: number,
      skip?: number
  }): SubQuery<T>

  limit(limit: number): Query<T>
  maxFetch(maxFetch: number): Query<T>
  offset(offset: number): Query<T>
  skip(skip: number): Query<T>
  scanAll(scanAll: boolean): Query<T>
  select(fields: Object | string[] | string): Query<T>
  protected setResponseTarget(responseTarget: string): Query<T>
  sort(sort: string | Object, dir?: 'ASC' | 'DESC' | 1 | -1): Query<T>
  toSOQL(callback?: CallbackFunc<string>): Promise<string>
  update(mapping: Record | RecordMapFunction, type?: string, callback?: CallbackFunc<Array<RecordResult>>): Promise<Array<RecordResult>>
  where(conditions: Object | string): Query<T>
}

export class SubQuery<T> extends Query<T> {
    protected constructor(conn: Connection, parent: Query<T>, config: Object)
    /** Back the context to parent query object */
    end(): Query<T>
}