
import {Exportable, Syncable, SyncType} from "../types";
import * as Bluebird from 'bluebird'
import {flatten} from 'lodash'
import * as fse from 'fs-extra'
import {cloneDeep, get, set} from "lodash";

export default class Directory implements Syncable {
    dir: string
    constructor(dir: string) {
        this.dir = dir
    }

    /**
     * Import items into the directory.
     */
    async import(items: Array<Exportable>) {
        // Clean up previous syncs before we import.
        // await fse.emptyDir(`${this.dir}`)

        // Write the export files to the directory.
        await Bluebird.map(items, async (item) => {
            const exported = prettify(item)
            return fse.outputJSON(`${this.dir}/${item.type}/${item.id}.json`, exported, {spaces: 4})
        });
        return items.length
    }

    /**
     * Export all items of <types> from the directory.
     *
     * @param types
     */
    export(types: SyncType[]): Promise<Array<Exportable>> {
        return Bluebird.map(types, async (type) => {
            const dir = `${this.dir}/${type}`
            if(!await fse.exists(dir)) {
                return []
            }
            return fse.readdir(dir)
                // Tack on the directory to the filename.
                .then(files => files.map(filename => `${dir}/${filename}`))
                // Filter out directories.
                .then(files => files.filter(file => fse.statSync(file).isFile()))
                // Read the JSON from the files.
                .then(files => Bluebird.map(files, async (f) => {
                    const item = await fse.readJSON(f)
                    return uglify(item)
                }))
        }) .then(flatten)
    }

    remove(items: Array<Exportable>): Promise<number> {
        return Bluebird.map(items, item => {
            const filename = `${this.dir}/${item.type}/${item.id}.json`
            return fse.unlink(filename)
        })
    }
}

/**
 * Act on exportables right before they're saved to clean them up and make them
 * diffable.
 *
 * @param item
 */
function prettify(item: Exportable) {
    const exported = cloneDeep(item)
    switch(item.type) {
        case 'index-pattern':
            prettifyField(exported, 'attributes.fields')
            prettifyField(exported, 'attributes.fieldFormatMap')
            break;
        case 'visualization':
            prettifyField(exported, 'attributes.visState')
            prettifyField(exported, 'attributes.uiStateJSON');
            prettifyField(exported, 'attributes.kibanaSavedObjectMeta.searchSourceJSON');
            break;
        case 'dashboard':
            prettifyField(exported, 'attributes.panelsJSON')
            prettifyField(exported, 'attributes.optionsJSON')
            prettifyField(exported, 'attributes.kibanaSavedObjectMeta.searchSourceJSON');
            break;
        case 'search':
            prettifyField(exported, 'attributes.kibanaSavedObjectMeta.searchSourceJSON');
    }
    return exported
}

/**
 * Act on exportables right after they're ready to convert them back into standard
 * Kibana format.
 *
 * @param item
 */
function uglify(item: Exportable) {
    const exported = cloneDeep(item)
    switch(item.type) {
        case 'index-pattern':
            uglifyField(exported, 'attributes.fields')
            uglifyField(exported, 'attributes.fieldFormatMap')
            break;
        case 'visualization':
            uglifyField(exported, 'attributes.visState')
            uglifyField(exported, 'attributes.uiStateJSON');
            uglifyField(exported, 'attributes.kibanaSavedObjectMeta.searchSourceJSON');
            break;
        case 'dashboard':
            uglifyField(exported, 'attributes.panelsJSON')
            uglifyField(exported, 'attributes.optionsJSON')
            uglifyField(exported, 'attributes.kibanaSavedObjectMeta.searchSourceJSON');
            break;
        case 'search':
            uglifyField(exported, 'attributes.kibanaSavedObjectMeta.searchSourceJSON');
    }
    return exported
}

/**
 * Convert a single JSON string field into a JSON object.
 *
 * @param object
 * @param fieldName
 */
function prettifyField(object, fieldName) {
    let value = get(object, fieldName)
    // Guard against double-decoding the value.
    if(value !== undefined && typeof value === 'string') {
        set(object, fieldName, JSON.parse(value))
    }
}

/**
 * Convert a single JSON object into a JSON string.
 *
 * @param object
 * @param fieldName
 */
function uglifyField(object, fieldName) {
    let value = get(object, fieldName)
    // Guard against double-encoding the value.
    if(value !== undefined && typeof value !== 'string') {
        set(object, fieldName, JSON.stringify(value))
    }
}