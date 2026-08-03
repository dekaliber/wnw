/**
 * The betting mat.
 *
 * The physical board has eight fixed positions. Payout is a property of the
 * *position*, never of the guess sitting in it:
 *
 *   0: All Answers Too High   6:1
 *   1                         5:1
 *   2                         4:1
 *   3                         3:1
 *   4  (centre)               2:1
 *   5                         3:1
 *   6                         4:1
 *   7                         5:1
 *
 * Guesses sort ascending across positions 1..7 and are centred on the mat.
 * With an even number of unique guesses the 2:1 centre is left open. Both
 * rules collapse into `payout = 2 + distance from centre`, with All-Answers-
 * Too-High sitting one step past the edge at 6:1.
 */

import type { Guess, Slot } from './types.ts'

export const ALL_TOO_HIGH = 0
export const GUESS_SLOTS = 7
export const CENTRE = 4
export const FIRST_GUESS_SLOT = 1
export const LAST_GUESS_SLOT = 7

/** Points awarded to each author of a guess sitting in the winning slot. */
export const CORRECT_GUESS_BONUS = 3

/** Every player gets two betting chips, and a chip is never lost. */
export const CHIPS_PER_PLAYER = 2
export const FREE_CHIP_STAKE = 1

export function payoutForSlot(index: number): number {
  if (index === ALL_TOO_HIGH) return 6
  return 2 + Math.abs(index - CENTRE)
}

/**
 * Which mat positions hold cards, given a number of unique guesses.
 *
 * Odd counts centre directly. Even counts centre as if there were one more
 * guess, then drop the 2:1 centre — which is what leaves it open.
 */
export function slotPositionsFor(uniqueCount: number): number[] {
  if (uniqueCount <= 0) return []
  const n = Math.min(uniqueCount, GUESS_SLOTS)
  const span = n % 2 === 0 ? n + 1 : n
  const start = CENTRE - (span - 1) / 2
  const positions: number[] = []
  for (let i = 0; i < span; i++) {
    const pos = start + i
    if (n % 2 === 0 && pos === CENTRE) continue // the open 2:1 slot
    positions.push(pos)
  }
  return positions
}

/**
 * Fold a raw map of player guesses into mat cards.
 *
 * Identical guesses share a slot (rulebook). If more than seven distinct
 * values survive that — only reachable with eight or more players guessing
 * individually — the closest neighbouring pair is merged repeatedly until
 * seven remain. A merged card sorts and resolves on its lowest value, which
 * keeps "closest without going over" honest.
 */
export function foldGuesses(guesses: Record<string, number>): Guess[] {
  const byValue = new Map<number, string[]>()
  for (const [playerId, value] of Object.entries(guesses)) {
    const authors = byValue.get(value)
    if (authors) authors.push(playerId)
    else byValue.set(value, [playerId])
  }

  let cards: Guess[] = [...byValue.entries()]
    .map(([value, playerIds]) => ({ value, playerIds }))
    .sort((a, b) => a.value - b.value)

  while (cards.length > GUESS_SLOTS) {
    let bestIndex = 0
    let bestGap = Infinity
    for (let i = 0; i < cards.length - 1; i++) {
      const gap = cards[i + 1]!.value - cards[i]!.value
      if (gap < bestGap) {
        bestGap = gap
        bestIndex = i
      }
    }
    const low = cards[bestIndex]!
    const high = cards[bestIndex + 1]!
    const merged: Guess = {
      value: low.value,
      playerIds: [...low.playerIds, ...high.playerIds],
      mergedValues: [
        ...(low.mergedValues ?? [low.value]),
        ...(high.mergedValues ?? [high.value]),
      ],
    }
    cards = [...cards.slice(0, bestIndex), merged, ...cards.slice(bestIndex + 2)]
  }

  return cards
}

/** Build the full eight-slot mat for a set of guesses. */
export function buildMat(guesses: Record<string, number>): Slot[] {
  const cards = foldGuesses(guesses)
  const positions = slotPositionsFor(cards.length)

  const slots: Slot[] = []
  for (let index = 0; index <= LAST_GUESS_SLOT; index++) {
    slots.push({ index, payout: payoutForSlot(index), guess: null })
  }
  positions.forEach((pos, i) => {
    slots[pos]!.guess = cards[i]!
  })
  return slots
}

/**
 * Closest without going over. Returns the mat position that pays out, which is
 * ALL_TOO_HIGH when every guess overshot.
 */
export function winningSlotIndex(slots: Slot[], answer: number): number {
  let winner = ALL_TOO_HIGH
  let best = -Infinity
  for (const slot of slots) {
    if (slot.index === ALL_TOO_HIGH || !slot.guess) continue
    const value = slot.guess.value
    if (value <= answer && value > best) {
      best = value
      winner = slot.index
    }
  }
  return winner
}

/** A slot can be bet on only if it holds a guess; All-Too-High is always open. */
export function isBettable(slots: Slot[], index: number): boolean {
  if (index === ALL_TOO_HIGH) return true
  return Boolean(slots[index]?.guess)
}
