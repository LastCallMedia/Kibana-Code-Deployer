
import {Exportable, Syncable, SyncType} from "../types";
import * as Bluebird from 'bluebird'
import {flatten} from 'lodash'
import * as fse from 'fs-extra'
import {cloneDeep} from "lodash";

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
            exported.attributes.fields = JSON.parse(item.attributes.fields)
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
            // Guard against fields not being an object yet.
            if(typeof exported.attributes.fields != 'string') {
                exported.attributes.fields = JSON.stringify(item.attributes.fields)
            }
    }
    return exported
}