import { STRINGS, type Locale, type Strings } from '../i18n/strings.ts'
import type { ClientView } from '../../shared/types.ts'

/**
 * What languages the board should speak, worked out from the room itself.
 *
 * The board has no toggle, and shouldn't: it is the shared surface, and a
 * control on it would mean one person deciding what everyone else reads.
 * Instead each phone reports its own language and the board follows —
 * an all-French table gets a French board with nothing configured, and a mixed
 * table gets both. Single-language rooms therefore stay completely uncluttered,
 * which is the whole point of doing it this way rather than always showing two.
 *
 * Ordered by how many players read each language, so the majority sits on top;
 * English breaks a tie for stability.
 */
export function boardLocales(view: ClientView): Locale[] {
  const counts = new Map<Locale, number>()
  for (const player of view.players) {
    if (!player.connected) continue
    counts.set(player.locale, (counts.get(player.locale) ?? 0) + 1)
  }
  if (counts.size === 0) return ['en']

  return [...counts.entries()]
    .sort(([aLocale, aCount], [bLocale, bCount]) => {
      if (bCount !== aCount) return bCount - aCount
      return aLocale === 'en' ? -1 : bLocale === 'en' ? 1 : 0
    })
    .map(([locale]) => locale)
}

/** The board's chrome follows the majority language rather than doubling up. */
export function boardStrings(view: ClientView): Strings {
  return STRINGS[boardLocales(view)[0] ?? 'en']
}

/**
 * Renders one piece of content per language, dropping duplicates.
 *
 * The dedupe matters: a question with no French translation yet falls back to
 * English, and showing the identical sentence twice would look like a bug
 * rather than a translation.
 */
export function inEachLocale<T>(locales: Locale[], render: (locale: Locale) => T): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const locale of locales) {
    const value = render(locale)
    const key = String(value)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}
