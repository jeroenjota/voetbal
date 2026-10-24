import type { EntryPrediction } from '../shared/types'

export interface DraftState {
  entry: Partial<EntryPrediction>
  submittedId?: number
  submittedAt?: string
}

const key = (poolId: number) => `vbpool:entry:pool:${poolId}`

function read(poolId: number, storage: Pick<Storage, 'getItem'> = window.localStorage): DraftState | null {
  const raw = storage.getItem(key(poolId))
  if (!raw) return null
  const parsed = JSON.parse(raw) as DraftState
  return parsed && typeof parsed === 'object' && parsed.entry && typeof parsed.entry === 'object' ? parsed : null
}

export function readDraftState(poolId: number, storage?: Pick<Storage, 'getItem'>): DraftState | null {
  try {
    return read(poolId, storage)
  } catch {
    return null
  }
}

export function readDraft(poolId: number): Partial<EntryPrediction> | null {
  return readDraftState(poolId)?.entry ?? null
}

export function writeDraft(poolId: number, state: DraftState, storage: Pick<Storage, 'setItem'> = window.localStorage): void {
  storage.setItem(key(poolId), JSON.stringify(state))
}
