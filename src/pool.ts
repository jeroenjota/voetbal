export type Answers = Record<string, string>
export type SectionId = 'participant' | 'groups' | 'knockout' | 'matches' | 'extras'
export type Round = 'Achtste finale' | 'Kwartfinale' | 'Halve finale' | 'Finale'

export interface Fixture {
  id: number
  home: string
  away: string
  group?: string
  round?: Round
}

export interface Field {
  id: string
  label: string
  section: SectionId
  kind: 'number' | 'text' | 'email' | 'tel' | 'toto' | 'position' | 'team'
  min?: number
  max?: number
}

export interface Entry {
  version: 2
  answers: Answers
  finished: boolean
}

export const STORAGE_KEY = 'aftrap:entry:v2'
export const LEGACY_STORAGE_KEY = 'aftrap:demo:predictions:v1'
export const groups = ['A', 'B', 'C', 'D', 'E', 'F']
export const teamSlots = groups.flatMap((group) => [1, 2, 3, 4].map((position) => `${group}${position}`))
const pairings = [[1, 2], [3, 4], [1, 3], [2, 4], [1, 4], [2, 3]] as const

// Template numbering, not the official EURO 2028 match schedule.
export const groupFixtures: Fixture[] = groups.flatMap((group, index) =>
  pairings.map(([home, away], game) => ({ id: index * 6 + game + 1, home: `${group}${home}`, away: `${group}${away}`, group })),
)

export const rounds: { name: Round; mentioned: number; exact: number; pairs: [string, string][] }[] = [
  { name: 'Achtste finale', mentioned: 5, exact: 8, pairs: [['1A', '2C'], ['2A', '2B'], ['1B', '3A/D/E/F'], ['1C', '3D/E/F'], ['1F', '3A/B/C'], ['2D', '2E'], ['1E', '3A/B/C/D'], ['1D', '2F']] },
  { name: 'Kwartfinale', mentioned: 8, exact: 12, pairs: [['W41', 'W42'], ['W39', 'W37'], ['W40', 'W38'], ['W43', 'W44']] },
  { name: 'Halve finale', mentioned: 12, exact: 16, pairs: [['W46', 'W45'], ['W48', 'W47']] },
  { name: 'Finale', mentioned: 20, exact: 24, pairs: [['W49', 'W50']] },
]

let knockoutId = 37
export const knockoutFixtures: Fixture[] = rounds.flatMap((round) =>
  round.pairs.map(([home, away]) => ({ id: knockoutId++, home, away, round: round.name })),
)
export const fixtures = [...groupFixtures, ...knockoutFixtures]

export const totals = [
  { id: 'yellow', label: 'Gele kaarten', tolerance: 4 },
  { id: 'red', label: 'Rode kaarten', tolerance: 2 },
  { id: 'penalties', label: "Penalty's in speeltijd", tolerance: 1 },
  { id: 'draws', label: 'Gelijke spelen na 90 minuten', tolerance: 3 },
  { id: 'goals', label: 'Doelpunten in het toernooi', tolerance: 5 },
]

export const fields: Field[] = [
  { id: 'name', label: 'Naam', section: 'participant', kind: 'text' },
  { id: 'email', label: 'E-mail', section: 'participant', kind: 'email' },
  { id: 'phone', label: 'Telefoon', section: 'participant', kind: 'tel' },
  ...teamSlots.map((slot): Field => ({ id: `group.${slot}`, label: `Eindpositie ${slot}`, section: 'groups', kind: 'position' })),
  ...knockoutFixtures.flatMap((match) => ['home', 'away'].map((side): Field => ({
    id: `team.${match.id}.${side}`, label: `Team ${side === 'home' ? match.home : match.away} in wedstrijd ${match.id}`, section: 'knockout', kind: 'team',
  }))),
  ...fixtures.flatMap((match): Field[] => [
    ...['ht', 'ft'].flatMap((period) => ['home', 'away'].map((side): Field => ({
      id: `match.${match.id}.${period}.${side}`,
      label: `${period === 'ht' ? 'Rust' : 'Eind'} ${side === 'home' ? 'thuis' : 'uit'} wedstrijd ${match.id}`,
      section: 'matches', kind: 'number', min: 0, max: 99,
    }))),
    { id: `match.${match.id}.toto`, label: `Toto wedstrijd ${match.id}`, section: 'matches', kind: 'toto' },
  ]),
  { id: 'champion', label: 'Kampioen', section: 'extras', kind: 'team' },
  { id: 'runnerUp', label: 'Tweede plaats', section: 'extras', kind: 'team' },
  { id: 'topscorer', label: 'Topscorer', section: 'extras', kind: 'text' },
  { id: 'topscorerGoals', label: 'Aantal goals van de topscorer', section: 'extras', kind: 'number', min: 0, max: 999 },
  ...totals.map((total): Field => ({ id: `total.${total.id}`, label: total.label, section: 'extras', kind: 'number', min: 0, max: 9999 })),
]

const fieldMap = new Map(fields.map((field) => [field.id, field]))

export function isValidAnswer(field: Field, value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 120) return false
  if (!value.trim()) return value === ''
  if (field.kind === 'number') {
    return /^\d+$/.test(value) && Number(value) >= (field.min ?? 0) && Number(value) <= (field.max ?? 9999)
  }
  if (field.kind === 'position') return /^[1-4]$/.test(value)
  if (field.kind === 'toto') return /^[1-3]$/.test(value)
  if (field.kind === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  return true
}

