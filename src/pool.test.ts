import { describe, expect, it } from 'vitest'
import {
  completedFields, completeMatches, dailyGoalsBonus, fields, fixtures, groupFixtures, groups,
  isValidAnswer, knockoutFixtures, matchPoints, readEntry, roundPoints, rounds, scoreEntry, teamSlots, totals, validateAnswers,
} from './pool'
import type { Answers } from './pool'

function fullAnswers(): Answers {
  return Object.fromEntries(fields.map((field) => [field.id, field.kind === 'email' ? 'test@example.test'
    : ['position', 'toto'].includes(field.kind) ? '1' : field.kind === 'number' ? '0' : 'Nederland']))
}

describe('toernooiopzet', () => {
  it('heeft 24 teamplekken, zes groepen en 36 unieke groepswedstrijden', () => {
    expect(teamSlots).toHaveLength(24)
    expect(groupFixtures).toHaveLength(36)
    for (const group of groups) {
      const matches = groupFixtures.filter((match) => match.group === group)
      expect(matches).toHaveLength(6)
      expect(new Set(matches.map((match) => [match.home, match.away].sort().join('-'))).size).toBe(6)
      for (const team of teamSlots.filter((slot) => slot.startsWith(group))) {
        expect(matches.filter((match) => match.home === team || match.away === team)).toHaveLength(3)
      }
    }
  })
  it('heeft 8+4+2+1 knock-outwedstrijden, 51 unieke nummers en 30 teamvelden', () => {
    expect(knockoutFixtures.map((match) => match.id)).toEqual(Array.from({ length: 15 }, (_, i) => i + 37))
    expect(fixtures).toHaveLength(51)
    expect(new Set(fixtures.map((match) => match.id)).size).toBe(51)
    expect(fields.filter((field) => field.section === 'knockout')).toHaveLength(30)
    expect(fields.filter((field) => field.section === 'matches')).toHaveLength(255)
    expect(new Set(fields.map((field) => field.id)).size).toBe(fields.length)
  })
  it('verwijst in latere rondes alleen naar eerdere wedstrijden', () => {
    for (const fixture of knockoutFixtures.filter((match) => match.id >= 45)) {
      for (const slot of [fixture.home, fixture.away]) {
        const id = Number(slot.slice(1))
        expect(id).toBeLessThan(fixture.id)
        expect(knockoutFixtures.some((match) => match.id === id)).toBe(true)
      }
    }
  })
})

describe('onafhankelijk invullen en validatie', () => {
  it('accepteert tegenstrijdige groepsstanden, rondes en uitslagen', () => {
    const answers = fullAnswers()
    answers['group.A1'] = '4'
    answers.champion = 'A1'
    answers['team.51.home'] = 'B1'
    answers['match.51.ht.home'] = '9'
    answers['match.51.ft.home'] = '0'
    answers['match.51.ft.away'] = '0'
    answers['match.51.toto'] = '1'
    expect(validateAnswers(answers)).toEqual([])
    expect(completedFields(answers)).toBe(fields.length)
    expect(completeMatches(answers)).toBe(51)
  })
  it('telt nul als ingevuld, een lege score niet', () => {
    const answers = fullAnswers()
    expect(completeMatches(answers)).toBe(51)
    answers['match.1.ht.home'] = ''
    expect(completeMatches(answers)).toBe(50)
  })
  it.each(['-1', '1.5', '100', '1e1', 'NaN', ' '])('weigert ongeldige score %s', (value) => {
    expect(isValidAnswer(fields.find((field) => field.id === 'match.1.ft.home')!, value)).toBe(false)
  })
  it('accepteert alleen toto 1/2/3 en posities 1/2/3/4', () => {
    const toto = fields.find((field) => field.id === 'match.1.toto')!
    const position = fields.find((field) => field.id === 'group.A1')!
    expect(isValidAnswer(toto, '3')).toBe(true)
    expect(isValidAnswer(toto, '0')).toBe(false)
    expect(isValidAnswer(position, '4')).toBe(true)
    expect(isValidAnswer(position, '5')).toBe(false)
  })
})

describe('opslag', () => {
  it('start met een leeg concept', () => {
    expect(readEntry({ getItem: () => null })).toEqual({ version: 2, answers: {}, finished: false })
  })
  it('bewaart gedeeltelijke en volledige formulieren', () => {
    for (const entry of [
      { version: 2, answers: { 'match.51.ft.home': '0' }, finished: false },
      { version: 2, answers: fullAnswers(), finished: true },
    ]) expect(readEntry({ getItem: () => JSON.stringify(entry) })).toEqual(entry)
  })
  it.each(['invalid', 'null', '[]', '{"version":1}', '{"version":2,"answers":{},"finished":true}',
    '{"version":2,"answers":{"wrong":"1"},"finished":false}',
    '{"version":2,"answers":{"match.1.toto":1},"finished":false}',
  ])('meldt corrupte of onvolledige opslag %s', (raw) => {
    expect(() => readEntry({ getItem: () => raw })).toThrow()
  })
  it('laat leesfouten door aan de interface', () => {
    expect(() => readEntry({ getItem: () => { throw new Error('Geblokkeerd') } })).toThrow('Geblokkeerd')
  })
})

