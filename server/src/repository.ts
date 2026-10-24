import { execute, query, transaction } from './db'
import type { Db } from './db'
import { joinName, splitName } from '../../shared/entry'
import { MATCH_TYPES } from '../../shared/types'
import type {
  Country, EntryPrediction, FormData, GroupSlot, ParticipantSummary, Player, PlayerFunction, PointSetting,
  PoolSettings, PoolSummary, ScheduleMatch, Stadium, Team, Tournament, TournamentExport,
} from '../../shared/types'

export class NotFoundError extends Error {}

const dateOnly = (value: string | null | undefined) => (value ? value.slice(0, 10) : null)
const timeOnly = (value: string | null | undefined) => (value ? value.slice(11, 16) : null)
const dateTime = (value: string | null) => (value ? `${value} 00:00:00` : null)
// VB6/Access stores times on the "zero date" 1899-12-30.
const timeValue = (value: string | null) => (value ? `1899-12-30 ${value}:00` : null)
const teamOrNull = (value: number | null | undefined) => (value ? value : null)

// ---------- settings & pools ----------

export async function getActivePoolId(): Promise<number | null> {
  const [setting] = await query<{ settingValue: string }>("SELECT settingValue FROM tblAppSettings WHERE settingKey = 'activePoolId'")
  if (setting) {
    const [pool] = await query<{ poolID: number }>('SELECT poolID FROM tblPools WHERE poolID = ?', [Number(setting.settingValue)])
    if (pool) return pool.poolID
  }
  const [latest] = await query<{ poolID: number }>(
    'SELECT p.poolID FROM tblPools p LEFT JOIN tblTournaments t ON t.tournamentID = p.tournamentID ORDER BY t.tournamentYear DESC, p.poolID DESC LIMIT 1',
  )
  return latest?.poolID ?? null
}

export async function setActivePoolId(poolId: number): Promise<void> {
  await getPool(poolId)
  await execute("INSERT INTO tblAppSettings (settingKey, settingValue) VALUES ('activePoolId', ?) ON DUPLICATE KEY UPDATE settingValue = VALUES(settingValue)", [String(poolId)])
}

export async function listPools(): Promise<PoolSummary[]> {
  const active = await getActivePoolId()
  const rows = await query<{ poolID: number; poolName: string; tournamentID: number | null; poolFormsTill: string | null; tournamentType: string | null; tournamentYear: number | null; participants: number }>(`
    SELECT p.poolID, p.poolName, p.tournamentID, p.poolFormsTill, t.tournamentType, t.tournamentYear,
      (SELECT COUNT(*) FROM tblCompetitorPools c WHERE c.poolid = p.poolID) AS participants
    FROM tblPools p LEFT JOIN tblTournaments t ON t.tournamentID = p.tournamentID ORDER BY p.poolID DESC`)
  return rows.map((row) => ({
    id: row.poolID, name: row.poolName ?? '', tournamentId: row.tournamentID,
    tournamentLabel: row.tournamentType ? `${row.tournamentType} ${row.tournamentYear}` : '—',
    formsTill: dateOnly(row.poolFormsTill), participantCount: Number(row.participants), active: row.poolID === active,
  }))
}

interface PoolRow {
  poolID: number; tournamentID: number | null; poolName: string | null; poolFormsFrom: string | null; poolFormsTill: string | null
  poolCost: number | null; prizeHighDayScore: number | null; prizeHighDayPosition: number | null; prizeLowDayPosition: number | null
  prizePercentage1: number | null; prizePercentage2: number | null; prizePercentage3: number | null; prizePercentage4: number | null
  prizeLowFinalPosition: number | null
}

export async function getPool(id: number): Promise<PoolSettings & { id: number }> {
  const [row] = await query<PoolRow>('SELECT * FROM tblPools WHERE poolID = ?', [id])
  if (!row) throw new NotFoundError('Pool niet gevonden.')
  return {
    id: row.poolID, tournamentId: row.tournamentID, name: row.poolName ?? '',
    formsFrom: dateOnly(row.poolFormsFrom), formsTill: dateOnly(row.poolFormsTill), cost: Number(row.poolCost ?? 0),
    prizeHighDayScore: Number(row.prizeHighDayScore ?? 0), prizeHighDayPosition: Number(row.prizeHighDayPosition ?? 0),
    prizeLowDayPosition: Number(row.prizeLowDayPosition ?? 0), prizeLowFinalPosition: Number(row.prizeLowFinalPosition ?? 0),
    prizePercentages: [row.prizePercentage1, row.prizePercentage2, row.prizePercentage3, row.prizePercentage4].map((value) => Number(value ?? 0)) as PoolSettings['prizePercentages'],
  }
}

