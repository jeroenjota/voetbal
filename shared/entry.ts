import { MATCH_TYPES, NUMBER_CATEGORY, POINTS } from './types'
import type { EntryPrediction, FormData, FormMatch, PointSetting } from './types'

export interface KnockoutRound {
  type: number
  title: string
  short: string
  teamPoints: number | null
  positionPoints: number | null
  matches: FormMatch[]
}

const ROUND_DEFS = [
  { type: MATCH_TYPES.eighth, title: 'Achtste Finale', short: '8e finale', team: POINTS.eighthTeam, pos: POINTS.eighthPos },
  { type: MATCH_TYPES.quarter, title: 'Kwart Finale', short: 'kwartfinale', team: POINTS.quarterTeam, pos: POINTS.quarterPos },
  { type: MATCH_TYPES.semi, title: 'Halve Finale', short: 'halve finale', team: POINTS.semiTeam, pos: POINTS.semiPos },
  { type: MATCH_TYPES.third, title: 'Kleine Finale', short: 'kleine finale', team: POINTS.thirdTeam, pos: POINTS.thirdPos },
  { type: MATCH_TYPES.final, title: 'Finale', short: 'finale', team: POINTS.finalTeam, pos: POINTS.finalPos },
]

export const STANDING_PLACES = [
  { label: '1e', typeId: POINTS.first },
  { label: '2e', typeId: POINTS.second },
  { label: '3e', typeId: POINTS.third },
  { label: '4e', typeId: POINTS.fourth },
] as const

export function pointsFor(points: PointSetting[], typeId: number): number | null {
  const setting = points.find((point) => point.typeId === typeId && point.enabled)
  return setting ? setting.points : null
}

export function byMatchOrder(matches: FormMatch[]): FormMatch[] {
  return [...matches].sort((a, b) => a.number - b.number)
}

export function knockoutRounds(form: Pick<FormData, 'matches' | 'points'>): KnockoutRound[] {
  return ROUND_DEFS.map((round) => ({
    type: round.type,
    title: round.title,
    short: round.short,
    teamPoints: pointsFor(form.points, round.team),
    positionPoints: pointsFor(form.points, round.pos),
    matches: byMatchOrder(form.matches.filter((match) => match.type === round.type)),
  })).filter((round) => round.matches.length > 0)
}

export function numberTypes(points: PointSetting[]): PointSetting[] {
  return points.filter((point) => point.category === NUMBER_CATEGORY && point.enabled)
    .sort((a, b) => a.listOrder - b.listOrder)
}

/** "aantal gele kaarten" → "gele kaarten" (as printed on the 2021 form) */
export function numberLabel(point: PointSetting): string {
  return point.description.replace(/^aantal\s+/i, '')
}

export function standingPlaces(points: PointSetting[]) {
  return STANDING_PLACES.map((place, index) => ({ ...place, index, points: pointsFor(points, place.typeId) }))
    .filter((place) => place.index < 2 || place.points !== null)
}

export function emptyEntry(form: Pick<FormData, 'groups' | 'matches' | 'points'>): EntryPrediction {
  return {
    name: '', telephone: '', email: '', payed: false, payedTo: '',
    groups: Object.fromEntries(form.groups.map((group) => [group.letter, group.teams.map(() => null)])),
    finals: Object.fromEntries(form.matches.filter((match) => match.type !== MATCH_TYPES.group)
      .map((match) => [String(match.number), [null, null]])),
    matches: Object.fromEntries(form.matches.map((match) => [String(match.number), { htA: null, htB: null, ftA: null, ftB: null, toto: null }])),
    standings: [null, null, null, null],
    topscorer: { playerId: null, goals: null },
    numbers: Object.fromEntries(numberTypes(form.points).map((point) => [String(point.typeId), null])),
  }
}

