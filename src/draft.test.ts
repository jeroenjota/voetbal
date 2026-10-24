import { describe, expect, it } from 'vitest'
import { readDraftState, writeDraft } from './draft'

function memoryStorage() {
  const data = new Map<string, string>()
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, data }
}

describe('draft storage', () => {
  it('stores drafts per pool', () => {
    const storage = memoryStorage()
    writeDraft(1, { entry: { name: 'Jan' } }, storage)
    writeDraft(2, { entry: { name: 'Piet' }, submittedId: 9, submittedAt: '2030-06-01T10:00:00Z' }, storage)
    expect(readDraftState(1, storage)).toEqual({ entry: { name: 'Jan' } })
    expect(readDraftState(2, storage)?.submittedId).toBe(9)
    expect(readDraftState(3, storage)).toBeNull()
  })

  it('ignores corrupt or foreign data', () => {
    const storage = memoryStorage()
    storage.setItem('vbpool:entry:pool:1', '{not json')
    storage.setItem('vbpool:entry:pool:2', '"text"')
    storage.setItem('vbpool:entry:pool:3', '{"answers":{}}')
    expect(readDraftState(1, storage)).toBeNull()
    expect(readDraftState(2, storage)).toBeNull()
    expect(readDraftState(3, storage)).toBeNull()
  })
})