describe('punten volgens de PDF', () => {
  it('verbindt alle onderdelen tot 1072 punten exclusief dagbonussen bij een foutloos formulier', () => {
    const answers = fullAnswers()
    for (const round of rounds) {
      knockoutFixtures.filter((match) => match.round === round.name).forEach((match, index) => {
        answers[`team.${match.id}.home`] = teamSlots[index * 2]!
        answers[`team.${match.id}.away`] = teamSlots[index * 2 + 1]!
      })
    }
    expect(scoreEntry(answers, answers)).toEqual({
      match: 408, group: 120, knockout: 336, final: 86, scorer: 42, numbers: 80, total: 1072,
    })
  })
  it('telt rust 2 + eind 4 + toto 2 op, ook bij onderlinge tegenstrijdigheid', () => {
    const answers: Answers = {
      'match.51.ht.home': '2', 'match.51.ht.away': '0',
      'match.51.ft.home': '1', 'match.51.ft.away': '1', 'match.51.toto': '1',
    }
    expect(matchPoints(answers, answers, 51)).toBe(8)
    expect(matchPoints({ ...answers, 'match.51.toto': '3' }, answers, 51)).toBe(6)
    expect(matchPoints({ 'match.51.ft.home': '1' }, answers, 51)).toBe(0)
    expect(matchPoints({}, {}, 51)).toBe(0)
  })
  it('geeft 5 punten per juiste groepspositie', () => {
    expect(scoreEntry({ 'group.A1': '4' }, { 'group.A1': '4' }).group).toBe(5)
    expect(scoreEntry({}, {}).total).toBe(0)
  })
  it.each([[5, 8], [8, 12], [12, 16], [20, 24]])('geeft %i genoemd óf %i exact, niet beide', (mentioned, exact) => {
    expect(roundPoints(['Nederland', 'België'], ['Nederland', 'België'], mentioned, exact)).toBe(exact * 2)
    expect(roundPoints(['België', 'Nederland'], ['Nederland', 'België'], mentioned, exact)).toBe(mentioned * 2)
    expect(roundPoints(['Nederland', 'Nederland'], ['Nederland', 'België'], mentioned, exact)).toBe(exact)
    expect(roundPoints(['Nederland', 'Nederland'], ['België', 'Nederland'], mentioned, exact)).toBe(exact)
    expect(roundPoints(['', ''], ['', ''], mentioned, exact)).toBe(0)
  })
  it('telt kampioen, nummer twee, topscorer en goals onafhankelijk', () => {
    const answers = { champion: 'Nederland', runnerUp: 'België', topscorer: 'Speler', topscorerGoals: '0' }
    expect(scoreEntry(answers, answers)).toMatchObject({ final: 86, scorer: 42, total: 128 })
    expect(scoreEntry({ topscorerGoals: '0' }, answers).scorer).toBe(12)
    expect(scoreEntry({ champion: ' nederland ' }, answers).final).toBe(50)
  })
  it.each(totals)('kent 16 punten toe inclusief de tolerantiegrens voor $id', ({ id, tolerance }) => {
    const actual = { [`total.${id}`]: '20' }
    for (const deviation of [-tolerance, 0, tolerance]) {
      expect(scoreEntry({ [`total.${id}`]: String(20 + deviation) }, actual).numbers).toBe(16)
    }
    expect(scoreEntry({ [`total.${id}`]: String(21 + tolerance) }, actual).numbers).toBe(0)
    expect(scoreEntry({}, actual).numbers).toBe(0)
  })
  it('geeft 5 dagbonus voor hetzelfde totaal, ook als losse uitslagen anders zijn', () => {
    const actual = { 'match.1.ft.home': '2', 'match.1.ft.away': '1', 'match.2.ft.home': '0', 'match.2.ft.away': '0' }
    const prediction = { ...actual, 'match.1.ft.home': '0', 'match.2.ft.home': '2' }
    expect(dailyGoalsBonus(prediction, actual, [1, 2])).toBe(5)
    expect(dailyGoalsBonus({ ...prediction, 'match.2.ft.home': '3' }, actual, [1, 2])).toBe(0)
    expect(dailyGoalsBonus(prediction, { ...actual, 'match.2.ft.home': '' }, [1, 2])).toBe(0)
    expect(dailyGoalsBonus(prediction, actual, [])).toBe(0)
  })
})
