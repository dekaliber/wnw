import { describe, expect, it } from 'vitest'
import {
  ALL_TOO_HIGH,
  buildMat,
  foldGuesses,
  isBettable,
  payoutForSlot,
  slotPositionsFor,
  winningSlotIndex,
} from './mat.ts'

/** Mirrors the printed mat, left to right. */
const PRINTED_PAYOUTS = [6, 5, 4, 3, 2, 3, 4, 5]

const guessesOf = (values: number[]): Record<string, number> =>
  Object.fromEntries(values.map((v, i) => [`p${i}`, v]))

/** The values sitting on the mat, keyed by position. */
const layout = (values: number[]): Record<number, number> => {
  const slots = buildMat(guessesOf(values))
  const out: Record<number, number> = {}
  for (const slot of slots) if (slot.guess) out[slot.index] = slot.guess.value
  return out
}

describe('mat payouts', () => {
  it('matches the printed board', () => {
    expect(PRINTED_PAYOUTS.map((_, i) => payoutForSlot(i))).toEqual(PRINTED_PAYOUTS)
  })
})

describe('sorting guesses onto the mat', () => {
  // These four cases are the diagrams printed in the rulebook.
  it('7 unique guesses fills every slot', () => {
    expect(layout([1989, 1992, 1995, 1998, 1999, 2001, 2004])).toEqual({
      1: 1989,
      2: 1992,
      3: 1995,
      4: 1998,
      5: 1999,
      6: 2001,
      7: 2004,
    })
  })

  it('6 unique guesses leaves the 2:1 centre open', () => {
    expect(layout([1989, 1992, 1995, 1999, 2001, 2004])).toEqual({
      1: 1989,
      2: 1992,
      3: 1995,
      5: 1999,
      6: 2001,
      7: 2004,
    })
  })

  it('5 unique guesses centres, middle guess on the 2:1', () => {
    expect(layout([1992, 1995, 1998, 1999, 2001])).toEqual({
      2: 1992,
      3: 1995,
      4: 1998,
      5: 1999,
      6: 2001,
    })
  })

  it('4 unique guesses centres and skips the 2:1', () => {
    expect(layout([1992, 1995, 1999, 2001])).toEqual({
      2: 1992,
      3: 1995,
      5: 1999,
      6: 2001,
    })
  })

  it('handles the small cases', () => {
    expect(layout([50])).toEqual({ 4: 50 })
    expect(layout([10, 20])).toEqual({ 3: 10, 5: 20 })
    expect(layout([10, 20, 30])).toEqual({ 3: 10, 4: 20, 5: 30 })
  })

  it('always centres, so an even count never touches the 2:1 slot', () => {
    for (let n = 1; n <= 7; n++) {
      const positions = slotPositionsFor(n)
      expect(positions).toHaveLength(n)
      expect(positions.includes(4)).toBe(n % 2 === 1)
      // Symmetric about the centre.
      const mirrored = positions.map((p) => 8 - p).sort((a, b) => a - b)
      expect(mirrored).toEqual([...positions].sort((a, b) => a - b))
    }
  })
})

describe('duplicate guesses', () => {
  it('shares one slot and credits both authors', () => {
    const slots = buildMat({ a: 1995, b: 1995, c: 1989, d: 2004 })
    const shared = slots.find((s) => s.guess?.value === 1995)
    expect(shared?.guess?.playerIds.sort()).toEqual(['a', 'b'])
    // Three unique values, so they centre on 3/4/5.
    expect(slots.filter((s) => s.guess).map((s) => s.index)).toEqual([3, 4, 5])
  })
})

describe('more than seven unique guesses', () => {
  it('merges the closest pair until seven cards remain', () => {
    const cards = foldGuesses(guessesOf([1, 2, 3, 100, 200, 300, 400, 500, 600]))
    expect(cards).toHaveLength(7)
    // 1,2,3 are the tightest cluster, so they fold together first.
    expect(cards[0]!.playerIds).toHaveLength(3)
    expect(cards[0]!.value).toBe(1)
    expect(cards[0]!.mergedValues).toEqual([1, 2, 3])
  })

  it('still fills exactly seven slots', () => {
    const slots = buildMat(guessesOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))
    expect(slots.filter((s) => s.guess)).toHaveLength(7)
  })
})

describe('closest without going over', () => {
  const slots = buildMat(guessesOf([1989, 1992, 1995, 1998, 1999, 2001, 2004]))

  it('picks the highest guess that did not overshoot', () => {
    // Rulebook example #1: answer 1991 -> "1989" wins because 1992 is too high.
    expect(winningSlotIndex(slots, 1991)).toBe(1)
  })

  it('counts an exact guess as a winner', () => {
    expect(winningSlotIndex(slots, 1998)).toBe(4)
  })

  it('pays All Answers Too High when everyone overshot', () => {
    // Rulebook example #2: answer 1985.
    expect(winningSlotIndex(slots, 1985)).toBe(ALL_TOO_HIGH)
  })

  it('picks the top slot when the answer is above every guess', () => {
    expect(winningSlotIndex(slots, 2020)).toBe(7)
  })
})

describe('bettable slots', () => {
  const slots = buildMat(guessesOf([10, 20, 30]))

  it('allows All Answers Too High even though it holds no card', () => {
    expect(isBettable(slots, ALL_TOO_HIGH)).toBe(true)
  })

  it('refuses empty guess slots', () => {
    expect(isBettable(slots, 1)).toBe(false)
    expect(isBettable(slots, 3)).toBe(true)
  })
})
