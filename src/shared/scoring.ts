/**
 * Payouts.
 *
 * Rulebook: the banker returns your stake and then pays the slot's odds on it.
 * A cardboard betting chip is worth 1 point and always comes back, win or
 * lose; poker chips wagered on top are lost when the bet misses.
 *
 * We drop the red/blue chip denominations — they exist so a human banker can
 * count — but keep the rule underneath: each of a player's two chips carries a
 * free 1-point stake that cannot be lost, so nobody is ever knocked out.
 */

import { CORRECT_GUESS_BONUS, FREE_CHIP_STAKE } from './mat.ts'
import type { Bet, PlayerDelta, Player, Slot } from './types.ts'

export function stakeOf(bet: Bet): number {
  return FREE_CHIP_STAKE + bet.wager
}

/** Total points a player has committed this round and could lose. */
export function wageredBy(bets: Bet[], playerId: string): number {
  return bets
    .filter((b) => b.playerId === playerId)
    .reduce((sum, b) => sum + b.wager, 0)
}

/** Points still available to wager, after what is already on the mat. */
export function bankAvailable(player: Player, bets: Bet[]): number {
  return player.score - wageredBy(bets, player.id)
}

export function scoreRound(
  players: Player[],
  slots: Slot[],
  bets: Bet[],
  winningSlotIndex: number,
): PlayerDelta[] {
  const winningSlot = slots[winningSlotIndex]
  const odds = winningSlot?.payout ?? 0
  const winningAuthors = new Set(winningSlot?.guess?.playerIds ?? [])

  return players.map((player) => {
    const own = bets.filter((b) => b.playerId === player.id)

    let winnings = 0
    let lost = 0
    for (const bet of own) {
      if (bet.slotIndex === winningSlotIndex) winnings += stakeOf(bet) * odds
      else lost += bet.wager
    }

    const bonus = winningAuthors.has(player.id) ? CORRECT_GUESS_BONUS : 0
    return {
      playerId: player.id,
      bonus,
      winnings,
      lost: lost > 0 ? -lost : 0, // avoid -0, which renders as "-0" on the board
      total: bonus + winnings - lost,
    }
  })
}

export function applyDeltas(players: Player[], deltas: PlayerDelta[]): Player[] {
  const byId = new Map(deltas.map((d) => [d.playerId, d]))
  return players.map((p) => ({
    ...p,
    score: Math.max(0, p.score + (byId.get(p.id)?.total ?? 0)),
  }))
}

/** Everyone tied at the top. More than one means a tiebreak round is needed. */
export function leaders(players: Player[]): string[] {
  if (players.length === 0) return []
  const top = Math.max(...players.map((p) => p.score))
  return players.filter((p) => p.score === top).map((p) => p.id)
}
