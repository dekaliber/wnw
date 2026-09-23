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

/** Everyone playing — the table, less a host who is only running the game. */
export const contestants = (view: ClientView): Player[] =>
  view.players.filter((p) => p.id !== view.nonPlayerId)

export const standings = (view: ClientView): Player[] =>
  contestants(view).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))

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

/**
 * How many players the board's scoring tally steps through: everyone scored
 * this round who is still in the room. Shared by the board, which plays it,
 * and the host's phone, which moves it on — so they never disagree about
 * which tap is the last.
 */
export function tallyLength(view: ClientView): number {
  const deltas = view.round?.result?.deltas ?? []
  return deltas.filter((d) => view.players.some((p) => p.id === d.playerId)).length
}

/**
 * Who the current round is waiting on: everyone connected, or — during sudden
 * death — only the tied leaders, since bystanders never guess in a tiebreak.
 */
export function expectedActors(view: ClientView): Player[] {
  const active = contestants(view).filter((p) => p.connected)
  if (view.round?.isTiebreak) return active.filter((p) => view.winnerIds.includes(p.id))
  return active
}

/** How many of them have acted in the current phase — guessed, or locked their bets. */
export function actedCount(view: ClientView): number {
  if (!view.round) return 0
  if (view.phase === 'question') return view.round.submitted.length
  if (view.phase === 'betting') return view.round.locked.length
  return 0
}
