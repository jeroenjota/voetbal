import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { completeEntry, missingFields, numberTypes } from '../../shared/entry'
import type { EntryPrediction, FormData } from '../../shared/types'
import * as repo from './repository'
import { NotFoundError } from './repository'
import {
  entrySchema, groupsSchema, importSchema, personSchema, poolSchema, pointsSchema, scheduleSchema, stadiumSchema, teamSchema, tournamentSchema,
} from './schemas'

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: string[]) {
    super(message)
  }
}

function idParam(request: Request, name: string): number {
  const value = Number(request.params[name])
  if (!Number.isInteger(value) || value <= 0) throw new HttpError(400, `Ongeldige ${name}.`)
  return value
}

export function today(timeZone = 'Europe/Amsterdam'): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone })
}

export function deadlineError(form: Pick<FormData, 'pool'>, date = today()): string | null {
  if (form.pool.formsFrom && date < form.pool.formsFrom) return `Inschrijven kan pas vanaf ${form.pool.formsFrom}.`
  if (form.pool.formsTill && date > form.pool.formsTill) return `De inleverdatum (${form.pool.formsTill}) is verstreken.`
  return null
}

/** Drop unknown keys and reject references to teams or players outside this tournament. */
export function normalizeEntry(raw: unknown, form: FormData): EntryPrediction {
  const entry = completeEntry(entrySchema.parse(raw), form)
  const teams = new Set(form.teams.map((team) => team.id))
  const errors: string[] = []
  for (const [number, pair] of Object.entries(entry.finals)) {
    if (pair.some((team) => team !== null && !teams.has(team))) errors.push(`Onbekend team bij wedstrijd ${number}`)
  }
  if (entry.standings.some((team) => team !== null && !teams.has(team))) errors.push('Onbekend team in de eindstand')
  if (entry.topscorer.playerId !== null && !form.players.some((player) => player.id === entry.topscorer.playerId)) errors.push('Onbekende topscorer')
  const allowedNumbers = new Set(numberTypes(form.points).map((point) => String(point.typeId)))
  for (const key of Object.keys(entry.numbers)) if (!allowedNumbers.has(key)) delete entry.numbers[key]
  if (errors.length) throw new HttpError(422, 'Het formulier bevat ongeldige keuzes.', errors)
  return entry
}

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '2mb' }))

  // ---------- public ----------
  app.get('/api/form', async (_request, response) => {
    const poolId = await repo.getActivePoolId()
    if (!poolId) throw new HttpError(404, 'Er is nog geen actieve pool ingesteld.')
    response.json(await repo.getFormData(poolId))
  })
  app.get('/api/pools/:poolId/form', async (request, response) => {
    response.json(await repo.getFormData(idParam(request, 'poolId')))
  })
  app.post('/api/pools/:poolId/entries', async (request, response) => {
    const poolId = idParam(request, 'poolId')
    if (poolId !== await repo.getActivePoolId()) throw new HttpError(403, 'Voor deze pool kan niet (meer) online worden ingeschreven.')
    const form = await repo.getFormData(poolId)
    const closed = deadlineError(form)
    if (closed) throw new HttpError(403, closed)
    const entry = { ...normalizeEntry(request.body, form), payed: false, payedTo: '' }
    const missing = missingFields(entry, form)
    if (missing.length) throw new HttpError(422, `Het formulier is nog niet compleet (${missing.length} velden).`, missing.slice(0, 20))
    const id = await repo.saveEntry(poolId, entry, { source: 'online' })
    response.status(201).json({ id })
  })

  // ---------- admin (no authentication yet: only expose on localhost) ----------
  const admin = express.Router()
  admin.get('/pools', async (_request, response) => { response.json(await repo.listPools()) })
  admin.post('/pools', async (request, response) => { response.status(201).json({ id: await repo.savePool(poolSchema.parse(request.body)) }) })
  admin.get('/pools/:poolId', async (request, response) => { response.json(await repo.getPool(idParam(request, 'poolId'))) })
  admin.put('/pools/:poolId', async (request, response) => {
    response.json({ id: await repo.savePool(poolSchema.parse(request.body), idParam(request, 'poolId')) })
  })
  admin.put('/active-pool', async (request, response) => {
    const poolId = Number(request.body?.poolId)
    if (!Number.isInteger(poolId) || poolId <= 0) throw new HttpError(400, 'Ongeldige pool.')
    await repo.setActivePoolId(poolId)
    response.json({ poolId })
  })
  admin.get('/pools/:poolId/points', async (request, response) => { response.json(await repo.getPoints(idParam(request, 'poolId'))) })
  admin.put('/pools/:poolId/points', async (request, response) => {
    await repo.savePoints(idParam(request, 'poolId'), pointsSchema.parse(request.body))
    response.json({ ok: true })
  })

  admin.get('/pools/:poolId/participants', async (request, response) => {
    const poolId = idParam(request, 'poolId')
    const form = await repo.getFormData(poolId)
    response.json(await repo.listParticipants(poolId, (entry) => missingFields(completeEntry(entry, form), form).length))
  })
  admin.get('/pools/:poolId/participants/:id', async (request, response) => {
    response.json(await repo.getEntry(idParam(request, 'poolId'), idParam(request, 'id')))
  })
  admin.post('/pools/:poolId/participants', async (request, response) => {
    const poolId = idParam(request, 'poolId')
    const entry = normalizeEntry(request.body, await repo.getFormData(poolId))
    if (!entry.name.trim()) throw new HttpError(422, 'Vul minimaal een naam in.')
    response.status(201).json({ id: await repo.saveEntry(poolId, entry, { source: 'admin' }) })
  })
  admin.put('/pools/:poolId/participants/:id', async (request, response) => {
    const poolId = idParam(request, 'poolId')
    const entry = normalizeEntry(request.body, await repo.getFormData(poolId))
    if (!entry.name.trim()) throw new HttpError(422, 'Vul minimaal een naam in.')
    response.json({ id: await repo.saveEntry(poolId, entry, { source: 'admin', competitorPoolId: idParam(request, 'id') }) })
  })
  admin.delete('/pools/:poolId/participants/:id', async (request, response) => {
    await repo.deleteEntry(idParam(request, 'poolId'), idParam(request, 'id'))
    response.status(204).end()
  })

  admin.get('/tournaments', async (_request, response) => { response.json(await repo.listTournaments()) })
  admin.post('/tournaments', async (request, response) => { response.status(201).json({ id: await repo.saveTournament(tournamentSchema.parse(request.body)) }) })
  admin.get('/tournaments/:id', async (request, response) => { response.json(await repo.getTournament(idParam(request, 'id'))) })
  admin.put('/tournaments/:id', async (request, response) => {
    const id = idParam(request, 'id')
    await repo.getTournament(id)
    response.json({ id: await repo.saveTournament(tournamentSchema.parse(request.body), id) })
  })
  admin.get('/tournaments/:id/groups', async (request, response) => { response.json(await repo.getGroups(idParam(request, 'id'))) })
  admin.put('/tournaments/:id/groups', async (request, response) => {
    const id = idParam(request, 'id')
    await repo.getTournament(id)
    await repo.saveGroups(id, groupsSchema.parse(request.body))
    response.json({ ok: true })
  })
  admin.get('/tournaments/:id/schedule', async (request, response) => { response.json(await repo.getSchedule(idParam(request, 'id'))) })
  admin.put('/tournaments/:id/schedule', async (request, response) => {
    const id = idParam(request, 'id')
    await repo.getTournament(id)
    await repo.saveSchedule(id, scheduleSchema.parse(request.body))
    response.json({ ok: true })
  })
  admin.get('/tournaments/:id/players', async (request, response) => {
    const teamId = request.query.teamId ? Number(request.query.teamId) : undefined
    response.json(await repo.listPlayers(idParam(request, 'id'), teamId))
  })
  admin.post('/tournaments/:id/players', async (request, response) => {
    const teamId = Number(request.body?.teamId)
    if (!Number.isInteger(teamId) || teamId <= 0) throw new HttpError(400, 'Kies een team.')
    response.status(201).json({ id: await repo.addPlayer(idParam(request, 'id'), teamId, personSchema.parse(request.body)) })
  })
  admin.put('/people/:id', async (request, response) => {
    await repo.updatePerson(idParam(request, 'id'), personSchema.parse(request.body))
    response.json({ ok: true })
  })
  admin.delete('/tournaments/:id/players/:playerId', async (request, response) => {
    await repo.removePlayer(idParam(request, 'id'), idParam(request, 'playerId'))
    response.status(204).end()
  })
  admin.get('/tournaments/:id/export', async (request, response) => { response.json(await repo.exportTournament(idParam(request, 'id'))) })
  admin.post('/tournaments/import', async (request, response) => {
    response.status(201).json({ id: await repo.importTournament(importSchema.parse(request.body)) })
  })
  admin.put('/tournaments/:id/import', async (request, response) => {
    const id = idParam(request, 'id')
    await repo.getTournament(id)
    response.json({ id: await repo.importTournament(importSchema.parse(request.body), id) })
  })

  admin.get('/teams', async (_request, response) => { response.json(await repo.listTeams()) })
  admin.post('/teams', async (request, response) => { response.status(201).json({ id: await repo.saveTeam(teamSchema.parse(request.body)) }) })
  admin.put('/teams/:id', async (request, response) => { response.json({ id: await repo.saveTeam(teamSchema.parse(request.body), idParam(request, 'id')) }) })
  admin.get('/countries', async (_request, response) => { response.json(await repo.listCountries()) })
  admin.get('/stadiums', async (_request, response) => { response.json(await repo.listStadiums()) })
  admin.post('/stadiums', async (request, response) => { response.status(201).json({ id: await repo.createStadium(stadiumSchema.parse(request.body)) }) })
  admin.get('/functions', async (_request, response) => { response.json(await repo.listFunctions()) })
  app.use('/api/admin', admin)

  app.use('/api', (_request, _response, next) => next(new HttpError(404, 'Onbekend adres.')))
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof ZodError) {
      response.status(400).json({ error: 'Ongeldige invoer.', details: error.issues.slice(0, 20).map((issue) => `${issue.path.join('.')}: ${issue.message}`) })
    } else if (error instanceof HttpError) {
      response.status(error.status).json({ error: error.message, details: error.details })
    } else if (error instanceof NotFoundError) {
      response.status(404).json({ error: error.message })
    } else {
      console.error(error)
      response.status(500).json({ error: 'Er ging iets mis op de server.' })
    }
  })
  return app
}
