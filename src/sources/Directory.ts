
import {Exportable, Syncable, SyncType} from "../types";
import * as Bluebird from 'bluebird'
import {flatten} from 'lodash'
import * as fse from 'fs-extra'

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
        await fse.emptyDir(`${this.dir}`)

        // Write the export files to the directory.
        await Bluebird.map(items, async (item) => {
            const dir = `${this.dir}/${item.type}`
            return fse.outputJSON(`${dir}/${item.id}.json`, item, {spaces: 4})
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
                .then(files => Bluebird.map(files, f => fse.readJSON(f)))
        }) .then(flatten)
    }
}