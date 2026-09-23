/**
 * The board's scoring playthrough, as data.
 *
 * By the time the board sees the reveal the server has already applied the
 * round's deltas, so `player.score` is the *new* total. Everything here works
 * backwards from that to the score each player walked in with, then lays the
 * round out as a flat list of beats — one player at a time. Most beats run on
 * a timer; a `pause` after each player holds until the host moves it on from
 * their phone, so the room sets the pace.
 *
 * Kept free of React and the DOM so the sequencing can be tested on its own.
 */

import { stakeOf } from '../../shared/scoring.ts'
import type { Bet, Player, PlayerDelta, Slot } from '../../shared/types.ts'

/**
 * One slot a player backed. Both chips on the same slot fold into a single
 * line — to the table that is one bet, just a bigger one.
 */
export interface BetLine {
  chips: (0 | 1)[]
  slotIndex: number
  /** Free chips plus raises: what the odds are paid on. */
  stake: number
  /** Total raised on top of the chips — the only part that can be lost. */
  wager: number
  odds: number
  won: boolean
  /** Paid out when won; the raise forfeited when lost. Always positive. */
  amount: number
}

export interface PlayerScoring {
  playerId: string
  before: number
  after: number
  bets: BetLine[]
  bonus: number
  total: number
}

export type Beat =
  | { kind: 'intro' }
  | { kind: 'enter'; player: number }
  | { kind: 'bet'; player: number; line: number }
  | { kind: 'resolve'; player: number; line: number }
  | { kind: 'bonus'; player: number }
  | { kind: 'total'; player: number }
  | { kind: 'fly'; player: number }
  | { kind: 'land'; player: number }
  /** Held until the host moves past this player (`round.tallied`); no timer. */
  | { kind: 'pause'; player: number }
  | { kind: 'reorder' }
  | { kind: 'done' }

/** How long each timed beat holds before the next. Tuned for a room reading a TV. */
export const BEAT_MS: Record<Exclude<Beat['kind'], 'pause'>, number> = {
  // Lets the answer land before anyone's sums start competing with it.
  intro: 1500,
  enter: 700,
  bet: 450,
  resolve: 1100,
  bonus: 1100,
  total: 1200,
  fly: 750,
  land: 450,
  reorder: 1100,
  done: 0,
}

export function scoringsFor(
  players: Player[],
  deltas: PlayerDelta[],
  slots: Slot[],
  bets: Bet[],
  winningSlotIndex: number,
): PlayerScoring[] {
  const scorings: PlayerScoring[] = []
  for (const delta of deltas) {
    const player = players.find((p) => p.id === delta.playerId)
    // Kicked since the reveal — nothing left on the board to update. Must
    // match `tallyLength`, which is how the host's phone counts the same list.
    if (!player) continue

    const lines: BetLine[] = []
    for (const bet of bets
      .filter((b) => b.playerId === player.id)
      .sort((a, b) => a.chip - b.chip)) {
      const won = bet.slotIndex === winningSlotIndex
      const odds = slots[bet.slotIndex]?.payout ?? 0
      const stake = stakeOf(bet)
      const amount = won ? stake * odds : bet.wager
      const same = lines.find((l) => l.slotIndex === bet.slotIndex)
      if (same) {
        same.chips.push(bet.chip)
        same.stake += stake
        same.wager += bet.wager
        same.amount += amount
      } else {
        lines.push({
          chips: [bet.chip],
          slotIndex: bet.slotIndex,
          stake,
          wager: bet.wager,
          odds,
          won,
          amount,
        })
      }
    }

    scorings.push({
      playerId: player.id,
      // A player can never wager more than they hold, so the server's clamp at
      // zero never engages and subtracting the delta is exact.
      before: player.score - delta.total,
      after: player.score,
      bets: lines,
      bonus: delta.bonus,
      total: delta.total,
    })
  }

  // Smallest result first, so the round builds towards its biggest winner.
  // Ties keep the strip's left-to-right order, which is easiest to follow.
  const strip = standingsBefore(players, scorings).map((p) => p.id)
  return scorings.sort(
    (a, b) => a.total - b.total || strip.indexOf(a.playerId) - strip.indexOf(b.playerId),
  )
}

