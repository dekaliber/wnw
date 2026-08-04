import { describe, expect, it } from 'vitest'
import { buildMat, winningSlotIndex } from './mat.ts'
import { applyDeltas, bankAvailable, leaders, scoreRound, stakeOf } from './scoring.ts'
import type { Bet, Player } from './types.ts'

const player = (id: string, score = 0): Player => ({
  id,
  name: id,
  color: '#fff',
  score,
  connected: true,
  ready: false,
})

const bet = (playerId: string, chip: 0 | 1, slotIndex: number, wager = 0): Bet => ({
  playerId,
  chip,
  slotIndex,
  wager,
})

describe('the rulebook payout table', () => {
  // "The Banker gives you back your bet, plus the payout of the slot."
  const cases = [
    { stake: 1, odds: 2, payout: 2 },
    { stake: 2, odds: 3, payout: 6 },
    { stake: 2, odds: 4, payout: 8 },
    { stake: 8, odds: 5, payout: 40 },
    { stake: 2, odds: 6, payout: 12 },
  ]

  it.each(cases)('a $stake-point bet at $odds:1 pays $payout', ({ stake, odds, payout }) => {
    expect(stake * odds).toBe(payout)
  })

  it('stakes a free chip plus the wagered points', () => {
    expect(stakeOf(bet('a', 0, 4, 0))).toBe(1)
    expect(stakeOf(bet('a', 0, 4, 7))).toBe(8)
  })
})

describe('scoring a round', () => {
  const players = [player('a', 10), player('b', 10), player('c', 10)]
  // a guessed 1995, b guessed 1998, c guessed 2004.
  const slots = buildMat({ a: 1995, b: 1998, c: 2004 })
  const winner = winningSlotIndex(slots, 1999) // b's 1998 takes it, on the 2:1 centre

  it('puts the winning guess on the 2:1 centre', () => {
    expect(winner).toBe(4)
    expect(slots[4]!.payout).toBe(2)
  })

  it('pays the odds on stake and returns the wager', () => {
    // b bets both chips on the winner, wagering 3 points on one of them.
    const deltas = scoreRound(players, slots, [bet('b', 0, 4, 3), bet('b', 1, 4, 0)], winner)
    const b = deltas.find((d) => d.playerId === 'b')!
    // chip 0: stake 4 x 2 = 8. chip 1: stake 1 x 2 = 2. Plus the 3-point bonus.
    expect(b.winnings).toBe(10)
    expect(b.bonus).toBe(3)
    expect(b.lost).toBe(0)
    expect(b.total).toBe(13)
  })

  it('loses wagered points but never the free chip', () => {
    const deltas = scoreRound(players, slots, [bet('a', 0, 3, 5)], winner)
    const a = deltas.find((d) => d.playerId === 'a')!
    expect(a.lost).toBe(-5)
    expect(a.total).toBe(-5)
  })

  it('awards the bonus for a correct guess even with no winning bet', () => {
    const deltas = scoreRound(players, slots, [bet('b', 0, 7, 0)], winner)
    const b = deltas.find((d) => d.playerId === 'b')!
    expect(b.bonus).toBe(3)
    expect(b.winnings).toBe(0)
    expect(b.total).toBe(3)
  })

  it('pays no guess bonus when All Answers Too High wins', () => {
    const tooHigh = winningSlotIndex(slots, 1990)
    expect(tooHigh).toBe(0)
    const deltas = scoreRound(players, slots, [bet('a', 0, 0, 2)], tooHigh)
    const a = deltas.find((d) => d.playerId === 'a')!
    expect(a.bonus).toBe(0)
    expect(a.winnings).toBe(3 * 6) // stake 3 at 6:1
    expect(deltas.every((d) => d.bonus === 0)).toBe(true)
  })

  it('credits every author of a shared guess', () => {
    const shared = buildMat({ a: 1998, b: 1998, c: 2004 })
    const win = winningSlotIndex(shared, 1999)
    const deltas = scoreRound(players, shared, [], win)
    expect(deltas.find((d) => d.playerId === 'a')!.bonus).toBe(3)
    expect(deltas.find((d) => d.playerId === 'b')!.bonus).toBe(3)
    expect(deltas.find((d) => d.playerId === 'c')!.bonus).toBe(0)
  })
})

describe('bank management', () => {
  it('counts points already committed this round', () => {
    const p = player('a', 10)
    expect(bankAvailable(p, [bet('a', 0, 4, 4)])).toBe(6)
    expect(bankAvailable(p, [bet('a', 0, 4, 4), bet('a', 1, 3, 6)])).toBe(0)
  })
})

describe('score application', () => {
  it('never drops a player below zero', () => {
    const players = [player('a', 2)]
    const updated = applyDeltas(players, [
      { playerId: 'a', bonus: 0, winnings: 0, lost: -5, total: -5 },
    ])
    expect(updated[0]!.score).toBe(0)
  })

  it('reports every player tied at the top', () => {
    expect(leaders([player('a', 9), player('b', 9), player('c', 3)]).sort()).toEqual(['a', 'b'])
    expect(leaders([player('a', 9), player('b', 3)])).toEqual(['a'])
  })
})
