import { describe, expect, it } from 'vitest'
import {
  QuestionLedger,
  RETIREMENT_MS,
  memoryStore,
  pickQuestion,
  type LedgerEntries,
} from './rotation.ts'
import type { Question } from '../shared/types.ts'

const bank: Question[] = Array.from({ length: 10 }, (_, i) => ({
  id: `q${i}`,
  text: `Question ${i}?`,
  answer: i,
}))

/** Deterministic "random": always takes the first of the pool. */
const first = () => 0

describe('picking a question', () => {
  it('avoids anything the room has already asked', () => {
    const roomUsedIds = ['q0', 'q1', 'q2']
    for (let i = 0; i < 50; i++) {
      const picked = pickQuestion(bank, { roomUsedIds, retiredIds: new Set() })
      expect(roomUsedIds).not.toContain(picked.id)
    }
  })

  it('avoids questions retired in the last 24h', () => {
    const retiredIds = new Set(['q0', 'q1', 'q2'])
    for (let i = 0; i < 50; i++) {
      const picked = pickQuestion(bank, { roomUsedIds: [], retiredIds })
      expect(retiredIds.has(picked.id)).toBe(false)
    }
  })

  it('prefers a retired question over repeating one in the same room', () => {
    // Everything is retired, so the only way to avoid a repeat is to reuse a
    // retired question — the lesser evil, since a repeat in one sitting is
    // much more noticeable than one carried over from yesterday.
    const retiredIds = new Set(bank.map((q) => q.id))
    const picked = pickQuestion(bank, { roomUsedIds: ['q0'], retiredIds, random: first })
    expect(picked.id).not.toBe('q0')
  })

  it('repeats only when the room has exhausted the bank', () => {
    const roomUsedIds = bank.map((q) => q.id)
    const picked = pickQuestion(bank, { roomUsedIds, retiredIds: new Set(), random: first })
    expect(picked.id).toBe('q0') // forced, but still returns a playable question
  })

  it('never returns undefined at the top of the random range', () => {
    // Math.random() can return values arbitrarily close to 1.
    const picked = pickQuestion(bank, {
      roomUsedIds: [],
      retiredIds: new Set(),
      random: () => 0.999999999,
    })
    expect(picked).toBeDefined()
    expect(picked.id).toBe('q9')
  })

  it('refuses an empty bank rather than returning nothing', () => {
    expect(() => pickQuestion([], { roomUsedIds: [], retiredIds: new Set() })).toThrow(/empty/)
  })
})

describe('the 24-hour ledger', () => {
  let clock = 1_000_000_000

  const ledgerWith = (entries: LedgerEntries = {}) =>
    new QuestionLedger(memoryStore(entries), () => clock)

  it('retires a question it has just seen', () => {
    const ledger = ledgerWith()
    ledger.retire('q3')
    expect(ledger.retired().has('q3')).toBe(true)
  })

  it('releases it again after 24 hours', () => {
    const ledger = ledgerWith()
    ledger.retire('q3')

    clock += RETIREMENT_MS - 1000
    expect(ledger.retired().has('q3')).toBe(true)

    clock += 2000
    expect(ledger.retired().has('q3')).toBe(false)
  })

  it('prunes expired entries rather than growing forever', () => {
    const store = memoryStore({ old: clock - RETIREMENT_MS * 2, recent: clock - 1000 })
    const ledger = new QuestionLedger(store, () => clock)
    expect([...ledger.retired()]).toEqual(['recent'])
    expect(Object.keys(store.read())).toEqual(['recent'])
  })

  it('survives a restart, which is the whole point', () => {
    // The same backing store stands in for the file on disk.
    const store = memoryStore()
    new QuestionLedger(store, () => clock).retire('q7')

    const afterRestart = new QuestionLedger(store, () => clock)
    expect(afterRestart.retired().has('q7')).toBe(true)
  })

  it('ignores a corrupted or hand-edited file', () => {
    const store = memoryStore({ good: clock, bad: 'yesterday' as unknown as number })
    const ledger = new QuestionLedger(store, () => clock)
    expect([...ledger.retired()]).toEqual(['good'])
  })
})

describe('rotation end to end', () => {
  it('gets through several rooms without repeating a question', () => {
    let clock = 1_000_000_000
    const ledger = new QuestionLedger(memoryStore(), () => clock)
    const seen: string[] = []

    // Three separate rooms of three questions each, back to back.
    for (let room = 0; room < 3; room++) {
      const roomUsedIds: string[] = []
      for (let round = 0; round < 3; round++) {
        const picked = pickQuestion(bank, { roomUsedIds, retiredIds: ledger.retired() })
        roomUsedIds.push(picked.id)
        ledger.retire(picked.id)
        seen.push(picked.id)
        clock += 60_000
      }
    }

    expect(new Set(seen).size).toBe(9) // nine questions, none repeated
  })

  it('starts reusing once the day rolls over', () => {
    let clock = 1_000_000_000
    const ledger = new QuestionLedger(memoryStore(), () => clock)
    for (const q of bank) ledger.retire(q.id)

    clock += RETIREMENT_MS + 1
    expect(ledger.retired().size).toBe(0)
    expect(pickQuestion(bank, { roomUsedIds: [], retiredIds: ledger.retired() })).toBeDefined()
  })
})
