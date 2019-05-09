
import * as Bluebird from 'bluebird'
import fetch from 'node-fetch'
import * as fse from 'fs-extra'
import diff from 'diff'
import {flatten} from './util'

export interface Config {
    kibana: {url: string}
    directory: string
    types: Array<string>
}

function getExportableItems(config: Config) {
    return Bluebird.map(config.types, async (type) => {
        return fetch(`${config.kibana.url}/api/saved_objects/_find?type=${type}`)
            .then(response => response.json())
            .then(response => response.saved_objects)
            .then(items => items.map(cleanExportableItem))
    }).then(flatten);
}

function getExportedItems(config: Config) {
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

export async function exportAll(config: Config) {
    const stuff = await getExportableItems(config);

    // Clean up first, as long as we have a clear export.
    await Bluebird.map(config.types, type => {
        return fse.remove(`${config.directory}/${type}`)
    })

    // Finally, write the files.
    return Bluebird.map(stuff, async function(exp) {
        const dir = `${config.directory}/${exp.type}`
        return fse.outputJSON(`${dir}/${exp.id}.json`, exp, {spaces: 4})
    });
}

export async function importAll(config: Config) {
    const stuff = await getExportedItems(config)
        // Strip off the updated_at property, which causes Kibana to choke on import.
        .then(objects => objects.map(cleanExportableItem))

    // Send off all the imports to the bulk create endpoint.
    const response = await fetch(`${config.kibana.url}/api/saved_objects/_bulk_create?overwrite=true`, {
        method: 'POST',
        body: JSON.stringify(stuff),
        headers: {
            'kbn-xsrf': 'letmein'
        }
    }).then(res => res.json());
    // Verify the response is ok.
    if(response.error) {
        throw new Error(response.message);
    }
    return stuff.length;
}

export async function listChanges(config: Config) {
    const exportable = await getExportableItems(config)
    const exported = await getExportedItems(config)

    function hashArr(items) {
        return items.reduce((collected, item) => {
            collected.set(`${item.type}:${item.id}`, item)
            return collected
        }, new Map())
    }
    const exportableIds = hashArr(exportable)
    const exportedIds = hashArr(exported)
    const changes = {added: [], removed: [], changed: []}
    exportableIds.forEach((value, key) => {
        if(!exportedIds.has(key)) {
            changes.removed.push(key);
            return;
        }
        const diffs = diff.diffJson(value, exportedIds.get(key))
        const actualChange = diffs.filter(d => d.added || d.removed);
        if(actualChange.length > 0) {
            changes.changed.push(key);
        }
    });
    exportedIds.forEach((v, key) => {
        if(!exportableIds.has(key)) {
            changes.added.push(key);
        }
    })
    return changes
}