export async function savePool(settings: PoolSettings, id?: number): Promise<number> {
  const values = [
    settings.tournamentId, settings.name, dateTime(settings.formsFrom), dateTime(settings.formsTill), settings.cost,
    settings.prizeHighDayScore, settings.prizeHighDayPosition, settings.prizeLowDayPosition, ...settings.prizePercentages, settings.prizeLowFinalPosition,
  ]
  const columns = 'tournamentID = ?, poolName = ?, poolFormsFrom = ?, poolFormsTill = ?, poolCost = ?, prizeHighDayScore = ?, prizeHighDayPosition = ?, prizeLowDayPosition = ?, prizePercentage1 = ?, prizePercentage2 = ?, prizePercentage3 = ?, prizePercentage4 = ?, prizeLowFinalPosition = ?'
  if (id) {
    await getPool(id)
    await execute(`UPDATE tblPools SET ${columns} WHERE poolID = ?`, [...values, id])
    return id
  }
  return transaction(async (db) => {
    const organisation = await query<{ organisationID: number }>('SELECT organisationID FROM tblOrganisation ORDER BY organisationID LIMIT 1', [], db)
    const { insertId } = await execute(`INSERT INTO tblPools SET ${columns}, organisationID = ?`, [...values, organisation[0]?.organisationID ?? null], db)
    // Start with the default points of every point type, like VBPool2 did.
    await execute('INSERT INTO tblPoolPoints (poolid, pointTypeID, pointPointsAward, pointPointsMargin) SELECT ?, pointTypeID, pointDefaultPoints, pointDefaultMargin FROM tblPointTypes WHERE pointTypeID NOT IN (13, 22, 25, 29, 30, 31)', [insertId], db)
    return insertId
  })
}

export async function getOrganisationName(): Promise<string> {
  const [row] = await query<{ firstName: string | null; middleName: string | null; lastName: string | null }>('SELECT firstName, middleName, lastName FROM tblOrganisation ORDER BY organisationID LIMIT 1')
  return row ? joinName(row.firstName, row.middleName, row.lastName) : ''
}

// ---------- tournaments ----------

interface TournamentRow {
  tournamentID: number; tournamentYear: number; tournamentType: string; tournamentLocationID: number | null; tournamentTeamCount: number
  tournamentGroupCount: number; tournamentStartDate: string | null; tournamentEndDate: string | null; tournamentThirdPlace: number
}

function toTournament(row: TournamentRow): Tournament & { id: number } {
  return {
    id: row.tournamentID, year: row.tournamentYear, type: row.tournamentType ?? '', locationId: row.tournamentLocationID,
    teamCount: row.tournamentTeamCount ?? 0, groupCount: row.tournamentGroupCount ?? 0,
    startDate: dateOnly(row.tournamentStartDate), endDate: dateOnly(row.tournamentEndDate), thirdPlace: !!row.tournamentThirdPlace,
  }
}

export async function listTournaments(): Promise<(Tournament & { id: number })[]> {
  return (await query<TournamentRow>('SELECT * FROM tblTournaments ORDER BY tournamentYear DESC, tournamentID DESC')).map(toTournament)
}

export async function getTournament(id: number): Promise<Tournament & { id: number }> {
  const [row] = await query<TournamentRow>('SELECT * FROM tblTournaments WHERE tournamentID = ?', [id])
  if (!row) throw new NotFoundError('Toernooi niet gevonden.')
  return toTournament(row)
}

export async function saveTournament(tournament: Tournament, id?: number, db?: Db): Promise<number> {
  const values = [tournament.year, tournament.type, tournament.locationId, tournament.teamCount, tournament.groupCount,
    dateTime(tournament.startDate), dateTime(tournament.endDate), tournament.thirdPlace]
  const columns = 'tournamentYear = ?, tournamentType = ?, tournamentLocationID = ?, tournamentTeamCount = ?, tournamentGroupCount = ?, tournamentStartDate = ?, tournamentEndDate = ?, tournamentThirdPlace = ?'
  if (id) {
    await execute(`UPDATE tblTournaments SET ${columns} WHERE tournamentID = ?`, [...values, id], db)
    return id
  }
  return (await execute(`INSERT INTO tblTournaments SET ${columns}, tournamentClubTournament = 0`, values, db)).insertId
}

