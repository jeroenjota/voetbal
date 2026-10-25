import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Server } from 'node:http'
import { emptyEntry } from '../../shared/entry'
import { sampleForm } from '../../shared/fixtures'
import type { EntryPrediction, FormData } from '../../shared/types'

const state = vi.hoisted(() => ({ activePoolId: 7 as number | null, form: null as unknown, saved: [] as unknown[] }))

vi.mock('./repository', () => ({
  NotFoundError: class NotFoundError extends Error {},
  getActivePoolId: async () => state.activePoolId,
  getFormData: async () => state.form,
  saveEntry: async (_poolId: number, entry: unknown, options: unknown) => {
    state.saved.push({ entry, options })
    return 123
  },
}))

const { createApp, deadlineError, normalizeEntry } = await import('./app')

let server: Server
let base = ''

beforeAll(async () => {
  server = createApp().listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => new Promise((resolve) => server.close(resolve)))
beforeEach(() => {
  state.activePoolId = 7
  state.form = sampleForm()
  state.saved = []
})

function completeEntry(form: FormData): EntryPrediction {
  const entry = emptyEntry(form)
  Object.assign(entry, { name: 'Jan Jansen', telephone: '0612345678', email: 'jan@example.nl', payed: true, payedTo: 'Kees' })
  entry.groups.A = [1, 2, 3, 4]
  entry.finals['2'] = [1, 2]
  entry.finals['3'] = [1, 3]
  for (const key of Object.keys(entry.matches)) entry.matches[key] = { htA: 0, htB: 0, ftA: 1, ftB: 0, toto: 1 }
  entry.standings = [1, 2, null, null]
  entry.topscorer = { playerId: 100, goals: 6 }
  entry.numbers['18'] = 120
  return entry
}

const submit = (body: unknown, poolId = 7) => fetch(`${base}/api/pools/${poolId}/entries`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

describe('deadlineError', () => {
  it('checks the inschrijf period inclusive of both dates', () => {
    const form = sampleForm({ formsFrom: '2030-05-01', formsTill: '2030-06-10' })
    expect(deadlineError(form, '2030-04-30')).toMatch(/vanaf/)
    expect(deadlineError(form, '2030-05-01')).toBeNull()
    expect(deadlineError(form, '2030-06-10')).toBeNull()
    expect(deadlineError(form, '2030-06-11')).toMatch(/verstreken/)
  })
})

describe('normalizeEntry', () => {
  it('rejects teams and players that are not in the tournament', () => {
    const form = sampleForm()
    const entry = completeEntry(form)
    entry.finals['3'] = [1, 999]
    entry.topscorer.playerId = 5
    expect(() => normalizeEntry(entry, form)).toThrow(/ongeldige keuzes/)
  })

  it('drops number questions that are disabled', () => {
    const form = sampleForm()
    const entry = { ...completeEntry(form), numbers: { 18: 100, 19: 3 } }
    expect(normalizeEntry(entry, form).numbers).toEqual({ 18: 100 })
  })
})

describe('POST /api/pools/:poolId/entries', () => {
  it('stores a complete online entry as unpaid', async () => {
    const response = await submit(completeEntry(sampleForm()))
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ id: 123 })
    expect(state.saved).toHaveLength(1)
    expect(state.saved[0]).toMatchObject({ entry: { name: 'Jan Jansen', payed: false, payedTo: '' }, options: { source: 'online' } })
  })

  it('accepts an online entry without telephone or email', async () => {
    const entry = completeEntry(sampleForm())
    entry.telephone = ''
    entry.email = ''
    const response = await submit(entry)
    expect(response.status).toBe(201)
  })

  it('refuses incomplete forms with a list of missing fields', async () => {
    const entry = completeEntry(sampleForm())
    entry.matches['1']!.toto = null
    const response = await submit(entry)
    expect(response.status).toBe(422)
    expect(((await response.json()) as { details: string[] }).details).toEqual(['Wedstrijd 1: toto'])
    expect(state.saved).toHaveLength(0)
  })

  it('refuses entries after the deadline', async () => {
    state.form = sampleForm({ formsTill: '2000-01-01' })
    const response = await submit(completeEntry(sampleForm()))
    expect(response.status).toBe(403)
    expect(state.saved).toHaveLength(0)
  })

  it('only accepts the active pool', async () => {
    const response = await submit(completeEntry(sampleForm()), 8)
    expect(response.status).toBe(403)
  })

  it('validates the payload shape', async () => {
    const response = await submit({ name: 'x' })
    expect(response.status).toBe(400)
  })
})
