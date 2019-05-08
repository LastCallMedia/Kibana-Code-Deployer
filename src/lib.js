
const Promise = require('bluebird');
const fetch = require('node-fetch');
const fse = require('fs-extra');
const diff = require('diff');
const {flatten} = require('./util');

// Types of things we'll consider exporting:
const types = [
    'index-pattern',
    'visualization',
    'dashboard'
];

function getExportableItems(kibana_url) {
    return Promise.map(types, async (type) => {
        return fetch(`${kibana_url}/api/saved_objects/_find?type=${type}`)
            .then(response => response.json())
            .then(response => response.saved_objects)
            .then(items => items.map(({updated_at, ...props}) => props))
    }).then(flatten);
}

function getExportedItems(directory) {
    return Promise.map(types, async (type) => {
        const dir = `${directory}/${type}`
        if(!await fse.exists(dir)) {
            return []
        }
        return fse.readdir(dir)
        // Tack on the directory to the filename.
            .then(files => files.map(filename => `${dir}/${filename}`))
            // Filter out directories.
            .then(files => files.filter(file => fse.statSync(file).isFile()))
            // Read the JSON from the files.
            .then(files => Promise.map(files, f => fse.readJSON(f)))
            .then(items => items.map(({updated_at, ...props}) => props))
    }) .then(flatten)
}

async function exportAll(kibana_url, directory) {
    const stuff = await getExportableItems(kibana_url);

    // Clean up first, as long as we have a clear export.
    await Promise.map(types, type => {
        return fse.remove(`${directory}/${type}`)
    })

    // Finally, write the files.
    return Promise.map(stuff, async function(exp) {
        const dir = `${directory}/${exp.type}`
        return fse.outputJSON(`${dir}/${exp.id}.json`, exp, {spaces: 4})
    });
}

async function importAll(kibana_url, directory) {
    const stuff = await getExportedItems(directory)
    // Strip off the updated_at property, which causes Kibana to choke on import.
        .then(objects => {
            return objects.map(object => {
                if(object.hasOwnProperty('updated_at')) {
                    delete object.updated_at
                }
                return object
            })
        })

    // Send off all the imports to the bulk create endpoint.
    const response = await fetch(`${kibana_url}/api/saved_objects/_bulk_create?overwrite=true`, {
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

async function listChanges(kibana_url, directory) {
    function cleanProperties(items) {
        return items.map(({version, updated_at, ...props}) => props)
    }
    const exportable = await getExportableItems(kibana_url)
        .then(items => cleanProperties(items));
    const exported = await getExportedItems(directory)
        .then(items => cleanProperties(items));

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

module.exports = {
    listChanges,
    importAll,
    exportAll
}