// ---------- reference data ----------

export async function listTeams(): Promise<Team[]> {
  return (await query<{ teamNameID: number; teamName: string; teamShortName: string | null; teamCountryID: number | null }>(
    'SELECT teamNameID, teamName, teamShortName, teamCountryID FROM tblTeamNames ORDER BY teamName',
  )).map((row) => ({ id: row.teamNameID, name: row.teamName, shortName: row.teamShortName, countryId: row.teamCountryID }))
}

export async function saveTeam(team: Omit<Team, 'id'>, id?: number, db?: Db): Promise<number> {
  const values = [team.name, team.shortName, team.countryId]
  if (id) {
    await execute('UPDATE tblTeamNames SET teamName = ?, teamShortName = ?, teamCountryID = ? WHERE teamNameID = ?', [...values, id], db)
    return id
  }
  return (await execute('INSERT INTO tblTeamNames (teamName, teamShortName, teamCountryID, teamType) VALUES (?, ?, ?, 1)', values, db)).insertId
}

export async function listCountries(): Promise<Country[]> {
  return (await query<{ countryID: number; countryName: string; countryCode: string | null }>('SELECT * FROM tblCountries ORDER BY countryName'))
    .map((row) => ({ id: row.countryID, name: row.countryName, code: row.countryCode }))
}

export async function listStadiums(): Promise<Stadium[]> {
  return (await query<{ stadiumID: number; stadiumName: string; stadiumLocation: string | null }>('SELECT stadiumID, stadiumName, stadiumLocation FROM tblStadiums ORDER BY stadiumLocation, stadiumName'))
    .map((row) => ({ id: row.stadiumID, name: row.stadiumName, location: row.stadiumLocation }))
}

export async function createStadium(stadium: Omit<Stadium, 'id'>): Promise<number> {
  return (await execute('INSERT INTO tblStadiums (stadiumName, stadiumLocation) VALUES (?, ?)', [stadium.name, stadium.location])).insertId
}

export async function listFunctions(): Promise<PlayerFunction[]> {
  return (await query<{ functionID: number; functionName: string }>('SELECT * FROM tblFunctions ORDER BY functionID'))
    .map((row) => ({ id: row.functionID, name: row.functionName }))
}

// ---------- groups & schedule ----------

export async function getGroups(tournamentId: number): Promise<GroupSlot[]> {
  return (await query<{ groupLetter: string; groupPlace: number; teamID: number | null }>(
    'SELECT groupLetter, groupPlace, teamID FROM tblGroupLayout WHERE tournamentID = ? ORDER BY groupLetter, groupPlace', [tournamentId],
  )).map((row) => ({ letter: row.groupLetter, place: row.groupPlace, teamId: teamOrNull(row.teamID) }))
}

export async function saveGroups(tournamentId: number, slots: GroupSlot[], db?: Db): Promise<void> {
  const work = async (conn: Db) => {
    const keep = slots.map((slot) => `${slot.letter}${slot.place}`)
    const existing = await getGroups(tournamentId)
    for (const slot of existing) {
      if (!keep.includes(`${slot.letter}${slot.place}`)) {
        await execute('DELETE FROM tblGroupLayout WHERE tournamentID = ? AND groupLetter = ? AND groupPlace = ?', [tournamentId, slot.letter, slot.place], conn)
      }
    }
    for (const slot of slots) {
      await execute('INSERT INTO tblGroupLayout (tournamentID, groupLetter, groupPlace, teamID) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE teamID = VALUES(teamID)',
        [tournamentId, slot.letter, slot.place, slot.teamId], conn)
      // Keep the "A1" style team codes in sync; VBPool2 resolves schedule codes through this table.
      await execute('INSERT INTO tblTournamentTeamCodes (tournamentID, teamCode, teamID) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE teamID = VALUES(teamID)',
        [tournamentId, `${slot.letter}${slot.place}`, slot.teamId ?? 0], conn)
    }
  }
  if (db) await work(db)
  else await transaction(work)
}

