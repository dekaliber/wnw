import { QUIPS } from '../../shared/quips.ts'
import type { ClientQuestion } from '../../shared/types.ts'
import type { Locale } from './strings.ts'

/**
 * Picking the right language for server-supplied content.
 *
 * Everything falls back to English rather than showing a blank, so a question
 * or quip added without a translation degrades to something readable instead
 * of vanishing mid-round.
 */

export function questionText(question: ClientQuestion, locale: Locale): string {
  return (locale === 'fr' && question.textFr) || question.text
}

export function questionNote(question: ClientQuestion, locale: Locale): string | undefined {
  if (locale === 'fr' && question.noteFr) return question.noteFr
  return question.note
}

export function localisedQuip(id: string | null | undefined, locale: Locale): string | null {
  if (!id) return null
  const quip = QUIPS.find((q) => q.id === id)
  if (!quip) return null
  return (locale === 'fr' && quip.textFr) || quip.text
}
