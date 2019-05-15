
export type SyncType = "visualization" | "dashboard" | "index-pattern" | "search" | "timelion-sheet"
export type SyncTypeList = SyncType[]

export interface Configuration {
    readonly kibana: KibanaConfiguration;
    readonly directory: string;
    readonly types: SyncTypeList;
}

/**
 * Kibana Configuration object
 */
export interface KibanaConfiguration {
    readonly url: string;
    readonly headers?: {
        readonly [k: string]: any;
    };
}

export function validate(config: Object|Configuration): config is Configuration {
    if(!(<Configuration>config).kibana || !(<Configuration>config).kibana.url) {
        throw new Error(`kibana.url must be set`)
    }
    if(!(<Configuration>config).directory) {
        throw new Error(`directory must be set`)
    }
    return true
}


export interface Exportable {
    id: string
    type: string,
    attributes: {title: string, [key: string]: any},
    updated_at?: string,
    version?: string,
    [key: string]: any
}

export interface Syncable {
    import(items: Array<Exportable>): Promise<number>
    export(types: SyncTypeList): Promise<Array<Exportable>>
}

export interface DiffResult {
    key: string
    type: string
    title: string
    status: string
}