export async function getSchedule(tournamentId: number): Promise<ScheduleMatch[]> {
  return (await query<{ matchNumber: number; matchDate: string | null; matchTime: string | null; matchType: number; matchTeamA: string; matchTeamB: string; matchStadiumID: number | null; matchOrder: number | null }>(
    'SELECT matchNumber, matchDate, matchTime, matchType, matchTeamA, matchTeamB, matchStadiumID, matchOrder FROM tblTournamentSchedule WHERE tournamentID = ? ORDER BY matchOrder, matchNumber', [tournamentId],
  )).map((row) => ({
    number: row.matchNumber, date: dateOnly(row.matchDate), time: timeOnly(row.matchTime), type: row.matchType ?? MATCH_TYPES.group,
    codeA: row.matchTeamA ?? '', codeB: row.matchTeamB ?? '', stadiumId: row.matchStadiumID, order: row.matchOrder ?? row.matchNumber,
  }))
}

export async function saveSchedule(tournamentId: number, matches: ScheduleMatch[], db?: Db): Promise<void> {
  const work = async (conn: Db) => {
    const numbers = matches.map((match) => match.number)
    if (numbers.length) await execute(`DELETE FROM tblTournamentSchedule WHERE tournamentID = ? AND matchNumber NOT IN (${numbers.map(() => '?').join(',')})`, [tournamentId, ...numbers], conn)
    else await execute('DELETE FROM tblTournamentSchedule WHERE tournamentID = ?', [tournamentId], conn)
    for (const match of matches) {
      await execute(`INSERT INTO tblTournamentSchedule (tournamentID, matchNumber, matchDate, matchTime, matchType, matchTeamA, matchTeamB, matchStadiumID, matchOrder)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE matchDate = VALUES(matchDate), matchTime = VALUES(matchTime), matchType = VALUES(matchType),
        matchTeamA = VALUES(matchTeamA), matchTeamB = VALUES(matchTeamB), matchStadiumID = VALUES(matchStadiumID), matchOrder = VALUES(matchOrder)`,
      [tournamentId, match.number, dateTime(match.date), timeValue(match.time), match.type, match.codeA, match.codeB, match.stadiumId, match.order], conn)
    }
  }
  if (db) await work(db)
  else await transaction(work)
}

// ---------- players ----------

export async function listPlayers(tournamentId: number, teamId?: number): Promise<Player[]> {
  const rows = await query<{ tournamentPlayerID: number; peopleID: number; teamID: number; firstName: string | null; middleName: string | null; lastName: string | null; nickName: string | null; functionID: number | null }>(`
    SELECT tp.tournamentPlayerID, p.peopleID, tp.teamID, p.firstName, p.middleName, p.lastName, p.nickName, p.functionID
    FROM tblTeamPlayers tp JOIN tblPeople p ON p.peopleID = tp.playerID
    WHERE tp.tournamentID = ? ${teamId ? 'AND tp.teamID = ?' : ''} ORDER BY p.functionID = 1 DESC, p.lastName, p.firstName`, teamId ? [tournamentId, teamId] : [tournamentId])
  return rows.map((row) => ({
    tournamentPlayerId: row.tournamentPlayerID, id: row.peopleID, teamId: row.teamID, firstName: row.firstName ?? '',
    middleName: row.middleName, lastName: row.lastName ?? '', nickName: row.nickName, functionId: row.functionID,
  }))
}

type PersonInput = Pick<Player, 'firstName' | 'middleName' | 'lastName' | 'nickName' | 'functionId'>

export async function addPlayer(tournamentId: number, teamId: number, person: PersonInput, db?: Db): Promise<number> {
  const work = async (conn: Db) => {
    const { insertId: peopleId } = await execute('INSERT INTO tblPeople (firstName, middleName, lastName, nickName, functionID, active) VALUES (?, ?, ?, ?, ?, 1)',
      [person.firstName, person.middleName || null, person.lastName, person.nickName || null, person.functionId], conn)
    return (await execute('INSERT INTO tblTeamPlayers (tournamentID, teamID, playerID) VALUES (?, ?, ?)', [tournamentId, teamId, peopleId], conn)).insertId
  }
  return db ? work(db) : transaction(work)
}

export async function updatePerson(peopleId: number, person: PersonInput): Promise<void> {
  await execute('UPDATE tblPeople SET firstName = ?, middleName = ?, lastName = ?, nickName = ?, functionID = ? WHERE peopleID = ?',
    [person.firstName, person.middleName || null, person.lastName, person.nickName || null, person.functionId, peopleId])
}

export async function removePlayer(tournamentId: number, tournamentPlayerId: number): Promise<void> {
  await execute('DELETE FROM tblTeamPlayers WHERE tournamentID = ? AND tournamentPlayerID = ?', [tournamentId, tournamentPlayerId])
}

// ---------- points ----------

