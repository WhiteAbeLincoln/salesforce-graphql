export type DescribeSObjectResult = {
    actionOverrides: ActionOverride[],
    activateable: boolean,
    childRelationships?: (ChildRelationship | null)[] | null,
    compactLayoutable: boolean,
    createable: boolean,
    custom: boolean,
    customSetting: boolean,
    deletable: boolean,
    deprecatedAndHidden: boolean,
    feedEnabled: boolean,
    fields?: Field[] | null,
    hasSubtypes: boolean,
    isSubtype: boolean,
    keyPrefix?: string | null,
    label: string,
    labelPlural: string,
    layoutable: boolean,
    listviewable?: null,
    lookupLayoutable?: null,
    mergeable: boolean,
    mruEnabled: boolean,
    name: string,
    namedLayoutInfos: (NamedLayoutInfo | null)[] | null,
    networkScopeFieldName?: string,
    queryable: boolean,
    recordTypeInfos?: (RecordTypeInfo | null)[] | null,
    replicateable: boolean,
    retrieveable: boolean,
    searchLayoutable: boolean,
    searchable: boolean,
    supportedScopes?: ScopeInfo[] | null,
    triggerable: boolean,
    undeleteable: boolean,
    updateable: boolean,
    urlDetail?: string
    urlEdit?: string
    urlNew?: string
    urls: SObjectURL
};

export type ActionOverride = {
    formFactor: string
    isAvailableInTouch: boolean
    name: string
    pageId: string
    url: string
}

export type NamedLayoutInfo = {
    name: string
    urls: { layout: string }
}

export type ChildRelationship = {
    cascadeDelete: boolean,
    childSObject: string,
    deprecatedAndHidden: boolean,
    field: string,
    junctionIdListNames?: (string | null)[] | null
    junctionReferenceTo?: (string | null)[] | null
    relationshipName?: string | null,
    restrictedDelete: boolean
}

export type SObjectURL = {
    rowTemplate: string,
    defaultValues: string,
    describe: string,
    sobject: string
    compactLayouts?: string | null
    approvalLayouts?: string | null
    uiDetailTemplate?: string | null
    uiEditTemplate?: string | null
    uiNewRecord?: string | null
    listviews?: string | null
    quickActions?: string | null
    layouts?: string | null
    caseArticleSuggestions?: string | null
    passwordUtilities?: string | null
    push?: string | null
    namedLayouts?: string | null
}

export type PicklistEntry = {
    active: boolean,
    defaultValue: boolean,
    label?: string | null,
    /** salesforce says this is a byte[]. Will be base64 */
    validFor?: string | null,
    value: string
}

export type RecordTypeInfo = {
    available: boolean,
    defaultRecordTypeMapping: boolean,
    master: boolean,
    name: string,
    recordTypeId: string,
    urls: { layout: string }
}

export type ScopeInfo = {
    label: string,
    name: string,
}

export type FieldType =
    | 'string'
    | 'boolean'
    | 'int'
    | 'double'
    | 'date'
    | 'datetime'
    | 'base64'
    | 'id'
    | 'reference'
    | 'currency'
    | 'textarea'
    | 'percent'
    | 'phone'
    | 'url'
    | 'email'
    | 'combobox'
    | 'picklist'
    | 'multipicklist'
    | 'anyType'
    | 'location'
    // not official in documentation, but describe json files contain this value
    | 'time'
    | 'encryptedstring'

export type SOAPType =
    | 'tns:ID'
    | 'xsd:anyType'
    | 'xsd:base64Binary'
    | 'xsd:boolean'
    | 'xsd:date'
    | 'xsd:dateTime'
    | 'xsd:double'
    | 'xsd:int'
    | 'xsd:string'
    // not official in the documentation, but describe is still returning some with this value
    | 'xsd:time'

export type Field = {
    aggregatable: boolean,
    autoNumber: boolean,
    byteLength: number,
    calculated: boolean,
    calculatedFormula?: string | null,
    cascadeDelete: boolean,
    caseSensitive: boolean,
    compoundFieldName?: string | null,
    controllerName?: string | null,
    createable: boolean,
    custom: boolean,
    defaultValue?: (boolean | string | null),
    defaultValueFormula?: string,
    defaultedOnCreate: boolean,
    dependentPicklist: boolean,
    deprecatedAndHidden: boolean,
    digits: number,
    displayLocationInDecimal: boolean,
    encrypted: boolean,
    externalId: boolean,
    extraTypeInfo?: string | null,
    filterable: boolean,
    filteredLookupInfo?: FilteredLookupInfo | null,
    formula?: string | null,
    groupable: boolean,
    highScaleNumber: boolean,
    htmlFormatted: boolean,
    idLookup: boolean,
    inlineHelpText?: string | null,
    label: string,
    length: number,
    mask?: string | null,
    maskType?: string | null,
    name: string,
    nameField: boolean,
    namePointing: boolean,
    nillable: boolean,
    permissionable: boolean,
    picklistValues?: (PicklistEntry | null)[] | null,
    precision: number,
    queryByDistance: boolean,
    referenceTargetField?: string | null,
    referenceTo?: (string | null)[] | null,
    relationshipName?: string | null,
    relationshipOrder?: 0 | 1 | null,
    restrictedDelete: boolean,
    restrictedPicklist: boolean,
    scale: number,
    searchPrefilterable?: boolean | null,
    soapType: SOAPType,
    sortable: boolean,
    type: FieldType,
    unique: boolean,
    updateable: boolean,
    writeRequiresMasterRead: boolean
}

export type FilteredLookupInfo = {
    controllingFields?: (string | null)[] | null
    dependent: boolean
    optionalFilter: boolean
}
