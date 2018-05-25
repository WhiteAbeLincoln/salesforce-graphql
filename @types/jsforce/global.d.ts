import { DescribeSObjectResult } from "./Describe";

export type ApprovalLayoutInfo = {
    approvalLayouts: Object[]
};

export type CallbackFunc<T> = (err: Error, response: T) => void;

export type CompactLayoutInfo = {
    compactLayouts: Object[],
    defaultCompactLayoutId: string,
    recordTypeCompactLayoutMappings: Object[]
};

export type DeletedRecordsInfo = {
    earliestDateAvailable: string,
    latestDateCovered: string,
    deletedRecords: { id: string, deletedDate: string }[]
};

export type DescribeGlobalResult = {
    encoding: string,
    maxBatchSize: number,
    sobjects: DescribeSObjectResult[];
};

export type LayoutInfo = {
    layouts: Object[],
    recordTypeMappings: Object[]
};

export type QueryResult = {
    done: boolean,
    nextRecordsUrl?: string,
    totalSize: number,
    records?: Record[]
};

export type Record = {[name: string]: any};
export type RecordFilterFunction = (record: Record) => boolean;
export type RecordMapFunction = (record: Record) => Record;
export type RecordResult = {
    success: boolean,
    id?: string,
    errors?: string[]
};

export type TokenResponse = {
    access_token: string,
    refresh_token: string
};

export type UserInfo = {
    id: string,
    organizationId: string,
    url: string
};