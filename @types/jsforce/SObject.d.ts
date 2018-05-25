import { CallbackFunc, ApprovalLayoutInfo, Record, RecordResult, CompactLayoutInfo, DeletedRecordsInfo } from './global';
import { BulkLoadOptions, Batch, BulkInput } from './Bulk'
import { Query } from './Query'
import { DescribeSObjectResult } from './Describe'

export class SObject {
    /**
     * Describe approval layout information defined for SObject
     * @param callback Callback function
     */
    approvalLayouts(callback?: CallbackFunc<ApprovalLayoutInfo>): Promise<ApprovalLayoutInfo>
    /**
     * Call Bulk#load() to execute bulkload, returning batch object
     * @param operation Bulk load operation
     * @param options Options for bulk loading operation
     * @param input Input source for bulkload. Accepts array of records, CSV string, and CSV data input stream
     * @param callback Callback function
     */
    bulkload(operation: string, options?: BulkLoadOptions, input?: Record[], callback?: CallbackFunc<RecordResult[]>): Batch

    /**
     * Describe compact layout information defined for SObject
     * @param callback Callback function
     */
    compactLayouts(callback?: CallbackFunc<CompactLayoutInfo>): Promise<CompactLayoutInfo>

    /**
     * Count num of records which matches given conditions
     * @param conditions Conditions in JSON object (MongoDB-like), or raw SOQL WHERE clause string
     * @param callback Callback function
     */
    count(conditions?: string | {[name: string]: any}, callback?: CallbackFunc<number>): Query<number>

    /**
     * Create records
     * @param records A record or array of records to create
     * @param options Options for rest api
     * @param callback Callback function
     */
    create(records: Record | Record[], options?: any, callback?: CallbackFunc<RecordResult | RecordResult[]>): Promise<RecordResult | RecordResult[]>

    /**
     * Bulkly insert input data using Bulk API
     * @param input Input source for bulk insert. Accepts array of records, CSV string, and CSV data input stream
     * @param callback Callback function
     */
    createBulk(input?: BulkInput, callback?: CallbackFunc<RecordResult[]>): Batch

    /** Synonym of SObject#destroy() */
    del(ids: string | string[], callback?: CallbackFunc<RecordResult | RecordResult[]>): Promise<RecordResult | RecordResult[]>
    /** Synonym of SObject#destroy() */
    delete(ids: string | string[], callback?: CallbackFunc<RecordResult | RecordResult[]>): Promise<RecordResult | RecordResult[]>

    /**
     * Retrieve the deleted records
     * @param start Start date or string representing the start of the interval
     * @param end End date or string representing the end of the interval, must be > start
     * @param callback Callback function
     */
    deleted(start: string | Date, end: string | Date, callback?: CallbackFunc<DeletedRecordsInfo>): Promise<DeletedRecordsInfo>

    /**
     * Delete records
     * @param ids An ID or array of IDs to delete
     * @param options Options for rest api
     * @param callback Callback function
     */
    destroy(ids: string | string[], options?: any, callback?: CallbackFunc<RecordResult | RecordResult[]>): Promise<RecordResult | RecordResult[]>

    describe(callback?: CallbackFunc<DescribeSObjectResult>): Promise<DescribeSObjectResult>
    /** Caching version of describe */
    describe$: {
        (callback?: CallbackFunc<DescribeSObjectResult>): Promise<DescribeSObjectResult>
        clear: () => void
    }
}