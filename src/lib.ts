
import * as Bluebird from 'bluebird'
import fetch, {RequestInit} from 'node-fetch'
import * as fse from 'fs-extra'
import {differenceBy,
    differenceWith,
    isEqual,
    intersectionBy,
    intersectionWith,
    flatten,
    cloneDeep
} from 'lodash'
import {Configuration} from './config'

/**
 * Executes a fetch against Kibana.
 */
function kibana(config: Configuration, path: string, init: RequestInit = {}) {
    const finalInit = cloneDeep(init)
    finalInit.headers = Object.assign({}, finalInit.headers || {}, config.kibana.headers)
    finalInit.headers['kbn-xsrf'] = 'kibana'
    return fetch(`${config.kibana.url}${path}`, finalInit).then(r => r.json())
}

/**
 * Lists all exportable items of the configured types currently in Kibana.
 *
 * @param config
 */
function getExportableItems(config: Configuration) {
    return Bluebird.map(config.types, async (type) => {
        const fetchPage = (page) => kibana(config, `/api/saved_objects/_find?type=${type}&page=${page}`)
            .then(async (response) => {
                let thoseResults = []

                // See if we should continue to the next page.
                if(parseInt(response.per_page) * parseInt(response.page) < parseInt(response.total)) {
                    thoseResults = await fetchPage(parseInt(response.page) + 1);
                }

                return response.saved_objects.map(cleanExportableItem).concat(thoseResults)
            });

        return fetchPage(1)
    }).then(flatten);
}

/**
 * Gets all of the locally exported items.
 *
 * @param config
 */
function getExportedItems(config: Configuration) {
    return Bluebird.map(config.types, async (type) => {
        const dir = `${config.directory}/${type}`
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
            .then(items => items.map(cleanExportableItem))
    }) .then(flatten)
}

/**
 * Removes the updated_at and version properties from an export item.
 *
 * These properties cause Kibana to choke on import, and muddy the
 * waters for comparisons.
 */
function cleanExportableItem({updated_at, version, ...props}) {
    return props
}

/**
 * Exports all of Kibanas saved objects to local storage.
 *
 * @param config
 */
export async function exportAll(config: Configuration): Promise<number> {
    const stuff = await getExportableItems(config);

    // Clean up first, as long as we have a clear export.
    await Bluebird.map(config.types, type => {
        return fse.remove(`${config.directory}/${type}`)
    })

    // Finally, write the files.
    await Bluebird.map(stuff, async function(exp) {
        const dir = `${config.directory}/${exp.type}`
        return fse.outputJSON(`${dir}/${exp.id}.json`, exp, {spaces: 4})
    });
    return stuff.length;
}

/**
 * Imports all of the locally saved objects to Kibana.
 *
 * @param config
 */
export async function importAll(config: Configuration): Promise<number> {
    const stuff = await getExportedItems(config)
        // Strip off the updated_at property, which causes Kibana to choke on import.
        .then(objects => objects.map(cleanExportableItem))

    // Send off all the imports to the bulk create endpoint.
    const response = await kibana(config, `/api/saved_objects/_bulk_create?overwrite=true`, {
        method: 'POST',
        body: JSON.stringify(stuff)
    });
    // Verify the response is ok.
    if(response.error) {
        throw new Error(`There was a problem during the import:\n${response.message}`);
    }
    // Verify none of the items had import errors.
    const errorItems = response.saved_objects.filter(obj => obj.hasOwnProperty('error'));
    if(errorItems.length) {
        const errStrings = errorItems.map(item => `${item.type}:${item.id}: ${item.error.message}`)
        throw new Error('There was a problem during the import:\n' + errStrings.join('\n'))
    }
    return stuff.length;
}

interface VizItem {
    id: string
    type: string,
    attributes: {title: string, [key: string]: any}
    [key: string]: any
}
export interface StatusItem {
    key: string,
    status: string,
    title: string,
    type: string
}

export async function listChanges(config: Configuration): Promise<Array<StatusItem>> {
    const exportable = await getExportableItems(config)
    const exported = await getExportedItems(config)

    // Callback to determine the canonical key for a saved object.
    const ident = (item: VizItem): string => `${item.type}:${item.id}`
    // Callback to convert an VizItem item to a status item.
    const createConverter = (status) => {
        return (item: VizItem): StatusItem => {
            return {key: ident(item), status, type: item.type, title: item.attributes.title}
        };
    }

    // First calculate newly added items.
    const added = differenceBy(exportable, exported, ident)
    // Then, calculate removed items.
    const removed = differenceBy(exported, exportable, ident);

    // Calculate what has changed by finding items that exist
    // in both sets, then diffing them.
    const exportableSameObj = intersectionBy(exportable, exported, ident);
    const exportedSameObj = intersectionBy(exported, exportable, ident)
    const changed = differenceWith(exportableSameObj, exportedSameObj, isEqual)
    // Finally, calculate what hasn't changed.
    const same = intersectionWith(exportableSameObj, exportedSameObj, isEqual)

    return [].concat(
        same.map(createConverter('unchanged')),
        added.map(createConverter('added')),
        removed.map(createConverter('removed')),
        changed.map(createConverter('changed')),
    )
}
