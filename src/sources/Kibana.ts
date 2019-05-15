
import fetch, {RequestInit} from "node-fetch";
import {Exportable, Syncable, KibanaConfiguration, SyncType} from "../types";
import * as Bluebird from 'bluebird'
import {cloneDeep, flatten} from "lodash";


export default class Kibana implements Syncable{
    config: KibanaConfiguration

    constructor(config: KibanaConfiguration) {
        this.config = config
    }

    async export(types: SyncType[]): Promise<Array<Exportable>> {
        return Bluebird.map(types, async (type) => {
            const fetchPage = async (page): Promise<Array<Exportable>> => {
                const response = await this.fetch(`/api/saved_objects/_find?type=${type}&page=${page}`)
                let thoseResults = []

                // See if we should continue to the next page.
                if(parseInt(response.per_page) * parseInt(response.page) < parseInt(response.total)) {
                    thoseResults = await fetchPage(parseInt(response.page) + 1);
                }
                return response.saved_objects.concat(thoseResults)
            }
            return fetchPage(1)
        }).then(flatten)
    }
    async import(items: Array<Exportable>): Promise<number> {
        const response = await this.fetch(`/api/saved_objects/_bulk_create?overwrite=true`, {
            method: 'POST',
            body: JSON.stringify(items)
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
        return response.saved_objects.length;
    }
    fetch(path, init: RequestInit = {}) {
        const finalInit = cloneDeep(init)
        finalInit.headers = Object.assign({}, finalInit.headers || {}, this.config.headers)
        finalInit.headers['kbn-xsrf'] = 'kibana'
        return fetch(`${this.config.url}${path}`, finalInit).then(r => r.json())
    }
}
