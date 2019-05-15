
import {Exportable, Syncable, DiffResult, SyncType} from "./types";
import {differenceBy, intersectionBy, differenceWith, intersectionWith, isEqual} from 'lodash'

export default class SyncManager {
    types: SyncType[]

    constructor(types: SyncType[]) {
        this.types = types
    }

    /**
     * Sync the exports between two sources.
     *
     * @param from
     * @param to
     * @param cleanup
     */
    async sync(from: Syncable, to: Syncable, cleanup: boolean = true): Promise<DiffResult> {
        const items = await this.diff(from, to)

        const toImport = [...items.added, ...items.changed]
        const toRemove = items.removed

        if(toImport.length > 0) {
            await to.import(toImport)
        }

        if(cleanup) {
            await to.remove(toRemove)
        }
        return items
    }

    /**
     * Compare the exports from two sources.
     *
     * @param from
     * @param to
     */
    async diff(from: Syncable, to: Syncable): Promise<DiffResult> {
        const fromItems = await from.export(this.types).then(i => i.map(cleanExportableItem))
        const toItems = await to.export(this.types).then(i => i.map(cleanExportableItem))
        return diff(fromItems, toItems)
    }
}


/**
 * Compares two arrays of exportable items, and groups them into categories
 * based on whether they've changed.
 *
 * @param fromItems
 * @param toItems
 */
export function diff(fromItems: Array<Exportable>, toItems: Array<Exportable>): DiffResult {
    // Callback to determine the canonical key for a saved object.
    const ident = (item: Exportable): string => `${item.type}:${item.id}`

    // First calculate newly added items.
    const added = differenceBy(fromItems, toItems, ident)
    // Then, calculate removed items.
    const removed = differenceBy(toItems, fromItems, ident);

    // Then, calculate unchanged items.
    const unchanged = intersectionWith(fromItems, toItems, isEqual)

    // Changed items are anything that's not in the previous sets.
    const changed = differenceBy(fromItems, [...added, ...removed, ...unchanged], ident)

    return {
        unchanged,
        added,
        removed,
        changed
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