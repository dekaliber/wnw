import { describe, expect, it } from 'vitest'
import { boardLocales, boardStrings, inEachLocale } from './useBoardLocales.ts'
import type { ClientView, Locale, Player } from '../../shared/types.ts'

const player = (id: string, locale: Locale, connected = true): Player => ({
  id,
  name: id,
  color: '#fff',
  score: 0,
  connected,
  ready: false,
  locale,
})

const view = (players: Player[]) => ({ players }) as unknown as ClientView

describe('what language the board speaks', () => {
  it('stays single-language when everyone agrees', () => {
    expect(boardLocales(view([player('a', 'en'), player('b', 'en')]))).toEqual(['en'])
  })

  it('follows an all-French table without anyone configuring it', () => {
    // The point of deriving this from the room: a French table gets a French
    // board, not an English one with a French option buried somewhere.
    expect(boardLocales(view([player('a', 'fr'), player('b', 'fr')]))).toEqual(['fr'])
  })

  it('shows both once the table is mixed', () => {
    expect(boardLocales(view([player('a', 'en'), player('b', 'fr')]))).toEqual(['en', 'fr'])
  })

  it('puts the majority language first', () => {
    const mostlyFrench = view([player('a', 'fr'), player('b', 'fr'), player('c', 'en')])
    expect(boardLocales(mostlyFrench)).toEqual(['fr', 'en'])
    expect(boardStrings(mostlyFrench).boardAnswer).toBe('Réponse')
  })

  it('ignores players who have dropped', () => {
    // A disconnected French player should not force the board bilingual for
    // the English speakers still in the room.
    const view_ = view([player('a', 'en'), player('b', 'fr', false)])
    expect(boardLocales(view_)).toEqual(['en'])
  })

  it('falls back to English with nobody connected', () => {
    expect(boardLocales(view([]))).toEqual(['en'])
  })
})

describe('rendering one thing per language', () => {
  it('drops the duplicate when a translation is missing', () => {
    // Untranslated content falls back to English, so both locales produce the
    // same string — showing it twice would read as a bug, not a translation.
    const rendered = inEachLocale(['en', 'fr'], () => 'Same in both')
    expect(rendered).toEqual(['Same in both'])
  })

  it('keeps both when they genuinely differ', () => {
    const rendered = inEachLocale(['en', 'fr'], (l) => (l === 'fr' ? 'Réponse' : 'Answer'))
    expect(rendered).toEqual(['Answer', 'Réponse'])
  })
})
