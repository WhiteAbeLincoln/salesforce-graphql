import { Connection } from "./Connection";
import { CallbackFunc, Record, RecordResult } from "./global";
import { Parsable } from "./RecordStream";

export type BatchInfo = {
    id: string,
    jobId: string,
    state: string,
    stateMessage: string
};

export type BatchResultInfo = {
    id: string,
    batchId: string,
    jobId: string
};

export type JobInfo = {
    id: string,
    object: string,
    operation: string,
    state: string
};

export interface BulkLoadOptions {
    /** External ID field name (used when upsert operaton) */
    extIdField?: string
    concurrencyMode?: string
}

export type BulkLoadOperation = 'insert' | 'update' | 'upsert' | 'delete' | 'hardDelete'
export type BulkInput = Record[] | string

export class Bulk {
    constructor(conn: Connection);
    pollInterval: number
    pollTimeout: number;
    createJob(type: string, operation: string, options?: Object): Job
    job(jobId: string): Job
    /**
     * 
     * @param type SObject type
     * @param operation Bulk load operation ('insert', 'update', 'upsert', 'delete', or 'hardDelete')
     * @param options Options for bulk loading operation
     * @param input Input source for bulkload. Accepts Array of records, CSV string, and CSV data input stream
     * @param callback Optional callback
     */
    load(type: string, operation: BulkLoadOperation, options?: BulkLoadOptions, input?: BulkInput, callback?: CallbackFunc<RecordResult[] | BatchResultInfo[]>): Batch
    query(soql: string): Parsable
}

export class Batch implements Promise<RecordResult[]> {
    protected constructor(job: Job, batchId?: string);
    then<TResult1 = RecordResult[], TResult2 = never>(onfulfilled?: (value: RecordResult[]) => TResult1 | PromiseLike<TResult1>, onrejected?: (reason: any) => TResult2 | PromiseLike<TResult2>): Promise<TResult1 | TResult2>
    catch<TResult = never>(onrejected?: (reason: any) => TResult | PromiseLike<TResult>): Promise<RecordResult[] | TResult>
    [Symbol.toStringTag]: "Promise";

    check(callback?: CallbackFunc<BatchInfo>): Promise<BatchInfo>
    execute(input?: Array<Record> | string, callback?: CallbackFunc<Array<RecordResult> | Array<BatchResultInfo>>): Batch
    poll(interval: number, timeout: number): void
    retrieve(callback?: CallbackFunc<Array<RecordResult> | Array<BatchResultInfo>>): Promise<Array<RecordResult> | Array<BatchResultInfo>>
}

export class Job {
    protected constructor(
        bulk: Bulk,
        type?: string,
        operation?: BulkLoadOperation,
        options?: BulkLoadOptions,
        jobId?: string
    )
    /** Set the status to abort */
    abort(callback?: CallbackFunc<JobInfo>): Promise<JobInfo>
    /**
     * Get a batch instance specified by given batch ID
     * @param batchId Batch ID
     */
    batch(batchId: string): Batch
    /**
     * Check the latest job status from server
     * @param callback Callback function
     */
    check(callback?: CallbackFunc<JobInfo>): Promise<JobInfo>
    /**
     * Close opened job
     * @param callback Callback function
     */
    close(callback?: CallbackFunc<JobInfo>): Promise<JobInfo>
    /** Create a new batch instance in the job */
    createBatch(): Batch
    /**
     * Return latest jobInfo from cache
     * @param callback Callback function
     */
    info(callback?: CallbackFunc<JobInfo>): Promise<JobInfo>
    /**
     * List all registered batch info in job
     * @param callback Callback function
     */
    list(callback?: CallbackFunc<Array<BatchInfo>>): Promise<Array<BatchInfo>>
    /**
     * Open new job and get jobinfo
     * @param callback Callback function
     */
    open(callback?: CallbackFunc<JobInfo>): Promise<JobInfo>
}