import type { AnswerFormat, ClientView, Player } from '../shared/types.ts'

export function formatAnswer(value: number, format: AnswerFormat = 'plain'): string {
  switch (format) {
    case 'year':
      return String(value)
    case 'money':
      return `$${value.toLocaleString()}`
    case 'percent':
      return `${value.toLocaleString()}%`
    default:
      return value.toLocaleString(undefined, { maximumFractionDigits: 4 })
  }
}

export const playerById = (view: ClientView, id: string): Player | undefined =>
  view.players.find((p) => p.id === id)

export const standings = (view: ClientView): Player[] =>
  [...view.players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))

/**
 * Seconds left on the current phase.
 *
 * `serverNow` is the caller's estimate of the server clock, measured when the
 * state arrived — a phone whose clock is minutes off still shows the right
 * countdown, and the server remains the only thing that actually ends a phase.
 */
export function secondsLeft(view: ClientView, serverNow: number): number | null {
  if (view.phaseEndsAt === null) return null
  return Math.max(0, Math.ceil((view.phaseEndsAt - serverNow) / 1000))
}

export const slotLabel = (index: number): string =>
  index === 0 ? 'All Answers Too High' : `Pays ${2 + Math.abs(index - 4)} to 1`