export async function getPoints(poolId: number): Promise<PointSetting[]> {
  const rows = await query<{ pointTypeID: number; pointTypeDescription: string; pointDescrShort: string | null; pointTypeCategory: number; pointTypeListOrder: number; pointDefaultPoints: number; pointDefaultMargin: number; pointPointsAward: number | null; pointPointsMargin: number | null; enabled: number }>(`
    SELECT t.*, pp.pointPointsAward, pp.pointPointsMargin, pp.poolid IS NOT NULL AS enabled
    FROM tblPointTypes t LEFT JOIN tblPoolPoints pp ON pp.pointTypeID = t.pointTypeID AND pp.poolid = ?
    ORDER BY t.pointTypeCategory, t.pointTypeListOrder`, [poolId])
  return rows.map((row) => ({
    typeId: row.pointTypeID, description: row.pointTypeDescription, short: row.pointDescrShort, category: row.pointTypeCategory,
    listOrder: row.pointTypeListOrder, enabled: !!row.enabled,
    points: Number(row.enabled ? row.pointPointsAward : row.pointDefaultPoints) || 0,
    margin: Number(row.enabled ? row.pointPointsMargin : row.pointDefaultMargin) || 0,
  }))
}

export async function savePoints(poolId: number, points: Pick<PointSetting, 'typeId' | 'enabled' | 'points' | 'margin'>[]): Promise<void> {
  await getPool(poolId)
  await transaction(async (db) => {
    await execute('DELETE FROM tblPoolPoints WHERE poolid = ?', [poolId], db)
    for (const point of points.filter((item) => item.enabled)) {
      await execute('INSERT INTO tblPoolPoints (poolid, pointTypeID, pointPointsAward, pointPointsMargin) VALUES (?, ?, ?, ?)', [poolId, point.typeId, point.points, point.margin], db)
    }
  })
}

// ---------- form data ----------

export async function getFormData(poolId: number): Promise<FormData> {
  const pool = await getPool(poolId)
  if (!pool.tournamentId) throw new NotFoundError('Deze pool is nog niet aan een toernooi gekoppeld.')
  const tournament = await getTournament(pool.tournamentId)
  const [organisation, slots, schedule, points, allTeams, players] = await Promise.all([
    getOrganisationName(), getGroups(tournament.id), getSchedule(tournament.id), getPoints(poolId), listTeams(), listPlayers(tournament.id),
  ])
  const teamName = new Map(allTeams.map((team) => [team.id, team.name]))
  const groups = [...new Set(slots.map((slot) => slot.letter))].map((letter) => ({
    letter,
    teams: slots.filter((slot) => slot.letter === letter).map((slot) => ({ place: slot.place, id: slot.teamId ?? 0, name: slot.teamId ? teamName.get(slot.teamId) ?? '?' : `${letter}${slot.place}` })),
  }))
  const slotTeam = new Map(groups.flatMap((group) => group.teams.filter((team) => team.id).map((team) => [`${group.letter}${team.place}`, { id: team.id, name: team.name }])))
  const teams = groups.flatMap((group) => group.teams.filter((team) => team.id).map((team) => ({ id: team.id, name: team.name })))
    .sort((a, b) => a.name.localeCompare(b.name, 'nl'))
  const teamOfPlayer = new Map(teams.map((team) => [team.id, team.name]))
  return {
    organisation,
    pool,
    tournament: { ...tournament, description: `${tournament.type} - ${tournament.year}` },
    groups,
    teams,
    matches: schedule.map((match) => ({
      number: match.number, date: match.date, time: match.time, type: match.type, codeA: match.codeA, codeB: match.codeB,
      teamA: match.type === MATCH_TYPES.group ? slotTeam.get(match.codeA) ?? null : null,
      teamB: match.type === MATCH_TYPES.group ? slotTeam.get(match.codeB) ?? null : null,
    })),
    points,
    players: players.filter((player) => player.functionId !== 1 && player.functionId !== 6 && teamOfPlayer.has(player.teamId))
      .map((player) => ({ id: player.id, name: player.nickName || joinName(player.firstName, player.middleName, player.lastName), teamName: teamOfPlayer.get(player.teamId)! }))
      .sort((a, b) => a.name.localeCompare(b.name, 'nl')),
  }
}

// ---------- participants / entries ----------