export function buildTimeline(scorings: PlayerScoring[]): Beat[] {
  const beats: Beat[] = [{ kind: 'intro' }]
  scorings.forEach((s, player) => {
    beats.push({ kind: 'enter', player })
    // Lay every bet down first, then settle them one by one — the pause
    // between "here is what you backed" and "here is how it went" is the fun.
    s.bets.forEach((_, line) => beats.push({ kind: 'bet', player, line }))
    s.bets.forEach((_, line) => beats.push({ kind: 'resolve', player, line }))
    if (s.bonus > 0) beats.push({ kind: 'bonus', player })
    beats.push({ kind: 'total', player })
    // Nothing to carry down to the strip when the round was a wash.
    if (s.total !== 0) beats.push({ kind: 'fly', player })
    beats.push({ kind: 'land', player })
    // Time to digest — or to roast whoever just went all in on the wrong slot.
    beats.push({ kind: 'pause', player })
  })
  beats.push({ kind: 'reorder' }, { kind: 'done' })
  return beats
}

/** Everything the board needs to draw one moment of the playthrough. */
export interface PlaythroughFrame {
  beat: Beat
  /** The player on screen, or null once every player has been settled. */
  current: PlayerScoring | null
  betsShown: number
  betsResolved: number
  bonusShown: boolean
  totalShown: boolean
  flying: boolean
  /** Holding for the host to move on from their phone. */
  waiting: boolean
  /** Nobody left after this player, so moving on re-sorts the strip. */
  lastPlayer: boolean
  /** Players whose result has reached the strip. */
  landed: Set<string>
  reordered: boolean
  done: boolean
}

export function frameAt(scorings: PlayerScoring[], timeline: Beat[], step: number): PlaythroughFrame {
  const past = timeline.slice(0, step + 1)
  const beat = past[past.length - 1] ?? { kind: 'done' }
  const index = 'player' in beat ? beat.player : null
  const mine = past.filter((b) => 'player' in b && b.player === index)

  const landed = new Set<string>()
  for (const b of past) if (b.kind === 'land') landed.add(scorings[b.player]!.playerId)

  return {
    beat,
    current: index === null ? null : (scorings[index] ?? null),
    betsShown: mine.filter((b) => b.kind === 'bet').length,
    betsResolved: mine.filter((b) => b.kind === 'resolve').length,
    bonusShown: mine.some((b) => b.kind === 'bonus'),
    totalShown: mine.some((b) => b.kind === 'total'),
    flying: beat.kind === 'fly',
    waiting: beat.kind === 'pause',
    lastPlayer: index !== null && index === scorings.length - 1,
    landed,
    reordered: past.some((b) => b.kind === 'reorder'),
    done: beat.kind === 'done',
  }
}

/**
 * Where to start for a board that arrives mid-tally: just after the pause of
 * the last player the host has already moved past — which, once they are all
 * done, is the reorder into final standings.
 */
export function resumeStep(timeline: Beat[], tallied: number): number {
  if (tallied <= 0) return 0
  const pause = timeline.findIndex((b) => b.kind === 'pause' && b.player === tallied - 1)
  if (pause !== -1) return pause + 1
  const reorder = timeline.findIndex((b) => b.kind === 'reorder')
  return reorder === -1 ? 0 : reorder
}

/** Strip order before the round settles: by the scores everyone walked in with. */
export function standingsBefore(players: Player[], scorings: PlayerScoring[]): Player[] {
  const before = (p: Player) => scorings.find((s) => s.playerId === p.id)?.before ?? p.score
  return [...players].sort((a, b) => before(b) - before(a) || a.name.localeCompare(b.name))
}
