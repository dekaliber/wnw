import { describe, expect, it } from 'vitest'
import { stillApplies } from './net.ts'
import type { ClientMessage, Phase } from '../shared/types.ts'

const NOW = 1_700_000_000_000

const held = (message: ClientMessage, phase: Phase | null, round: number | null, ageMs = 0) => ({
  message,
  at: NOW - ageMs,
  phase,
  round,
})

const at = (phase: Phase | null, round: number | null) => ({ phase, round })

describe('replaying taps made while the socket was down', () => {
  it('replays a bet into the round it was placed in', () => {
    const bet: ClientMessage = { t: 'bet', chip: 0, slotIndex: 3, wager: 1 }
    expect(stillApplies(held(bet, 'betting', 2), NOW, at('betting', 2))).toBe(true)
  })

  // The hazard this policy exists for. Every round has a question phase, so
  // the server cannot tell a stale guess from a fresh one — it would happily
  // record round 2's number against round 3's question.
  it('refuses a guess held into the next round, though the phase matches', () => {
    const guess: ClientMessage = { t: 'guess', value: 42 }
    expect(stillApplies(held(guess, 'question', 2), NOW, at('question', 3))).toBe(false)
  })

  it('refuses a bet once the phase has moved on', () => {
    const bet: ClientMessage = { t: 'bet', chip: 1, slotIndex: 0, wager: 1 }
    expect(stillApplies(held(bet, 'betting', 1), NOW, at('reveal', 1))).toBe(false)
  })

  // A replayed advance would skip a phase the table never saw.
  it('refuses an advance once the game advanced on its own', () => {
    const advance: ClientMessage = { t: 'advance' }
    expect(stillApplies(held(advance, 'betting', 1), NOW, at('reveal', 1))).toBe(false)
  })

  it('replays an advance the host tapped that never landed', () => {
    const advance: ClientMessage = { t: 'advance' }
    expect(stillApplies(held(advance, 'reveal', 1), NOW, at('reveal', 1))).toBe(true)
  })

  it('replays lobby settings while still in the lobby', () => {
    const config: ClientMessage = { t: 'config', config: { totalRounds: 5 } }
    expect(stillApplies(held(config, 'lobby', null), NOW, at('lobby', null))).toBe(true)
    expect(stillApplies(held(config, 'lobby', null), NOW, at('question', 1))).toBe(false)
  })

  // Naming yourself means the same thing whenever it arrives.
  it('replays context-free messages regardless of phase', () => {
    const rename: ClientMessage = { t: 'rename', name: 'Tai' }
    expect(stillApplies(held(rename, 'lobby', null), NOW, at('reveal', 4))).toBe(true)
    const locale: ClientMessage = { t: 'locale', locale: 'fr' }
    expect(stillApplies(held(locale, null, null), NOW, at('betting', 2))).toBe(true)
  })

  it('drops anything held too long, even where the context still matches', () => {
    const bet: ClientMessage = { t: 'bet', chip: 0, slotIndex: 2, wager: 1 }
    expect(stillApplies(held(bet, 'betting', 2, 60_000), NOW, at('betting', 2))).toBe(false)
  })

  it('drops even a context-free message once it is stale', () => {
    // Age is checked before anything else, deliberately: a reconnect that took
    // this long is not the outage this queue is for. `locale` is re-sent on
    // every reconnect by PlayerApp anyway, so nothing is actually lost.
    const rename: ClientMessage = { t: 'rename', name: 'Tai' }
    expect(stillApplies(held(rename, 'lobby', null, 60_000), NOW, at('lobby', null))).toBe(false)
  })
})