interface CompetitorRow {
  competitorPoolID: number; addressID: number; nickName: string | null; payed: number; payedTo: string | null; entrySource: string | null; createdAt: string | null
  predictionTeam1: number | null; predictionTeam2: number | null; predictionTeam3: number | null; predictionTeam4: number | null
  firstname: string | null; middlename: string | null; lastname: string | null; telephone: string | null; email: string | null
}

async function loadEntries(poolId: number, competitorPoolId?: number): Promise<{ row: CompetitorRow; entry: EntryPrediction }[]> {
  const filter = competitorPoolId ? 'c.poolid = ? AND c.competitorPoolID = ?' : 'c.poolid = ?'
  const params = competitorPoolId ? [poolId, competitorPoolId] : [poolId]
  const competitors = await query<CompetitorRow>(`
    SELECT c.*, a.firstname, a.middlename, a.lastname, a.telephone, a.email
    FROM tblCompetitorPools c LEFT JOIN tblAddresses a ON a.addressID = c.addressID WHERE ${filter} ORDER BY a.lastname, a.firstname`, params)
  const scope = `competitorPoolID IN (SELECT c.competitorPoolID FROM tblCompetitorPools c WHERE ${filter})`
  const [groups, finals, matches, numbers, scorers] = await Promise.all([
    query<{ competitorPoolID: number; groupLetter: string; p1: number | null; p2: number | null; p3: number | null; p4: number | null }>(
      `SELECT competitorPoolID, groupLetter, predictionGroupPosition1 p1, predictionGroupPosition2 p2, predictionGroupPosition3 p3, predictionGroupPosition4 p4 FROM tblPredictionGroupResults WHERE ${scope}`, params),
    query<{ competitorPoolID: number; matchNumber: number; teamNameA: number | null; teamNameB: number | null }>(`SELECT * FROM tblPrediction_Finals WHERE ${scope}`, params),
    query<{ competitorPoolID: number; matchNumber: number; htA: number | null; htB: number | null; ftA: number | null; ftB: number | null; tt: number | null }>(`SELECT * FROM tblPrediction_MatchResults WHERE ${scope}`, params),
    query<{ competitorPoolID: number; predictionTypeID: number; predictionNumber: number | null }>(`SELECT * FROM tblPrediction_Numbers WHERE ${scope}`, params),
    query<{ competitorPoolID: number; topscorerPlayerID: number | null; topscorerGoals: number | null }>(`SELECT * FROM tblPredictionTopscorers WHERE topscorerPosition = 1 AND ${scope}`, params),
  ])
  return competitors.map((row) => {
    const id = row.competitorPoolID
    const scorer = scorers.find((item) => item.competitorPoolID === id)
    const toPosition = (value: number | null) => (value && value > 0 ? value : null)
    return {
      row,
      entry: {
        name: joinName(row.firstname, row.middlename, row.lastname) || row.nickName || '',
        telephone: row.telephone ?? '', email: row.email ?? '', payed: !!row.payed, payedTo: row.payedTo ?? '',
        groups: Object.fromEntries(groups.filter((item) => item.competitorPoolID === id).map((item) => [item.groupLetter, [item.p1, item.p2, item.p3, item.p4].map(toPosition)])),
        finals: Object.fromEntries(finals.filter((item) => item.competitorPoolID === id).map((item) => [String(item.matchNumber), [teamOrNull(item.teamNameA), teamOrNull(item.teamNameB)]])),
        matches: Object.fromEntries(matches.filter((item) => item.competitorPoolID === id).map((item) => [String(item.matchNumber), { htA: item.htA, htB: item.htB, ftA: item.ftA, ftB: item.ftB, toto: item.tt || null }])),
        standings: [teamOrNull(row.predictionTeam1), teamOrNull(row.predictionTeam2), teamOrNull(row.predictionTeam3), teamOrNull(row.predictionTeam4)],
        topscorer: { playerId: scorer?.topscorerPlayerID ?? null, goals: scorer?.topscorerGoals ?? null },
        numbers: Object.fromEntries(numbers.filter((item) => item.competitorPoolID === id).map((item) => [String(item.predictionTypeID), item.predictionNumber])),
      },
    }
  })
}

export async function listParticipants(poolId: number, countMissing: (entry: EntryPrediction) => number): Promise<ParticipantSummary[]> {
  await getPool(poolId)
  return (await loadEntries(poolId)).map(({ row, entry }) => ({
    id: row.competitorPoolID, name: entry.name, email: entry.email, telephone: entry.telephone, payed: entry.payed, payedTo: entry.payedTo,
    source: row.entrySource, createdAt: row.createdAt, missing: countMissing(entry),
  }))
}

