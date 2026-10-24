// Shared between the Vue frontend and the Express API. Ids follow the VBPool2 MariaDB tables.

export const MATCH_TYPES = { group: 1, quarter: 2, semi: 3, final: 4, eighth: 5, third: 7 } as const

export const MATCH_TYPE_LABELS: Record<number, string> = {
  1: 'Groepswedstrijd', 5: 'Achtste finale', 2: 'Kwartfinale', 3: 'Halve finale', 7: 'Kleine finale', 4: 'Finale',
}

// pointTypeID values from tblPointTypes.
export const POINTS = {
  ht: 1, ft: 2, toto: 3, eighthTeam: 4, eighthPos: 5, quarterTeam: 6, quarterPos: 7, group: 8,
  semiTeam: 9, semiPos: 10, finalTeam: 11, finalPos: 12, third: 13, second: 14, first: 15,
  goals: 16, draws: 17, yellow: 18, red: 19, penalties: 20, topscorer1: 21, topscorer2: 22,
  topscorer1Goals: 24, topscorer2Goals: 25, dayGoals: 28, fourth: 29, thirdTeam: 30, thirdPos: 31,
} as const

export const NUMBER_CATEGORY = 6

// pointTypeCategory values from tblPointTypes.
export const POINT_CATEGORIES: Record<number, string> = {
  0: 'Wedstrijden', 1: 'Groepsstanden', 2: 'Achtste finales', 3: 'Kwart-, halve en finale', 4: 'Eindstand',
  5: 'Topscorer', 6: 'Aantallen', 7: 'Kleine finale / 3e en 4e plaats',
}

export interface PoolSummary {
  id: number
  name: string
  tournamentId: number | null
  tournamentLabel: string
  formsTill: string | null
  participantCount: number
  active: boolean
}

export interface PoolSettings {
  id?: number
  tournamentId: number | null
  name: string
  formsFrom: string | null
  formsTill: string | null
  cost: number
  prizeHighDayScore: number
  prizeHighDayPosition: number
  prizeLowDayPosition: number
  prizeLowFinalPosition: number
  prizePercentages: [number, number, number, number]
}

export interface Tournament {
  id?: number
  year: number
  type: string
  locationId: number | null
  teamCount: number
  groupCount: number
  startDate: string | null
  endDate: string | null
  thirdPlace: boolean
}

export interface Team {
  id: number
  name: string
  shortName: string | null
  countryId: number | null
}

export interface Country { id: number; name: string; code: string | null }
export interface Stadium { id: number; name: string; location: string | null }
export interface PlayerFunction { id: number; name: string }

export interface GroupSlot { letter: string; place: number; teamId: number | null }

export interface ScheduleMatch {
  number: number
  date: string | null
  time: string | null
  type: number
  codeA: string
  codeB: string
  stadiumId: number | null
  order: number
}

export interface Player {
  tournamentPlayerId: number
  id: number
  teamId: number
  firstName: string
  middleName: string | null
  lastName: string
  nickName: string | null
  functionId: number | null
}

export interface PointSetting {
  typeId: number
  description: string
  short: string | null
  category: number
  listOrder: number
  enabled: boolean
  points: number
  margin: number
}

export interface FormTeam { id: number; name: string }

export interface FormMatch {
  number: number
  date: string | null
  time: string | null
  type: number
  codeA: string
  codeB: string
  teamA: FormTeam | null
  teamB: FormTeam | null
}

export interface FormData {
  organisation: string
  pool: PoolSettings & { id: number }
  tournament: Tournament & { id: number; description: string }
  groups: { letter: string; teams: (FormTeam & { place: number })[] }[]
  teams: FormTeam[]
  matches: FormMatch[]
  points: PointSetting[]
  players: { id: number; name: string; teamName: string }[]
}

export interface MatchPrediction {
  htA: number | null
  htB: number | null
  ftA: number | null
  ftB: number | null
  toto: number | null
}

export interface EntryPrediction {
  name: string
  telephone: string
  email: string
  payed: boolean
  payedTo: string
  /** group letter → predicted position (1-4) of the team on each group place */
  groups: Record<string, (number | null)[]>
  /** match number → [team id for slot A, team id for slot B] */
  finals: Record<string, [number | null, number | null]>
  matches: Record<string, MatchPrediction>
  /** 1st, 2nd, 3rd and 4th place team ids */
  standings: [number | null, number | null, number | null, number | null]
  topscorer: { playerId: number | null; goals: number | null }
  /** pointTypeID → predicted number */
  numbers: Record<string, number | null>
}

export interface ParticipantSummary {
  id: number
  name: string
  email: string
  telephone: string
  payed: boolean
  payedTo: string
  source: string | null
  createdAt: string | null
  missing: number
}

export interface TournamentExport {
  format: 'vbpool-tournament'
  version: 1
  tournament: Tournament
  teams: { name: string; shortName?: string | null }[]
  groups: { letter: string; place: number; team: string | null }[]
  schedule: (Omit<ScheduleMatch, 'stadiumId'> & { stadium?: string | null })[]
  players: { team: string; firstName: string; middleName?: string | null; lastName: string; functionId?: number | null }[]
}
