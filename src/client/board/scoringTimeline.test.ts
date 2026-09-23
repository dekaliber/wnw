import { describe, expect, it } from 'vitest'
import { buildMat, winningSlotIndex } from '../../shared/mat.ts'
import { applyDeltas, scoreRound } from '../../shared/scoring.ts'
import type { Bet, Player } from '../../shared/types.ts'
import { buildTimeline, frameAt, scoringsFor, standingsBefore } from './scoringTimeline.ts'

const player = (id: string, score: number): Player => ({
  id,
  name: id,
  color: '#fff',
  score,
  connected: true,
  ready: false,
  locale: 'en',
})

/** Plays a round through the real scoring, as the server would before the reveal. */
function settle(before: Player[], guesses: Record<string, number>, bets: Bet[], answer: number) {
  const slots = buildMat(guesses)
  const winner = winningSlotIndex(slots, answer)
  const deltas = scoreRound(before, slots, bets, winner)
  const after = applyDeltas(before, deltas)
  return scoringsFor(after, deltas, slots, bets, winner)
}

describe('scoringsFor', () => {
  // Guesses 10 / 20 / 30 centre on slots 3, 4, 5 — so 20 sits on the 2:1.
  const guesses = { ann: 10, bob: 20, cat: 30 }
  const bets: Bet[] = [
    { playerId: 'ann', chip: 0, slotIndex: 4, wager: 2 }, // wins: (1+2) x 2
    { playerId: 'ann', chip: 1, slotIndex: 5, wager: 1 }, // loses the raise
    { playerId: 'cat', chip: 0, slotIndex: 3, wager: 0 }, // loses nothing
  ]
  const scorings = settle([player('ann', 5), player('bob', 5), player('cat', 5)], guesses, bets, 25)
  const of = (id: string) => scorings.find((s) => s.playerId === id)!

  it('recovers the score each player walked in with', () => {
    expect(scorings.map((s) => s.before)).toEqual([5, 5, 5])
    expect(of('ann').after).toBe(5 + 6 - 1)
    expect(of('bob').after).toBe(5 + 3)
  })

  it('breaks each bet out into stake, odds and result', () => {
    expect(of('ann').bets).toEqual([
      { chips: [0], slotIndex: 4, stake: 3, wager: 2, odds: 2, won: true, amount: 6 },
      { chips: [1], slotIndex: 5, stake: 2, wager: 1, odds: 3, won: false, amount: 1 },
    ])
    expect(of('cat').bets[0]).toMatchObject({ won: false, amount: 0 })
  })

  it('folds both chips on one slot into a single bet', () => {
    const stacked = settle(
      [player('ann', 5), player('bob', 5)],
      { ann: 10, bob: 20 },
      [
        { playerId: 'ann', chip: 0, slotIndex: 3, wager: 1 },
        { playerId: 'ann', chip: 1, slotIndex: 3, wager: 2 },
      ],
      15,
    )
    expect(stacked.find((s) => s.playerId === 'ann')!.bets).toEqual([
      { chips: [0, 1], slotIndex: 3, stake: 5, wager: 3, odds: 3, won: true, amount: 15 },
    ])
  })

  it('credits the bonus only to the author of the winning guess', () => {
    expect(of('bob').bonus).toBe(3)
    expect(of('ann').bonus).toBe(0)
  })

  it('saves the biggest result for last', () => {
    expect(scorings.map((s) => s.playerId)).toEqual(['cat', 'bob', 'ann'])
  })
})

describe('buildTimeline', () => {
  const scorings = settle(
    [player('ann', 4), player('bob', 0)],
    { ann: 10, bob: 20 },
    [{ playerId: 'ann', chip: 0, slotIndex: 5, wager: 1 }],
    15,
  )
  const timeline = buildTimeline(scorings)

  it('shows every bet before settling any of them', () => {
    expect(timeline.map((b) => b.kind)).toEqual([
      'intro',
      // bob: no bets, no bonus, nothing to fly
      'enter', 'total', 'land', 'pause',
      // ann: wrote the winner, lost her raise elsewhere
      'enter', 'bet', 'resolve', 'bonus', 'total', 'fly', 'land', 'pause',
      'reorder', 'done',
    ])
  })

  it('holds the strip at old scores until each result lands', () => {
    const flyIndex = timeline.findIndex((b) => b.kind === 'fly')
    const midFlight = frameAt(scorings, timeline, flyIndex)
    expect(midFlight.flying).toBe(true)
    expect(midFlight.landed.has('ann')).toBe(false)
    expect(frameAt(scorings, timeline, flyIndex + 1).landed.has('ann')).toBe(true)
  })

  it('holds after every player, with their full working still on screen', () => {
    const pauses = timeline.flatMap((b, i) => (b.kind === 'pause' ? [i] : []))
    expect(pauses).toHaveLength(2)

    const bob = frameAt(scorings, timeline, pauses[0]!)
    expect(bob).toMatchObject({ waiting: true, lastPlayer: false, totalShown: true })
    expect(bob.current?.playerId).toBe('bob')

    const ann = frameAt(scorings, timeline, pauses[1]!)
    expect(ann).toMatchObject({ waiting: true, lastPlayer: true, betsResolved: 1, bonusShown: true })
    expect(ann.reordered).toBe(false)
  })

  it('reveals one player at a time and lets go at the end', () => {
    const annEnter = timeline.findIndex((b) => b.kind === 'enter' && b.player === 1)
    const frame = frameAt(scorings, timeline, annEnter + 1)
    expect(frame.current?.playerId).toBe('ann')
    expect(frame.betsShown).toBe(1)
    expect(frame.betsResolved).toBe(0)

    const end = frameAt(scorings, timeline, timeline.length - 1)
    expect(end.current).toBeNull()
    expect(end.reordered && end.done).toBe(true)
  })
})

describe('standingsBefore', () => {
  it('orders the strip by pre-round scores, not the settled ones', () => {
    const scorings = settle(
      [player('ann', 1), player('bob', 9)],
      { ann: 10, bob: 20 },
      [{ playerId: 'ann', chip: 0, slotIndex: 3, wager: 1 }],
      15,
    )
    const settled = [player('ann', 1 + 2 * 3 + 3), player('bob', 9)]
    expect(standingsBefore(settled, scorings).map((p) => p.id)).toEqual(['bob', 'ann'])
  })
})
