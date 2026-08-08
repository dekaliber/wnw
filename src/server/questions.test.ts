import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Question } from '../shared/types.ts'

const bank: Question[] = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../questions/questions.json', import.meta.url)), 'utf8'),
)

describe('the question bank', () => {
  it('has a unique id for every question', () => {
    const ids = bank.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has a real number for every answer', () => {
    const bad = bank.filter((q) => typeof q.answer !== 'number' || !Number.isFinite(q.answer))
    expect(bad.map((q) => q.id)).toEqual([])
  })

  it('has no negative answers, which the keypad cannot enter', () => {
    // There is no minus key: digits, a decimal point and backspace only.
    expect(bank.filter((q) => q.answer < 0).map((q) => q.id)).toEqual([])
  })
})

describe('French coverage', () => {
  it('translates every question', () => {
    expect(bank.filter((q) => !q.textFr).map((q) => q.id)).toEqual([])
  })

  it('translates every note', () => {
    // A note left in English would surface on the reveal beside French text.
    expect(bank.filter((q) => q.note && !q.noteFr).map((q) => q.id)).toEqual([])
  })

  it('never leaves a note translated but its question not', () => {
    expect(bank.filter((q) => q.noteFr && !q.textFr).map((q) => q.id)).toEqual([])
  })

  it('does not pass the English off as the French', () => {
    expect(bank.filter((q) => q.textFr === q.text).map((q) => q.id)).toEqual([])
  })

  it('keeps a question mark on every French question', () => {
    // French uses a space before "?"; the check is that the sentence is still
    // a question after translation, not that the spacing is exact.
    expect(bank.filter((q) => !q.textFr!.includes('?')).map((q) => q.id)).toEqual([])
  })
})

describe('imperial tagging', () => {
  const imperial = bank.filter((q) => q.units === 'imperial')

  it('tags a substantial but not overwhelming share', () => {
    expect(imperial.length).toBe(57)
    expect(bank.length - imperial.length).toBeGreaterThan(200)
  })

  it('leaves enough questions for a full game with them excluded', () => {
    // Seven rounds, plus a tiebreak or two, from the metric-safe pool.
    expect(bank.length - imperial.length).toBeGreaterThanOrEqual(20)
  })

  it('does not tag questions whose answer is unit-free', () => {
    // A ratio, the Celsius/Fahrenheit crossing, and "foot" the body part.
    for (const id of ['n223', 's17', 'n078']) {
      expect(bank.find((q) => q.id === id)?.units, id).toBeUndefined()
    }
  })

  it('tags the ones a metric speaker genuinely cannot answer', () => {
    for (const id of ['b01', 'g04', 'n134', 'm13']) {
      expect(bank.find((q) => q.id === id)?.units, id).toBe('imperial')
    }
  })
})
