import { z } from 'zod'

const id = z.number().int().positive()
const optionalId = id.nullable()
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Gebruik JJJJ-MM-DD').nullable()
const money = z.number().min(0).max(100000)
const text = (max: number) => z.string().trim().max(max)

export const poolSchema = z.object({
  tournamentId: optionalId,
  name: text(50).min(1, 'Naam is verplicht'),
  formsFrom: date,
  formsTill: date,
  cost: money,
  prizeHighDayScore: money,
  prizeHighDayPosition: money,
  prizeLowDayPosition: money,
  prizeLowFinalPosition: money,
  prizePercentages: z.tuple([z.number().min(0).max(100), z.number().min(0).max(100), z.number().min(0).max(100), z.number().min(0).max(100)]),
})

export const tournamentSchema = z.object({
  year: z.number().int().min(1900).max(2200),
  type: text(2).min(1),
  locationId: optionalId,
  teamCount: z.number().int().min(2).max(64),
  groupCount: z.number().int().min(1).max(16),
  startDate: date,
  endDate: date,
  thirdPlace: z.boolean(),
})

export const teamSchema = z.object({ name: text(50).min(1), shortName: text(3).nullable(), countryId: optionalId })
export const stadiumSchema = z.object({ name: text(64).min(1), location: text(64).nullable() })

export const groupsSchema = z.array(z.object({ letter: z.string().regex(/^[A-P]$/), place: z.number().int().min(1).max(4), teamId: optionalId })).max(64)

const teamCode = text(255).min(1)
export const scheduleSchema = z.array(z.object({
  number: z.number().int().min(1).max(200),
  date,
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  type: z.number().int().min(1).max(7),
  codeA: teamCode,
  codeB: teamCode,
  stadiumId: optionalId,
  order: z.number().int().min(0).max(1000),
})).max(200).refine((matches) => new Set(matches.map((match) => match.number)).size === matches.length, 'Wedstrijdnummers moeten uniek zijn')

export const personSchema = z.object({
  firstName: text(32),
  middleName: text(20).nullable(),
  lastName: text(32).min(1, 'Achternaam is verplicht'),
  nickName: text(50).nullable(),
  functionId: optionalId,
})

export const pointsSchema = z.array(z.object({ typeId: id, enabled: z.boolean(), points: z.number().int().min(0).max(1000), margin: z.number().int().min(0).max(100) }))

const score = z.number().int().min(0).max(99).nullable()

export const entrySchema = z.object({
  name: text(130),
  telephone: text(20),
  email: text(255),
  payed: z.boolean(),
  payedTo: text(50),
  groups: z.record(z.string().regex(/^[A-P]$/), z.array(z.number().int().min(1).max(4).nullable()).max(4)),
  finals: z.record(z.string().regex(/^\d+$/), z.tuple([optionalId, optionalId])),
  matches: z.record(z.string().regex(/^\d+$/), z.object({ htA: score, htB: score, ftA: score, ftB: score, toto: z.number().int().min(1).max(3).nullable() })),
  standings: z.tuple([optionalId, optionalId, optionalId, optionalId]),
  topscorer: z.object({ playerId: optionalId, goals: z.number().int().min(0).max(99).nullable() }),
  numbers: z.record(z.string().regex(/^\d+$/), z.number().int().min(0).max(9999).nullable()),
})

export const importSchema = z.object({
  format: z.literal('vbpool-tournament'),
  version: z.literal(1),
  tournament: tournamentSchema,
  teams: z.array(z.object({ name: text(50).min(1), shortName: text(3).nullable().optional() })).max(100),
  groups: groupsSchema.element.omit({ teamId: true }).extend({ team: text(50).nullable() }).array().max(64),
  schedule: z.array(scheduleSchema.element.omit({ stadiumId: true }).extend({ stadium: text(64).nullable().optional() })).max(200),
  players: z.array(personSchema.omit({ nickName: true }).extend({ team: text(50).min(1), middleName: text(20).nullable().optional(), functionId: optionalId.optional() })).max(5000),
})
