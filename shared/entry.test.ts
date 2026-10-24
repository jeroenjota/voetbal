import { describe, expect, it } from 'vitest'
import {
  completeEntry, emptyEntry, euro, knockoutRounds, longDate, missingFields, numberLabel, numberTypes, shortDay, splitName, standingPlaces, weekdayDate,
} from './entry'
import { sampleForm } from './fixtures'
import type { EntryPrediction } from './types'

function filledEntry(): EntryPrediction {
  const form = sampleForm()
  const entry = emptyEntry(form)
  Object.assign(entry, { name: 'Jan Jansen', telephone: '0612345678', email: 'jan@example.nl' })
  entry.groups.A = [1, 2, 3, 4]
  entry.finals['2'] = [1, 2]
  entry.finals['3'] = [1, 3]
  for (const key of Object.keys(entry.matches)) entry.matches[key] = { htA: 0, htB: 0, ftA: 1, ftB: 0, toto: 1 }
  entry.standings = [1, 2, null, null]
  entry.topscorer = { playerId: 100, goals: 6 }
  entry.numbers['18'] = 120
  return entry
}

describe('knockoutRounds', () => {
  it('orders rounds semi → final and keeps their points', () => {
    const rounds = knockoutRounds(sampleForm())
    expect(rounds.map((round) => round.title)).toEqual(['Halve Finale', 'Finale'])
    expect(rounds[0]).toMatchObject({ teamPoints: 12, positionPoints: 16 })
    expect(rounds[1]!.matches.map((match) => match.number)).toEqual([3])
  })
})

describe('emptyEntry / completeEntry', () => {
  it('creates a slot for every field of the form', () => {
    const entry = emptyEntry(sampleForm())
    expect(entry.groups).toEqual({ A: [null, null, null, null] })
    expect(Object.keys(entry.finals).sort()).toEqual(['2', '3'])
    expect(Object.keys(entry.matches).sort()).toEqual(['1', '2', '3'])
    expect(entry.numbers).toEqual({ 18: null })
  })

  it('keeps stored values and drops keys the form no longer has', () => {
    const entry = completeEntry({ name: 'Piet', groups: { A: [2, 1], Z: [1] }, matches: { 1: { htA: 1, htB: 0, ftA: 2, ftB: 1, toto: 1 }, 99: { htA: 0, htB: 0, ftA: 0, ftB: 0, toto: 3 } }, numbers: { 18: 5, 19: 2 } }, sampleForm())
    expect(entry.name).toBe('Piet')
    expect(entry.groups).toEqual({ A: [2, 1, null, null] })
    expect(entry.matches['1']).toEqual({ htA: 1, htB: 0, ftA: 2, ftB: 1, toto: 1 })
    expect(entry.matches['99']).toBeUndefined()
    expect(entry.numbers).toEqual({ 18: 5 })
    expect(entry.standings).toEqual([null, null, null, null])
  })
})

describe('missingFields', () => {
  it('is empty for a complete entry', () => {
    expect(missingFields(filledEntry(), sampleForm())).toEqual([])
  })

  it('lists contact details, groups, finals, matches and extras', () => {
    const missing = missingFields(emptyEntry(sampleForm()), sampleForm())
    expect(missing).toContain('Naam')
    expect(missing).toContain('Email')
    expect(missing).toContain('Groep A: Team 1')
    expect(missing).toContain('halve finale 2: 1A')
    expect(missing).toContain('Wedstrijd 3: toto')
    expect(missing).toContain('Eindstand 1e')
    expect(missing).toContain('Topscorer')
    expect(missing).toContain('aantal gele kaarten')
    expect(missing).not.toContain('aantal rode kaarten')
    // 3rd/4th place are disabled, so only 1st and 2nd are required
    expect(missing).not.toContain('Eindstand 3e')
  })

  it('rejects an invalid email address and out-of-range group positions', () => {
    const entry = filledEntry()
    entry.email = 'geen-email'
    entry.groups.A = [1, 2, 3, 5]
    expect(missingFields(entry, sampleForm())).toEqual(['Email', 'Groep A: Team 4'])
  })
})

describe('points helpers', () => {
  it('only returns enabled number questions and strips "aantal"', () => {
    const types = numberTypes(sampleForm().points)
    expect(types.map((point) => point.typeId)).toEqual([18])
    expect(numberLabel(types[0]!)).toBe('gele kaarten')
  })

  it('always shows 1st and 2nd place, 3rd/4th only when enabled', () => {
    expect(standingPlaces(sampleForm().points).map((place) => place.label)).toEqual(['1e', '2e'])
  })
})

describe('splitName', () => {
  it.each([
    ['Jan Jansen', { firstName: 'Jan', middleName: '', lastName: 'Jansen' }],
    ['Rob van Betuw', { firstName: 'Rob', middleName: 'van', lastName: 'Betuw' }],
    ['Joey Lisa van der Egmond', { firstName: 'Joey Lisa', middleName: 'van der', lastName: 'Egmond' }],
    ['  Paddo  ', { firstName: 'Paddo', middleName: '', lastName: '' }],
    ['Josephine en Anouk', { firstName: 'Josephine en', middleName: '', lastName: 'Anouk' }],
  ])('%s', (input, expected) => {
    expect(splitName(input)).toEqual(expected)
  })
})

describe('dates and money', () => {
  it('formats dates like the paper form', () => {
    expect(shortDay('2021-06-11')).toBe('vr 11-6')
    expect(longDate('2021-07-11 00:00:00')).toBe('11 juli 2021')
    expect(weekdayDate('2021-06-07')).toBe('maandag 7 juni 2021')
    expect(shortDay(null)).toBe('')
  })

  it('formats euros with a comma', () => {
    expect(euro(10)).toBe('€ 10,00')
    expect(euro(0.1)).toBe('€ 0,10')
  })
})