/** Fill in any keys that are missing in a stored entry (for example after the schedule changed). */
export function completeEntry(entry: Partial<EntryPrediction>, form: Pick<FormData, 'groups' | 'matches' | 'points'>): EntryPrediction {
  const base = emptyEntry(form)
  const groups = { ...base.groups }
  for (const letter of Object.keys(groups)) {
    const stored = entry.groups?.[letter]
    if (stored) groups[letter] = groups[letter]!.map((_, index) => stored[index] ?? null)
  }
  const finals = { ...base.finals }
  for (const key of Object.keys(finals)) if (entry.finals?.[key]) finals[key] = [entry.finals[key][0] ?? null, entry.finals[key][1] ?? null]
  const matches = { ...base.matches }
  for (const key of Object.keys(matches)) if (entry.matches?.[key]) matches[key] = { ...matches[key]!, ...entry.matches[key] }
  const numbers = { ...base.numbers }
  for (const key of Object.keys(numbers)) if (entry.numbers && key in entry.numbers) numbers[key] = entry.numbers[key] ?? null
  return {
    name: entry.name ?? '', telephone: entry.telephone ?? '', email: entry.email ?? '',
    payed: entry.payed ?? false, payedTo: entry.payedTo ?? '',
    groups, finals, matches, numbers,
    standings: [0, 1, 2, 3].map((index) => entry.standings?.[index] ?? null) as EntryPrediction['standings'],
    topscorer: { playerId: entry.topscorer?.playerId ?? null, goals: entry.topscorer?.goals ?? null },
  }
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Human readable list of everything that still has to be filled in. */
export function missingFields(entry: EntryPrediction, form: Pick<FormData, 'groups' | 'matches' | 'points'>): string[] {
  const missing: string[] = []
  if (!entry.name.trim()) missing.push('Naam')
  if (!entry.telephone.trim()) missing.push('Telefoon')
  if (!EMAIL_PATTERN.test(entry.email.trim())) missing.push('Email')
  for (const group of form.groups) {
    group.teams.forEach((team, index) => {
      const value = entry.groups[group.letter]?.[index]
      if (!value || value < 1 || value > group.teams.length) missing.push(`Groep ${group.letter}: ${team.name}`)
    })
  }
  for (const round of knockoutRounds(form)) {
    for (const match of round.matches) {
      const [a, b] = entry.finals[String(match.number)] ?? [null, null]
      if (!a) missing.push(`${round.short} ${match.number}: ${match.codeA}`)
      if (!b) missing.push(`${round.short} ${match.number}: ${match.codeB}`)
    }
  }
  for (const match of form.matches) {
    const prediction = entry.matches[String(match.number)]
    if (prediction?.htA == null || prediction.htB == null) missing.push(`Wedstrijd ${match.number}: rust`)
    if (prediction?.ftA == null || prediction.ftB == null) missing.push(`Wedstrijd ${match.number}: eind`)
    if (!prediction?.toto) missing.push(`Wedstrijd ${match.number}: toto`)
  }
  standingPlaces(form.points).forEach((place) => {
    if (!entry.standings[place.index]) missing.push(`Eindstand ${place.label}`)
  })
  if (pointsFor(form.points, POINTS.topscorer1) !== null && !entry.topscorer.playerId) missing.push('Topscorer')
  if (pointsFor(form.points, POINTS.topscorer1Goals) !== null && entry.topscorer.goals == null) missing.push('Aantal goals topscorer')
  for (const point of numberTypes(form.points)) {
    if (entry.numbers[String(point.typeId)] == null) missing.push(point.description)
  }
  return missing
}

const PREFIXES = new Set(['van', 'de', 'der', 'den', 'het', "'t", 'ten', 'ter', 'te', 'in', "'s", 'op', 'la', 'le', 'du', 'da', 'von', 'dos', 'del', 'di', 'el', 'al'])

/** Split a Dutch full name into tblAddresses first/middle/last name. */
export function splitName(full: string): { firstName: string; middleName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { firstName: parts[0] ?? '', middleName: '', lastName: '' }
  const prefixStart = parts.findIndex((part, index) => index > 0 && PREFIXES.has(part.toLowerCase()))
  if (prefixStart > 0) {
    let end = prefixStart
    while (end < parts.length - 1 && PREFIXES.has(parts[end]!.toLowerCase())) end++
    return { firstName: parts.slice(0, prefixStart).join(' '), middleName: parts.slice(prefixStart, end).join(' '), lastName: parts.slice(end).join(' ') }
  }
  return { firstName: parts.slice(0, -1).join(' '), middleName: '', lastName: parts.at(-1)! }
}

export function joinName(...parts: (string | null | undefined)[]): string {
  return parts.map((part) => part?.trim()).filter(Boolean).join(' ')
}

const DAYS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']
const LONG_DAYS = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']
const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']

function parseDate(value: string | null): Date | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null
}

/** "2021-06-11" → "vr 11-6" */
export function shortDay(value: string | null): string {
  const date = parseDate(value)
  return date ? `${DAYS[date.getDay()]} ${date.getDate()}-${date.getMonth() + 1}` : ''
}

/** "2021-06-11" → "11 juni 2021" */
export function longDate(value: string | null): string {
  const date = parseDate(value)
  return date ? `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}` : ''
}

/** "2021-06-07" → "maandag 7 juni 2021" */
export function weekdayDate(value: string | null): string {
  const date = parseDate(value)
  return date ? `${LONG_DAYS[date.getDay()]} ${longDate(value)}` : ''
}

export function euro(value: number): string {
  return `€ ${value.toFixed(2).replace('.', ',')}`
}
