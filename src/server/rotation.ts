/**
 * Keeping questions fresh.
 *
 * Two layers, because they protect against different things:
 *
 *   1. Per-room — a room never repeats a question, tracked in game state and
 *      carried across rematches.
 *   2. Globally — a question drawn anywhere is retired for 24 hours, so
 *      starting a fresh room after a game does not serve up what everyone
 *      just heard.
 *
 * The global layer is written to disk. Holding it in memory would reset every
 * time the laptop server is relaunched, which is exactly when a new room gets
 * started — the case it exists to cover.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Question } from '../shared/types.ts'

export const RETIREMENT_MS = 24 * 60 * 60 * 1000

/** Question id -> epoch ms it was last drawn. */
export type LedgerEntries = Record<string, number>

export interface LedgerStore {
  read(): LedgerEntries
  write(entries: LedgerEntries): void
}

export function memoryStore(initial: LedgerEntries = {}): LedgerStore {
  let entries = { ...initial }
  return {
    read: () => ({ ...entries }),
    write: (next) => {
      entries = { ...next }
    },
  }
}

export function fileStore(path: string): LedgerStore {
  return {
    read() {
      try {
        const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
        // Tolerate a hand-edited or truncated file rather than refusing to start.
        return Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>).filter(
            (entry): entry is [string, number] => typeof entry[1] === 'number',
          ),
        )
      } catch {
        return {}
      }
    },
    write(entries) {
      try {
        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, JSON.stringify(entries, null, 2))
      } catch {
        // A read-only disk should not take the game down; rotation just
        // degrades to per-room uniqueness for this session.
      }
    },
  }
}

export class QuestionLedger {
  constructor(
    private store: LedgerStore,
    private now: () => number = () => Date.now(),
    private ttlMs: number = RETIREMENT_MS,
  ) {}

  /** Ids drawn recently enough to still be resting. Prunes as it goes. */
  retired(): Set<string> {
    const cutoff = this.now() - this.ttlMs
    const entries = this.store.read()
    const live: LedgerEntries = {}
    for (const [id, usedAt] of Object.entries(entries)) {
      if (usedAt > cutoff) live[id] = usedAt
    }
    if (Object.keys(live).length !== Object.keys(entries).length) this.store.write(live)
    return new Set(Object.keys(live))
  }

  clear(): void {
    this.store.write({})
  }

  retire(id: string): void {
    const cutoff = this.now() - this.ttlMs
    const entries = this.store.read()
    const live: LedgerEntries = {}
    for (const [key, usedAt] of Object.entries(entries)) {
      if (usedAt > cutoff) live[key] = usedAt
    }
    live[id] = this.now()
    this.store.write(live)
  }
}

export interface PickOptions {
  /** Questions this room has already asked. Never repeat these if avoidable. */
  roomUsedIds: readonly string[]
  /** Questions asked anywhere in the last 24h. */
  retiredIds: ReadonlySet<string>
  /**
   * Drop imperial-unit questions entirely. Unlike the other two constraints
   * this one is never relaxed — the host turned it on because somebody at the
   * table cannot answer them, so serving one anyway defeats the point.
   */
  excludeImperial?: boolean
  /**
   * Take the first eligible question in bank order instead of a random one —
   * for a host's own set, which they usually wrote in the order they want.
   * The same fallbacks apply, so a question played in the last 24h is still
   * skipped over rather than asked again.
   */
  sequential?: boolean
  random?: () => number
}

/**
 * Choose the next question, relaxing constraints only as far as needed.
 *
 * Room uniqueness outranks global retirement: hearing a question twice in one
 * sitting is far worse than hearing one that came up in a different room
 * yesterday. Only when a room has genuinely exhausted the bank do we repeat.
 */
export function pickQuestion(bank: readonly Question[], options: PickOptions): Question {
  if (bank.length === 0) throw new Error('Question bank is empty')

  const {
    roomUsedIds,
    retiredIds,
    excludeImperial = false,
    sequential = false,
    random = Math.random,
  } = options
  const used = new Set(roomUsedIds)

  const eligible = excludeImperial ? bank.filter((q) => q.units !== 'imperial') : bank
  if (eligible.length === 0) throw new Error('No questions left after filtering')

  const unusedHere = eligible.filter((q) => !used.has(q.id))
  const idealPool = unusedHere.filter((q) => !retiredIds.has(q.id))

  const pool = idealPool.length > 0 ? idealPool : unusedHere.length > 0 ? unusedHere : eligible

  return sequential ? pool[0]! : pool[Math.floor(random() * pool.length)]!
}
