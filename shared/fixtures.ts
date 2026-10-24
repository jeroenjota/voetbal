import type { FormData, PointSetting } from './types'

const point = (typeId: number, category: number, points: number, enabled = true, description = `punt ${typeId}`): PointSetting => ({
  typeId, description, short: null, category, listOrder: typeId, enabled, points, margin: 0,
})

/** A tiny tournament: one group of four, one semi-final, one final. */
export function sampleForm(overrides: Partial<FormData['pool']> = {}): FormData {
  const teams = [1, 2, 3, 4].map((id) => ({ id, name: `Team ${id}` }))
  return {
    organisation: 'Cafe Test',
    pool: {
      id: 7, tournamentId: 3, name: 'Testpool', formsFrom: null, formsTill: null, cost: 10,
      prizeHighDayScore: 0, prizeHighDayPosition: 0, prizeLowDayPosition: 0, prizeLowFinalPosition: 0,
      prizePercentages: [50, 30, 15, 5], ...overrides,
    },
    tournament: { id: 3, year: 2030, type: 'WK', locationId: null, teamCount: 4, groupCount: 1, startDate: null, endDate: null, thirdPlace: false, description: 'WK - 2030' },
    groups: [{ letter: 'A', teams: teams.map((team, index) => ({ ...team, place: index + 1 })) }],
    teams,
    matches: [
      { number: 1, date: '2030-06-11', time: '18:00', type: 1, codeA: 'A1', codeB: 'A2', teamA: teams[0]!, teamB: teams[1]! },
      { number: 3, date: '2030-06-14', time: '21:00', type: 4, codeA: 'W2', codeB: 'W2b', teamA: null, teamB: null },
      { number: 2, date: '2030-06-13', time: '21:00', type: 3, codeA: '1A', codeB: '2A', teamA: null, teamB: null },
    ],
    points: [
      point(9, 3, 12), point(10, 3, 16), point(11, 3, 20), point(12, 3, 24),
      point(15, 4, 50), point(14, 4, 36), point(13, 7, 24, false),
      point(21, 5, 30), point(24, 5, 12),
      point(18, 6, 16, true, 'aantal gele kaarten'), point(19, 6, 16, false, 'aantal rode kaarten'),
    ],
    players: [{ id: 100, name: 'Speler, Een', teamName: 'Team 1' }],
  }
}