export function validateAnswers(answers: Answers): string[] {
  return Object.entries(answers).flatMap(([id, value]) => {
    const field = fieldMap.get(id)
    return !field || !isValidAnswer(field, value) ? [field?.label ?? id] : []
  })
}

export function completedFields(answers: Answers, section?: SectionId): number {
  return fields.filter((field) => (!section || field.section === section) && !!answers[field.id]?.trim() && isValidAnswer(field, answers[field.id])).length
}

export function completeMatches(answers: Answers): number {
  return fixtures.filter((match) => fields.filter((field) => field.id.startsWith(`match.${match.id}.`))
    .every((field) => !!answers[field.id] && isValidAnswer(field, answers[field.id]))).length
}

export function readEntry(storage: Pick<Storage, 'getItem'>): Entry {
  const raw = storage.getItem(STORAGE_KEY)
  if (raw === null) return { version: 2, answers: {}, finished: false }
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object') throw new Error('Ongeldig formulier.')
  const entry = value as Record<string, unknown>
  if (entry.version !== 2 || typeof entry.finished !== 'boolean' || !entry.answers || typeof entry.answers !== 'object' || Array.isArray(entry.answers)) {
    throw new Error('Ongeldig formulier.')
  }
  const answers: Answers = {}
  for (const [id, answer] of Object.entries(entry.answers)) {
    const field = fieldMap.get(id)
    if (!field || !isValidAnswer(field, answer)) throw new Error(`Ongeldige invoer: ${id}`)
    answers[id] = answer
  }
  if (entry.finished && completedFields(answers) !== fields.length) throw new Error('Afgerond formulier is niet compleet.')
  return { version: 2, answers, finished: entry.finished }
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase('nl').replace(/\s+/g, ' ')
}

function sameText(prediction: string | undefined, actual: string | undefined): boolean {
  return !!prediction?.trim() && !!actual?.trim() && normalized(prediction) === normalized(actual)
}

function sameNumber(prediction: string | undefined, actual: string | undefined): boolean {
  return prediction !== undefined && prediction !== '' && actual !== undefined && actual !== ''
    && Number(prediction) === Number(actual)
}

export function matchPoints(prediction: Answers, actual: Answers, id: number): number {
  let points = 0
  for (const [period, award] of [['ht', 2], ['ft', 4]] as const) {
    if (['home', 'away'].every((side) => sameNumber(prediction[`match.${id}.${period}.${side}`], actual[`match.${id}.${period}.${side}`]))) points += award
  }
  if (sameNumber(prediction[`match.${id}.toto`], actual[`match.${id}.toto`])) points += 2
  return points
}

export function roundPoints(predicted: string[], actual: string[], mentioned: number, exact: number): number {
  const remaining = actual.map(normalized)
  const unmatched: string[] = []
  let points = 0
  predicted.forEach((team, index) => {
    const name = normalized(team)
    if (name && name === remaining[index]) {
      points += exact
      remaining[index] = ''
    } else if (name) unmatched.push(name)
  })
  for (const name of unmatched) {
    const index = remaining.indexOf(name)
    if (index !== -1) {
      points += mentioned
      remaining[index] = ''
    }
  }
  return points
}

export function scoreEntry(prediction: Answers, actual: Answers) {
  const match = fixtures.reduce((sum, fixture) => sum + matchPoints(prediction, actual, fixture.id), 0)
  const group = teamSlots.reduce((sum, slot) => sum + (sameNumber(prediction[`group.${slot}`], actual[`group.${slot}`]) ? 5 : 0), 0)
  const knockout = rounds.reduce((sum, round) => {
    const ids = knockoutFixtures.filter((fixture) => fixture.round === round.name)
      .flatMap((fixture) => [`team.${fixture.id}.home`, `team.${fixture.id}.away`])
    return sum + roundPoints(ids.map((id) => prediction[id] ?? ''), ids.map((id) => actual[id] ?? ''), round.mentioned, round.exact)
  }, 0)
  const final = (sameText(prediction.champion, actual.champion) ? 50 : 0) + (sameText(prediction.runnerUp, actual.runnerUp) ? 36 : 0)
  const scorer = (sameText(prediction.topscorer, actual.topscorer) ? 30 : 0) + (sameNumber(prediction.topscorerGoals, actual.topscorerGoals) ? 12 : 0)
  const numbers = totals.reduce((sum, total) => {
    const p = prediction[`total.${total.id}`]
    const a = actual[`total.${total.id}`]
    return sum + (p !== undefined && p !== '' && a !== undefined && a !== '' && Math.abs(Number(p) - Number(a)) <= total.tolerance ? 16 : 0)
  }, 0)
  return { match, group, knockout, final, scorer, numbers, total: match + group + knockout + final + scorer + numbers }
}

// Only award the daily bonus after every result for that day is available.
export function dailyGoalsBonus(prediction: Answers, actual: Answers, matchIds: number[]): number {
  if (!matchIds.length) return 0
  let predicted = 0
  let result = 0
  for (const id of matchIds) {
    for (const side of ['home', 'away']) {
      const p = prediction[`match.${id}.ft.${side}`]
      const a = actual[`match.${id}.ft.${side}`]
      if (p === undefined || p === '' || a === undefined || a === '') return 0
      predicted += Number(p)
      result += Number(a)
    }
  }
  return predicted === result ? 5 : 0
}
