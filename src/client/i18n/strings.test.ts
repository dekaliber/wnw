import { describe, expect, it } from 'vitest'
import { LOCALES, STRINGS } from './strings.ts'
import { QUIPS } from '../../shared/quips.ts'

describe('the string catalogue', () => {
  it('has the same keys in every language', () => {
    const en = Object.keys(STRINGS.en).sort()
    for (const locale of LOCALES) {
      expect(Object.keys(STRINGS[locale]).sort(), locale).toEqual(en)
    }
  })

  it('has no English left in the French copy', () => {
    // Cheap smell test: these were all missed at least once while translating.
    const suspicious = /\b(Waiting|Ready|Guess|Chips|Answer|Restart|Room)\b/
    for (const [key, value] of Object.entries(STRINGS.fr)) {
      if (typeof value === 'string') {
        expect(suspicious.test(value), `fr.${key}: ${value}`).toBe(false)
      }
    }
  })

  it('keeps every interpolated value reachable in French', () => {
    // A translated function that drops its argument silently loses the number.
    expect(STRINGS.fr.needPlayers(4)).toContain('4')
    expect(STRINGS.fr.startQuestions(7)).toContain('7')
    expect(STRINGS.fr.inWaitingForRest(2, 5)).toContain('2')
    expect(STRINGS.fr.inWaitingForRest(2, 5)).toContain('5')
    expect(STRINGS.fr.lockedTapToChange(1, 3)).toContain('1')
    expect(STRINGS.fr.winsAt('1 969', 4)).toContain('1 969')
    expect(STRINGS.fr.takesIt('Ruby')).toContain('Ruby')
    expect(STRINGS.fr.roomEnded('ABCD')).toContain('ABCD')
    expect(STRINGS.fr.restartBodyMid(3)).toContain('3')
  })

  it('has all five rules cards in both languages', () => {
    expect(STRINGS.en.rules).toHaveLength(5)
    expect(STRINGS.fr.rules).toHaveLength(5)
    for (const card of STRINGS.fr.rules) {
      expect(card.step.length).toBeGreaterThan(0)
      expect(card.title.length).toBeGreaterThan(0)
      expect(card.body.length).toBeGreaterThan(0)
    }
  })
})

describe('quip translations', () => {
  it('translates every single quip', () => {
    const untranslated = QUIPS.filter((q) => !q.textFr).map((q) => q.id)
    expect(untranslated).toEqual([])
  })

  it('does not reuse the English text as the French one', () => {
    const lazy = QUIPS.filter((q) => q.textFr === q.text).map((q) => q.id)
    expect(lazy).toEqual([])
  })
})
