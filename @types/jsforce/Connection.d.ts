import { OAuth2, OAuth2Options } from "./OAuth2";
import { Bulk } from "./Bulk";
import { Query } from "./Query";
import { SObject } from "./SObject";
import { DeletedRecordsInfo, CallbackFunc, DescribeGlobalResult,
    QueryResult, Record, RecordResult, UserInfo } from "./global";
import { DescribeSObjectResult } from "./Describe"

export type ConnectionOptions = {
  oauth2: OAuth2 | OAuth2Options,
  logLevel: string,
  version: string
  maxRequest: number,
  loginUrl: string,
  instanceUrl: string,
  serverUrl: string,
  accessToken: string,
  sessionId: string,
  refreshToken: string,
  signedRequest: string | Object,
  proxyUrl: string,
  callOptions: Object,
  redirectUri: string,
};


export type IdentityInfo = any;

export class Connection {
  constructor(options: Partial<ConnectionOptions>);
  /** Bulk api object */
  bulk: Bulk
  /** OAuth2 object */
  oauth2: OAuth2
  /**
   * Authorize using oauth2 web server flow
   * @param code Authorization code
   * @param callback Callback function
   */
  authorize(code: string, callback?: CallbackFunc<UserInfo>): Promise<UserInfo>
  create(type: string, records: Record | Array<Record>, options?: Object, callback?: CallbackFunc<RecordResult | Array<RecordResult>>): Promise<RecordResult | Array<RecordResult>>

  /**
   * Delete records
   * @param ids An ID or array of IDs to delete
   * @param options Options for rest api
   * @param callback Callback function
   */
  destroy(type: string, ids: string | string[], options?: Object, callback?: CallbackFunc<RecordResult | RecordResult[]>): Promise<RecordResult | RecordResult[]>
  del(type: string, ids: string | string[], options?: Object, callback?: CallbackFunc<RecordResult | RecordResult[]>): Promise<RecordResult | RecordResult[]>
  delete(type: string, ids: string | string[], options?: Object, callback?: CallbackFunc<RecordResult | RecordResult[]>): Promise<RecordResult | RecordResult[]>

  /**
   * Retrieve deleted records
   * @param type SObject type
   * @param start Start date or string representing the start of the interval
   * @param end End date or string representing the end of the interval, must be > start
   * @param callback Callback function
   */
  deleted(type: string, start: string | Date, end: string | Date, callback?: CallbackFunc<DeletedRecordsInfo>): Promise<DeletedRecordsInfo>

  describe(type: string, callback?: CallbackFunc<DescribeSObjectResult>): Promise<DescribeSObjectResult>
  describeSObject(type: string, callback?: CallbackFunc<DescribeSObjectResult>): Promise<DescribeSObjectResult>
  /** Caching version of describe */
  describe$(type: string, callback?: CallbackFunc<DescribeSObjectResult>): Promise<DescribeSObjectResult>
  /** Caching version of describe */
  describeSObject$(type: string, callback?: CallbackFunc<DescribeSObjectResult>): Promise<DescribeSObjectResult>

  describeGlobal(callback?: CallbackFunc<DescribeGlobalResult>): Promise<DescribeGlobalResult>;

  identity(callback?: CallbackFunc<IdentityInfo>): Promise<IdentityInfo>;

  login(username: string, password: string, callback?: CallbackFunc<UserInfo>): Promise<UserInfo>;
  sobject(resource: string): SObject
  query(soql: string, callback?: CallbackFunc<QueryResult>): Query<QueryResult>
}