export async function getEntry(poolId: number, competitorPoolId: number): Promise<EntryPrediction> {
  const [result] = await loadEntries(poolId, competitorPoolId)
  if (!result) throw new NotFoundError('Deelnemer niet gevonden.')
  return result.entry
}

async function deletePredictions(db: Db, competitorPoolId: number): Promise<void> {
  for (const table of ['tblPredictionGroupResults', 'tblPrediction_Finals', 'tblPrediction_MatchResults', 'tblPrediction_Numbers', 'tblPredictionTopscorers']) {
    await execute(`DELETE FROM ${table} WHERE competitorPoolID = ?`, [competitorPoolId], db)
  }
}

export async function saveEntry(poolId: number, entry: EntryPrediction, options: { competitorPoolId?: number; source: 'online' | 'admin' }): Promise<number> {
  await getPool(poolId)
  return transaction(async (db) => {
    const name = splitName(entry.name)
    const address = [name.firstName, name.middleName || null, name.lastName, entry.telephone.trim(), entry.email.trim()]
    const standings = entry.standings.map((team) => team ?? 0)
    let id = options.competitorPoolId
    if (id) {
      const [existing] = await query<{ addressID: number }>('SELECT addressID FROM tblCompetitorPools WHERE competitorPoolID = ? AND poolid = ?', [id, poolId], db)
      if (!existing) throw new NotFoundError('Deelnemer niet gevonden.')
      await execute('UPDATE tblAddresses SET firstname = ?, middlename = ?, lastname = ?, telephone = ?, email = ? WHERE addressID = ?', [...address, existing.addressID], db)
      await execute('UPDATE tblCompetitorPools SET nickName = ?, payed = ?, payedTo = ?, predictionTeam1 = ?, predictionTeam2 = ?, predictionTeam3 = ?, predictionTeam4 = ? WHERE competitorPoolID = ?',
        [entry.name.trim(), entry.payed, entry.payedTo.trim() || null, ...standings, id], db)
      await deletePredictions(db, id)
    } else {
      const { insertId: addressId } = await execute('INSERT INTO tblAddresses (firstname, middlename, lastname, telephone, email) VALUES (?, ?, ?, ?, ?)', address, db)
      id = (await execute(`INSERT INTO tblCompetitorPools (addressID, poolid, nickName, payed, payedTo, entrySource, createdAt, predictionTeam1, predictionTeam2, predictionTeam3, predictionTeam4)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [addressId, poolId, entry.name.trim(), entry.payed, entry.payedTo.trim() || null, options.source, localTimestamp(), ...standings], db)).insertId
    }
    for (const [letter, positions] of Object.entries(entry.groups)) {
      await execute('INSERT INTO tblPredictionGroupResults (competitorPoolID, groupLetter, predictionGroupPosition1, predictionGroupPosition2, predictionGroupPosition3, predictionGroupPosition4) VALUES (?, ?, ?, ?, ?, ?)',
        [id, letter, ...[0, 1, 2, 3].map((index) => positions[index] ?? 0)], db)
    }
    for (const [number, [teamA, teamB]] of Object.entries(entry.finals)) {
      await execute('INSERT INTO tblPrediction_Finals (competitorPoolID, matchNumber, teamNameA, teamNameB) VALUES (?, ?, ?, ?)', [id, Number(number), teamA ?? 0, teamB ?? 0], db)
    }
    for (const [number, match] of Object.entries(entry.matches)) {
      await execute('INSERT INTO tblPrediction_MatchResults (competitorPoolID, matchNumber, htA, htB, ftA, ftB, tt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, Number(number), match.htA, match.htB, match.ftA, match.ftB, match.toto ?? 0], db)
    }
    for (const [typeId, value] of Object.entries(entry.numbers)) {
      if (value !== null) await execute('INSERT INTO tblPrediction_Numbers (competitorPoolID, predictionTypeID, predictionNumber) VALUES (?, ?, ?)', [id, Number(typeId), value], db)
    }
    if (entry.topscorer.playerId || entry.topscorer.goals !== null) {
      await execute('INSERT INTO tblPredictionTopscorers (competitorPoolID, topscorerPosition, topscorerPlayerID, topscorerGoals) VALUES (?, 1, ?, ?)', [id, entry.topscorer.playerId, entry.topscorer.goals], db)
    }
    return id
  })
}

export async function deleteEntry(poolId: number, competitorPoolId: number): Promise<void> {
  await transaction(async (db) => {
    const [existing] = await query<{ addressID: number }>('SELECT addressID FROM tblCompetitorPools WHERE competitorPoolID = ? AND poolid = ?', [competitorPoolId, poolId], db)
    if (!existing) throw new NotFoundError('Deelnemer niet gevonden.')
    await deletePredictions(db, competitorPoolId)
    await execute('DELETE FROM tblCompetitorPoints WHERE competitorPoolID = ?', [competitorPoolId], db)
    await execute('DELETE FROM tblCompetitorPools WHERE competitorPoolID = ?', [competitorPoolId], db)
    // Addresses are shared between pools of returning participants.
    const [used] = await query<{ count: number }>('SELECT COUNT(*) AS count FROM tblCompetitorPools WHERE addressID = ?', [existing.addressID], db)
    if (!Number(used?.count)) await execute('DELETE FROM tblAddresses WHERE addressID = ?', [existing.addressID], db)
  })
}

// ---------- import / export ----------

export async function exportTournament(tournamentId: number): Promise<TournamentExport> {
  const [tournament, slots, schedule, players, teams, stadiums] = await Promise.all([
    getTournament(tournamentId), getGroups(tournamentId), getSchedule(tournamentId), listPlayers(tournamentId), listTeams(), listStadiums(),
  ])
  const teamName = new Map(teams.map((team) => [team.id, team]))
  const stadiumName = new Map(stadiums.map((stadium) => [stadium.id, stadium.name]))
  const used = [...new Set(slots.map((slot) => slot.teamId).filter((id): id is number => !!id))]
  const { id: _id, ...plain } = tournament
  return {
    format: 'vbpool-tournament', version: 1, tournament: plain,
    teams: used.map((id) => ({ name: teamName.get(id)?.name ?? `Team ${id}`, shortName: teamName.get(id)?.shortName ?? null })),
    groups: slots.map((slot) => ({ letter: slot.letter, place: slot.place, team: slot.teamId ? teamName.get(slot.teamId)?.name ?? null : null })),
    schedule: schedule.map(({ stadiumId, ...match }) => ({ ...match, stadium: stadiumId ? stadiumName.get(stadiumId) ?? null : null })),
    players: players.map((player) => ({ team: teamName.get(player.teamId)?.name ?? '', firstName: player.firstName, middleName: player.middleName, lastName: player.lastName, functionId: player.functionId })),
  }
}

/** Import into an existing tournament (replaces groups, schedule and players) or create a new one. */
export async function importTournament(data: TournamentExport, tournamentId?: number): Promise<number> {
  const teams = await listTeams()
  const stadiums = await listStadiums()
  return transaction(async (db) => {
    const id = await saveTournament(data.tournament, tournamentId, db)
    const teamIds = new Map(teams.map((team) => [team.name.toLocaleLowerCase('nl'), team.id]))
    const resolveTeam = async (name: string, shortName?: string | null) => {
      const key = name.trim().toLocaleLowerCase('nl')
      if (!teamIds.has(key)) teamIds.set(key, await saveTeam({ name: name.trim(), shortName: shortName ?? null, countryId: null }, undefined, db))
      return teamIds.get(key)!
    }
    for (const team of data.teams) await resolveTeam(team.name, team.shortName)
    const slots: GroupSlot[] = []
    for (const slot of data.groups) slots.push({ letter: slot.letter, place: slot.place, teamId: slot.team ? await resolveTeam(slot.team) : null })
    await saveGroups(id, slots, db)
    const stadiumIds = new Map(stadiums.map((stadium) => [stadium.name.toLocaleLowerCase('nl'), stadium.id]))
    await saveSchedule(id, data.schedule.map(({ stadium, ...match }) => ({ ...match, stadiumId: stadium ? stadiumIds.get(stadium.toLocaleLowerCase('nl')) ?? null : null })), db)
    if (data.players.length) {
      await execute('DELETE FROM tblTeamPlayers WHERE tournamentID = ?', [id], db)
      for (const player of data.players) {
        await addPlayer(id, await resolveTeam(player.team), { firstName: player.firstName, middleName: player.middleName ?? null, lastName: player.lastName, nickName: null, functionId: player.functionId ?? null }, db)
      }
    }
    return id
  })
}

/** Local wall-clock time; the database container runs in UTC while the VB program uses local time. */
function localTimestamp(date = new Date()): string {
  return date.toLocaleString('sv-SE', { timeZone: 'Europe/Amsterdam' })
}
