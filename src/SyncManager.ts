
import {Exportable, Syncable, DiffResult, SyncType} from "./types";
import {differenceBy, intersectionBy, differenceWith, intersectionWith, isEqual} from 'lodash'

export default class SyncManager {
    types: SyncType[]

    constructor(types: SyncType[]) {
        this.types = types
    }
    async sync(from: Syncable, to: Syncable): Promise<number> {
        const items = await from.export(this.types)
        return to.import(items.map(cleanExportableItem))
    }
    async diff(from: Syncable, to: Syncable): Promise<Array<DiffResult>> {
        const fromItems = await from.export(this.types).then(i => i.map(cleanExportableItem))
        const toItems = await to.export(this.types).then(i => i.map(cleanExportableItem))

        // Callback to determine the canonical key for a saved object.
        const ident = (item: Exportable): string => `${item.type}:${item.id}`
        // Callback to convert an VizItem item to a status item.
        const createConverter = (status) => {
            return (item: Exportable): DiffResult => {
                return {key: ident(item), status, type: item.type, title: item.attributes.title}
            };
        }

        // First calculate newly added items.
        const added = differenceBy(fromItems, toItems, ident)
        // Then, calculate removed items.
        const removed = differenceBy(toItems, fromItems, ident);

        // Calculate what has changed by finding items that exist
        // in both sets, then diffing them.
        const exportableSameObj = intersectionBy(fromItems, toItems, ident);
        const exportedSameObj = intersectionBy(toItems, fromItems, ident)
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
}

/**
 * Removes the updated_at and version properties from an export item.
 *
 * These properties cause Kibana to choke on import, and muddy the
 * waters for comparisons.
 */
function cleanExportableItem({updated_at, version, ...props}: Exportable): Exportable {
    return props
}