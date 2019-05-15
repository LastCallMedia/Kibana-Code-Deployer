
import {diff} from '../src/SyncManager'
import {cloneDeep} from "lodash";

describe('Diff', function() {
    const a = {
        id: 'foo',
        type: 'bar',
        attributes: {
            title: 'Item A'
        }
    }
    const a_modified = {
        id: 'foo',
        type: 'bar',
        attributes: {
            title: 'Item B',
        }
    };
    const b = {
        id: 'bar',
        type: 'bar',
        attributes: {
            title: 'Item A'
        }
    }

    it('Should not detect differences between similar items', function () {
        const res = diff([a], [cloneDeep(a)])
        expect(res.unchanged[0]).toBe(a);
        expect(res.changed).toEqual([])
        expect(res.added).toEqual([])
        expect(res.removed).toEqual([])
    })

    it('Should detect differences between items', function() {
        const res = diff([a], [a_modified])
        expect(res.unchanged).toEqual([])
        expect(res.changed[0]).toBe(a)
        expect(res.added).toEqual([])
        expect(res.removed).toEqual([])
    })

    it('Should detect added items', function () {
        const res = diff([a, b], [a])
        expect(res.added[0]).toBe(b)
    });

    it('Should detect removed items', function() {
        const res = diff([a], [a, b])
        expect(res.unchanged).toEqual([a])
        expect(res.changed).toEqual([])
        expect(res.added).toEqual([])
        expect(res.removed[0]).toBe(b)
    })
})