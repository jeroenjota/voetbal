import type {
  Country, EntryPrediction, FormData, GroupSlot, ParticipantSummary, Player, PlayerFunction, PointSetting, PoolSettings,
  PoolSummary, ScheduleMatch, Stadium, Team, Tournament, TournamentExport,
} from '../shared/types'

export class ApiError extends Error {
  constructor(message: string, public status: number, public details: string[] = []) {
    super(message)
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${url}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('De server is niet bereikbaar. Draait de API (npm run dev)?', 0)
  }
  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(data?.error ?? `Serverfout (${response.status})`, response.status, data?.details ?? [])
  return data as T
}

const get = <T>(url: string) => request<T>('GET', url)
const post = <T>(url: string, body: unknown) => request<T>('POST', url, body)
const put = <T>(url: string, body: unknown) => request<T>('PUT', url, body)

export const api = {
  activeForm: () => get<FormData>('/form'),
  form: (poolId: number) => get<FormData>(`/pools/${poolId}/form`),
  submitEntry: (poolId: number, entry: EntryPrediction) => post<{ id: number }>(`/pools/${poolId}/entries`, entry),

  pools: () => get<PoolSummary[]>('/admin/pools'),
  pool: (id: number) => get<PoolSettings & { id: number }>(`/admin/pools/${id}`),
  createPool: (pool: PoolSettings) => post<{ id: number }>('/admin/pools', pool),
  savePool: (id: number, pool: PoolSettings) => put<{ id: number }>(`/admin/pools/${id}`, pool),
  setActivePool: (poolId: number) => put<{ poolId: number }>('/admin/active-pool', { poolId }),
  points: (poolId: number) => get<PointSetting[]>(`/admin/pools/${poolId}/points`),
  savePoints: (poolId: number, points: PointSetting[]) => put<{ ok: true }>(`/admin/pools/${poolId}/points`, points),

  participants: (poolId: number) => get<ParticipantSummary[]>(`/admin/pools/${poolId}/participants`),
  participant: (poolId: number, id: number) => get<EntryPrediction>(`/admin/pools/${poolId}/participants/${id}`),
  createParticipant: (poolId: number, entry: EntryPrediction) => post<{ id: number }>(`/admin/pools/${poolId}/participants`, entry),
  saveParticipant: (poolId: number, id: number, entry: EntryPrediction) => put<{ id: number }>(`/admin/pools/${poolId}/participants/${id}`, entry),
  deleteParticipant: (poolId: number, id: number) => request<void>('DELETE', `/admin/pools/${poolId}/participants/${id}`),

  tournaments: () => get<(Tournament & { id: number })[]>('/admin/tournaments'),
  tournament: (id: number) => get<Tournament & { id: number }>(`/admin/tournaments/${id}`),
  createTournament: (tournament: Tournament) => post<{ id: number }>('/admin/tournaments', tournament),
  saveTournament: (id: number, tournament: Tournament) => put<{ id: number }>(`/admin/tournaments/${id}`, tournament),
  groups: (tournamentId: number) => get<GroupSlot[]>(`/admin/tournaments/${tournamentId}/groups`),
  saveGroups: (tournamentId: number, slots: GroupSlot[]) => put<{ ok: true }>(`/admin/tournaments/${tournamentId}/groups`, slots),
  schedule: (tournamentId: number) => get<ScheduleMatch[]>(`/admin/tournaments/${tournamentId}/schedule`),
  saveSchedule: (tournamentId: number, matches: ScheduleMatch[]) => put<{ ok: true }>(`/admin/tournaments/${tournamentId}/schedule`, matches),
  players: (tournamentId: number) => get<Player[]>(`/admin/tournaments/${tournamentId}/players`),
  addPlayer: (tournamentId: number, teamId: number, person: Omit<Player, 'id' | 'tournamentPlayerId' | 'teamId'>) =>
    post<{ id: number }>(`/admin/tournaments/${tournamentId}/players`, { ...person, teamId }),
  updatePerson: (peopleId: number, person: Omit<Player, 'id' | 'tournamentPlayerId' | 'teamId'>) => put<{ ok: true }>(`/admin/people/${peopleId}`, person),
  removePlayer: (tournamentId: number, tournamentPlayerId: number) => request<void>('DELETE', `/admin/tournaments/${tournamentId}/players/${tournamentPlayerId}`),
  exportTournament: (tournamentId: number) => get<TournamentExport>(`/admin/tournaments/${tournamentId}/export`),
  importTournament: (data: TournamentExport, tournamentId?: number) => tournamentId
    ? put<{ id: number }>(`/admin/tournaments/${tournamentId}/import`, data)
    : post<{ id: number }>('/admin/tournaments/import', data),

  teams: () => get<Team[]>('/admin/teams'),
  createTeam: (team: Omit<Team, 'id'>) => post<{ id: number }>('/admin/teams', team),
  saveTeam: (id: number, team: Omit<Team, 'id'>) => put<{ id: number }>(`/admin/teams/${id}`, team),
  countries: () => get<Country[]>('/admin/countries'),
  stadiums: () => get<Stadium[]>('/admin/stadiums'),
  createStadium: (stadium: Omit<Stadium, 'id'>) => post<{ id: number }>('/admin/stadiums', stadium),
  functions: () => get<PlayerFunction[]>('/admin/functions'),
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.details.length ? `${error.message} ${error.details.join('; ')}` : error.message
  return error instanceof Error ? error.message : String(error)
}
