import { beforeEach, describe, expect, it } from 'vitest'
import {
  createGame,
  effectiveHostId,
  everyoneReady,
  reduce,
  type Action,
  type EngineDeps,
} from './engine.ts'
import { viewFor } from './view.ts'
import { QUIPS, quipText } from './quips.ts'
import type { ClientMessage, GameState, Question } from './types.ts'

let clock = 1_000_000

const bank: Question[] = Array.from({ length: 30 }, (_, i) => ({
  id: `q${i}`,
  text: `Question ${i}?`,
  answer: 100 + i,
}))

const deps: EngineDeps = {
  now: () => clock,
  drawQuestion: (used) => bank.find((q) => !used.includes(q.id))!,
}

/** Applies actions in sequence, throwing on the first rejection. */
function run(state: GameState, actions: Action[]): GameState {
  let next = state
  for (const action of actions) {
    const result = reduce(next, action, deps)
    if (result.error) throw new Error(`${JSON.stringify(action)} -> ${result.error}`)
    next = result.state
  }
  return next
}

const say = (playerId: string, message: ClientMessage): Action => ({
  type: 'message',
  playerId,
  message,
})

/** Players seated, nobody ready. Used by the tests about the ready gate. */
function rawLobby(names: string[]): GameState {
  return run(
    createGame('ABCD'),
    names.map((n) => ({ type: 'addPlayer', playerId: n, name: n }) as Action),
  )
}

/**
 * The common case: everyone but the host has readied up, so `start` works.
 * The first name is the host, who never marks themselves ready.
 */
function lobbyWith(names: string[]): GameState {
  return run(
    rawLobby(names),
    names.slice(1).map((n) => say(n, { t: 'ready', ready: true })),
  )
}

beforeEach(() => {
  clock = 1_000_000
})

describe('lobby', () => {
  it('makes the first player host and assigns distinct colours', () => {
    const state = lobbyWith(['ana', 'ben', 'cy'])
    expect(state.hostId).toBe('ana')
    expect(new Set(state.players.map((p) => p.color)).size).toBe(3)
  })

  it('disambiguates duplicate names', () => {
    const state = run(createGame('ABCD'), [
      { type: 'addPlayer', playerId: '1', name: 'Sam' },
      { type: 'addPlayer', playerId: '2', name: 'Sam' },
    ])
    expect(state.players.map((p) => p.name)).toEqual(['Sam', 'Sam 2'])
  })

  it('refuses to start without enough players', () => {
    const state = lobbyWith(['ana'])
    expect(reduce(state, say('ana', { t: 'start' }), deps).error).toMatch(/at least/)
  })

  it('will not start until every other player is ready', () => {
    const state = rawLobby(['ana', 'ben', 'cy'])
    expect(reduce(state, say('ana', { t: 'start' }), deps).error).toMatch(/ready/)

    const partly = run(state, [say('ben', { t: 'ready', ready: true })])
    expect(reduce(partly, say('ana', { t: 'start' }), deps).error).toMatch(/ready/)

    const all = run(partly, [say('cy', { t: 'ready', ready: true })])
    expect(everyoneReady(all.players, all.hostId)).toBe(true)
    expect(reduce(all, say('ana', { t: 'start' }), deps).error).toBeUndefined()
  })

  it('does not require the host to mark themselves ready', () => {
    const state = run(rawLobby(['ana', 'ben']), [say('ben', { t: 'ready', ready: true })])
    expect(state.players.find((p) => p.id === 'ana')!.ready).toBe(false)
    expect(reduce(state, say('ana', { t: 'start' }), deps).error).toBeUndefined()
  })

  it('lets a player take their ready back', () => {
    const state = run(rawLobby(['ana', 'ben']), [
      say('ben', { t: 'ready', ready: true }),
      say('ben', { t: 'ready', ready: false }),
    ])
    expect(reduce(state, say('ana', { t: 'start' }), deps).error).toMatch(/ready/)
  })

  it('is not held hostage by a player who has dropped', () => {
    const state = run(rawLobby(['ana', 'ben', 'cy']), [
      say('ben', { t: 'ready', ready: true }),
      { type: 'disconnect', playerId: 'cy' }, // never readied up
    ])
    expect(reduce(state, say('ana', { t: 'start' }), deps).error).toBeUndefined()
  })

  it('clears ready when the game starts and again on a rematch', () => {
    let state = run(rawLobby(['ana', 'ben']), [
      say('ben', { t: 'ready', ready: true }),
      say('ana', { t: 'start' }),
    ])
    expect(state.players.every((p) => !p.ready)).toBe(true)

    state = run(state, [say('ana', { t: 'rematch' })])
    expect(state.players.every((p) => !p.ready)).toBe(true)
    expect(reduce(state, say('ana', { t: 'start' }), deps).error).toMatch(/ready/)
  })

  it('only lets the host start', () => {
    const state = lobbyWith(['ana', 'ben'])
    expect(reduce(state, say('ben', { t: 'start' }), deps).error).toMatch(/host/)
  })

  it('lets someone else drive while the host is away, then hands it back', () => {
    // A host whose phone sleeps must not lose the role permanently — otherwise
    // the table is stuck behind whoever happened to inherit it.
    const away = run(lobbyWith(['ana', 'ben', 'cy']), [{ type: 'disconnect', playerId: 'ana' }])
    expect(away.hostId).toBe('ana') // ownership never moved
    expect(effectiveHostId(away)).toBe('ben') // but the game can still advance
    expect(reduce(away, say('ben', { t: 'start' }), deps).error).toBeUndefined()

    const back = run(away, [{ type: 'reconnect', playerId: 'ana' }])
    expect(effectiveHostId(back)).toBe('ana')
    expect(reduce(back, say('ben', { t: 'start' }), deps).error).toMatch(/host/)
  })

  it('tells clients who can actually drive the game', () => {
    const away = run(lobbyWith(['ana', 'ben']), [{ type: 'disconnect', playerId: 'ana' }])
    expect(viewFor(away, 'ben', clock).hostId).toBe('ben')
  })
})

describe('the question phase', () => {
  it('does not advance on its own just because everyone has guessed', () => {
    // The fix for the sleeping-phone edge case: quorum alone must never end
    // the phase, or a phone that reconnects a beat too late gets skipped the
    // instant everyone else who is currently connected has gone.
    const state = run(lobbyWith(['ana', 'ben']), [
      say('ana', { t: 'start' }),
      say('ana', { t: 'guess', value: 90 }),
      say('ben', { t: 'guess', value: 110 }),
    ])
    expect(state.phase).toBe('question')
    expect(Object.keys(state.round!.guesses)).toEqual(['ana', 'ben'])
  })

  it('lets the host move things along once they are satisfied', () => {
    const state = run(lobbyWith(['ana', 'ben']), [
      say('ana', { t: 'start' }),
      say('ana', { t: 'guess', value: 90 }),
      say('ben', { t: 'guess', value: 110 }),
      say('ana', { t: 'advance' }),
    ])
    expect(state.phase).toBe('betting')
    expect(state.round!.slots.filter((s) => s.guess)).toHaveLength(2)
  })

  it('advances on timeout with whatever came in', () => {
    const state = run(lobbyWith(['ana', 'ben']), [
      say('ana', { t: 'start' }),
      say('ana', { t: 'guess', value: 90 }),
      { type: 'timeout' },
    ])
    expect(state.phase).toBe('betting')
    expect(state.round!.slots.filter((s) => s.guess)).toHaveLength(1)
  })

  it('does not skip ahead just because a non-responder disconnected', () => {
    // This is the exact scenario the fix targets: a player who dropped (or
    // whose phone is merely asleep) must not make the phase end early for
    // everyone still connected and waiting.
    const state = run(lobbyWith(['ana', 'ben', 'cy']), [
      say('ana', { t: 'start' }),
      say('ana', { t: 'guess', value: 90 }),
      say('ben', { t: 'guess', value: 110 }),
      { type: 'disconnect', playerId: 'cy' },
    ])
    expect(state.phase).toBe('question')
  })

  it('sets a deadline only when timers are on', () => {
    const timed = run(lobbyWith(['ana', 'ben']), [say('ana', { t: 'start' })])
    expect(timed.phaseEndsAt).toBe(clock + 45_000)

    const untimed = run(lobbyWith(['ana', 'ben']), [
      say('ana', { t: 'config', config: { timersEnabled: false } }),
      say('ana', { t: 'start' }),
    ])
    expect(untimed.phaseEndsAt).toBeNull()
  })
})

describe('the betting phase', () => {
  const betting = () =>
    run(lobbyWith(['ana', 'ben', 'cy']), [
      say('ana', { t: 'start' }),
      say('ana', { t: 'guess', value: 50 }), // slot 3
      say('ben', { t: 'guess', value: 100 }), // slot 4 -- the answer is 100
      say('cy', { t: 'guess', value: 150 }), // slot 5
      // Guessing never advances on its own now, so the host moves it along.
      say('ana', { t: 'advance' }),
    ])

  it('refuses bets on empty slots', () => {
    expect(reduce(betting(), say('ana', { t: 'bet', chip: 0, slotIndex: 1, wager: 0 }), deps).error)
      .toMatch(/empty/)
  })

  it('always allows All Answers Too High', () => {
    const state = run(betting(), [say('ana', { t: 'bet', chip: 0, slotIndex: 0, wager: 0 })])
    expect(state.round!.bets).toHaveLength(1)
  })

  it('replaces rather than duplicates a chip', () => {
    const state = run(betting(), [
      say('ana', { t: 'bet', chip: 0, slotIndex: 3, wager: 0 }),
      say('ana', { t: 'bet', chip: 0, slotIndex: 5, wager: 0 }),
    ])
    expect(state.round!.bets).toHaveLength(1)
    expect(state.round!.bets[0]!.slotIndex).toBe(5)
  })

  it('caps wagers at the points a player actually has', () => {
    const state = betting()
    expect(reduce(state, say('ana', { t: 'bet', chip: 0, slotIndex: 3, wager: 1 }), deps).error)
      .toMatch(/do not have/)
  })

  it('lets a player move a bet until they lock in', () => {
    const locked = run(betting(), [
      say('ana', { t: 'bet', chip: 0, slotIndex: 3, wager: 0 }),
      say('ana', { t: 'lock' }),
    ])
    expect(reduce(locked, say('ana', { t: 'bet', chip: 1, slotIndex: 5, wager: 0 }), deps).error)
      .toMatch(/locked/)

    const unlocked = run(locked, [say('ana', { t: 'unlock' })])
    expect(reduce(unlocked, say('ana', { t: 'bet', chip: 1, slotIndex: 5, wager: 0 }), deps).error)
      .toBeUndefined()
  })

  it('requires a chip on the mat before locking', () => {
    expect(reduce(betting(), say('ana', { t: 'lock' }), deps).error).toMatch(/at least one/)
  })

  it('allows both chips on the same slot', () => {
    // Explicitly permitted: "Bet both Betting Chips on the same payout slot."
    const state = run(betting(), [
      say('ana', { t: 'bet', chip: 0, slotIndex: 4, wager: 0 }),
      say('ana', { t: 'bet', chip: 1, slotIndex: 4, wager: 0 }),
    ])
    expect(state.round!.bets.filter((b) => b.playerId === 'ana')).toHaveLength(2)
  })

  it('pays both chips when they share the winning slot', () => {
    const state = run(betting(), [
      say('ana', { t: 'bet', chip: 0, slotIndex: 4, wager: 0 }),
      say('ana', { t: 'bet', chip: 1, slotIndex: 4, wager: 0 }),
      say('ana', { t: 'lock' }),
      { type: 'timeout' },
    ])
    // Two 1-point chips on the 2:1 centre.
    expect(state.players.find((p) => p.id === 'ana')!.score).toBe(4)
  })

  it('does not reveal on its own just because everyone locked in', () => {
    const state = run(betting(), [
      say('ana', { t: 'bet', chip: 0, slotIndex: 4, wager: 0 }),
      say('ana', { t: 'lock' }),
      say('ben', { t: 'bet', chip: 0, slotIndex: 4, wager: 0 }),
      say('ben', { t: 'lock' }),
      say('cy', { t: 'bet', chip: 0, slotIndex: 3, wager: 0 }),
      say('cy', { t: 'lock' }),
    ])
    expect(state.phase).toBe('betting')
  })

  it('reveals once the host moves on after everyone has locked in', () => {
    const state = run(betting(), [
      say('ana', { t: 'bet', chip: 0, slotIndex: 4, wager: 0 }),
      say('ana', { t: 'lock' }),
      say('ben', { t: 'bet', chip: 0, slotIndex: 4, wager: 0 }),
      say('ben', { t: 'lock' }),
      say('cy', { t: 'bet', chip: 0, slotIndex: 3, wager: 0 }),
      say('cy', { t: 'lock' }),
      // Locking in never advances on its own either — same fix, same reason.
      say('ana', { t: 'advance' }),
    ])

    expect(state.phase).toBe('reveal')
    expect(state.round!.result!.winningSlotIndex).toBe(4) // ben's exact 100

    const score = (id: string) => state.players.find((p) => p.id === id)!.score
    expect(score('ana')).toBe(2) // one chip at 2:1
    expect(score('ben')).toBe(5) // one chip at 2:1, plus the 3-point guess bonus
    expect(score('cy')).toBe(0) // wrong slot, chip returned
  })
})

describe('the table’s reaction', () => {
  it('sends every screen the identical line', () => {
    const state = run(lobbyWith(['ana', 'ben']), [
      say('ana', { t: 'start' }),
      say('ana', { t: 'guess', value: 99 }), // the answer is 100
      say('ben', { t: 'guess', value: 5 }),
      say('ana', { t: 'advance' }),
      say('ana', { t: 'bet', chip: 0, slotIndex: 5, wager: 0 }),
      say('ana', { t: 'lock' }),
      say('ben', { t: 'bet', chip: 0, slotIndex: 3, wager: 0 }),
      say('ben', { t: 'lock' }),
      say('ana', { t: 'advance' }),
    ])

    const quipId = state.round!.result!.quipId
    expect(quipId).not.toBeNull()
    // Same for both players and for the board, which is the entire point.
    expect(viewFor(state, 'ana', clock).round!.result!.quipId).toBe(quipId)
    expect(viewFor(state, 'ben', clock).round!.result!.quipId).toBe(quipId)
    expect(viewFor(state, null, clock).round!.result!.quipId).toBe(quipId)
    expect(quipText(quipId)).toBeTruthy()
  })

  it('reacts to a near miss differently from a wild one', () => {
    const near = run(lobbyWith(['ana', 'ben']), [
      say('ana', { t: 'start' }),
      say('ana', { t: 'guess', value: 99 }), // answer 100
      say('ben', { t: 'guess', value: 1 }),
      { type: 'timeout' }, // question -> betting
      { type: 'timeout' }, // betting -> reveal, nobody needed to lock in
    ])
    const wild = run(lobbyWith(['ana', 'ben']), [
      say('ana', { t: 'start' }),
      say('ana', { t: 'guess', value: 2 }),
      say('ben', { t: 'guess', value: 1 }),
      { type: 'timeout' },
      { type: 'timeout' },
    ])

    expect(QUIPS.find((q) => q.id === near.round!.result!.quipId)!.bucket).toBe('blazing')
    expect(QUIPS.find((q) => q.id === wild.round!.result!.quipId)!.bucket).toBe('wild')
  })

  it('says nothing when nobody guessed at all', () => {
    const state = run(lobbyWith(['ana', 'ben']), [
      say('ana', { t: 'start' }),
      { type: 'timeout' }, // no guesses in
      { type: 'timeout' },
    ])
    expect(state.round!.result!.quipId).toBeNull()
  })
})

describe('a full game', () => {
  it('runs seven questions and then ends', () => {
    let state = run(lobbyWith(['ana', 'ben']), [say('ana', { t: 'start' })])

    for (let round = 1; round <= 7; round++) {
      expect(state.phase).toBe('question')
      expect(state.round!.number).toBe(round)

      state = run(state, [
        say('ana', { t: 'guess', value: 50 }),
        say('ben', { t: 'guess', value: 5000 }),
        say('ana', { t: 'advance' }),
        say('ana', { t: 'bet', chip: 0, slotIndex: 3, wager: 0 }),
        say('ana', { t: 'lock' }),
        say('ben', { t: 'bet', chip: 0, slotIndex: 5, wager: 0 }),
        say('ben', { t: 'lock' }),
        say('ana', { t: 'advance' }),
      ])
      expect(state.phase).toBe('reveal')
      state = run(state, [say('ana', { t: 'advance' })])
    }

    expect(state.phase).toBe('gameover')
    expect(state.winnerIds).toEqual(['ana']) // ben overshot every question
    expect(new Set(state.usedQuestionIds).size).toBe(7)
  })

  it('breaks a tie with sudden death instead of declaring a draw', () => {
    let state = run(lobbyWith(['ana', 'ben']), [
      say('ana', { t: 'config', config: { totalRounds: 1 } }),
      say('ana', { t: 'start' }),
      // Both guess identically, so they finish level.
      say('ana', { t: 'guess', value: 50 }),
      say('ben', { t: 'guess', value: 50 }),
      say('ana', { t: 'advance' }),
      say('ana', { t: 'bet', chip: 0, slotIndex: 4, wager: 0 }),
      say('ana', { t: 'lock' }),
      say('ben', { t: 'bet', chip: 0, slotIndex: 4, wager: 0 }),
      say('ben', { t: 'lock' }),
      say('ana', { t: 'advance' }),
    ])

    expect(state.players.every((p) => p.score === state.players[0]!.score)).toBe(true)

    state = run(state, [say('ana', { t: 'advance' })])
    expect(state.phase).toBe('question')
    expect(state.round!.isTiebreak).toBe(true)

    // The tiebreak answer is 101; ana stays under, ben overshoots.
    state = run(state, [
      say('ana', { t: 'guess', value: 100 }),
      say('ben', { t: 'guess', value: 500 }),
      say('ana', { t: 'advance' }),
    ])
    expect(state.phase).toBe('reveal')
    expect(state.winnerIds).toEqual(['ana'])

    state = run(state, [say('ana', { t: 'advance' })])
    expect(state.phase).toBe('gameover')
  })

  it('restarts from the middle of a round, back to the settings screen', () => {
    let state = run(lobbyWith(['ana', 'ben']), [
      say('ana', { t: 'start' }),
      say('ana', { t: 'guess', value: 50 }),
      say('ben', { t: 'guess', value: 60 }),
      say('ana', { t: 'advance' }),
      say('ana', { t: 'bet', chip: 0, slotIndex: 3, wager: 0 }),
    ])
    expect(state.phase).toBe('betting')

    state = run(state, [say('ana', { t: 'rematch' })])
    expect(state.phase).toBe('lobby')
    expect(state.round).toBeNull()
    expect(state.phaseEndsAt).toBeNull()
    expect(state.players.map((p) => p.score)).toEqual([0, 0])
    // The abandoned question stays spent so the restarted game will not reuse it.
    expect(state.usedQuestionIds).toHaveLength(1)
  })

  it('only lets the host restart', () => {
    const state = run(lobbyWith(['ana', 'ben']), [say('ana', { t: 'start' })])
    expect(reduce(state, say('ben', { t: 'rematch' }), deps).error).toMatch(/host/)
    expect(state.phase).toBe('question')
  })

  it('resets scores but keeps the table for a rematch', () => {
    let state = run(lobbyWith(['ana', 'ben']), [
      say('ana', { t: 'config', config: { totalRounds: 1 } }),
      say('ana', { t: 'start' }),
      say('ana', { t: 'guess', value: 50 }),
      say('ben', { t: 'guess', value: 60 }),
      say('ana', { t: 'advance' }),
      say('ana', { t: 'bet', chip: 0, slotIndex: 5, wager: 0 }),
      say('ana', { t: 'lock' }),
      say('ben', { t: 'bet', chip: 0, slotIndex: 5, wager: 0 }),
      say('ben', { t: 'lock' }),
      say('ana', { t: 'advance' }),
      say('ana', { t: 'advance' }),
    ])
    expect(state.phase).toBe('gameover')

    state = run(state, [say('ana', { t: 'rematch' })])
    expect(state.phase).toBe('lobby')
    expect(state.players.map((p) => p.score)).toEqual([0, 0])
    expect(state.usedQuestionIds).toHaveLength(1) // no repeats next game
  })
})

describe('what clients are allowed to see', () => {
  it('never ships the answer before the reveal', () => {
    const state = run(lobbyWith(['ana', 'ben']), [say('ana', { t: 'start' })])
    // Scoped to the round: the raw timestamps elsewhere in the view would
    // collide with any short answer and make the substring check meaningless.
    const serialised = JSON.stringify(viewFor(state, 'ana', clock).round)
    expect(serialised).not.toContain(String(state.round!.question.answer))
    expect(viewFor(state, 'ana', clock).round!.question.answer).toBeNull()
  })

  it('never ships another player’s guess during the question phase', () => {
    const state = run(lobbyWith(['ana', 'ben']), [
      say('ana', { t: 'start' }),
      say('ana', { t: 'guess', value: 4242 }),
    ])
    const forBen = viewFor(state, 'ben', clock)
    expect(JSON.stringify(forBen)).not.toContain('4242')
    expect(forBen.round!.submitted).toEqual(['ana']) // the "1 / 2 in" counter still works
    expect(forBen.round!.yourGuess).toBeNull()
    expect(viewFor(state, 'ana', clock).round!.yourGuess).toBe(4242)
  })

  it('shows the guesses and the answer once the mat is up', () => {
    const state = run(lobbyWith(['ana', 'ben']), [
      say('ana', { t: 'start' }),
      say('ana', { t: 'guess', value: 4242 }),
      say('ben', { t: 'guess', value: 11 }),
      say('ana', { t: 'advance' }),
    ])
    const view = viewFor(state, 'ben', clock)
    expect(view.phase).toBe('betting')
    expect(JSON.stringify(view)).toContain('4242')
    expect(view.round!.question.answer).toBeNull() // still not until the reveal
  })

  it('strips the French note as well as the English one', () => {
    // Several notes state the answer outright, so shipping `noteFr` early
    // would leak it to any French player before the reveal.
    const bankWithNote: Question[] = [
      {
        id: 'qn',
        text: 'Question?',
        answer: 42,
        note: 'It is forty-two.',
        noteFr: 'C’est quarante-deux.',
      },
    ]
    const noteDeps: EngineDeps = { now: () => clock, drawQuestion: () => bankWithNote[0]! }
    // The question must be *drawn* from this bank, or the assertion is vacuous.
    let state = reduce(lobbyWith(['ana', 'ben']), say('ana', { t: 'start' }), noteDeps).state
    expect(state.round!.question.noteFr).toBe('C’est quarante-deux.')

    const beforeReveal = viewFor(state, 'ana', clock).round!.question
    expect(beforeReveal.note).toBeUndefined()
    expect(beforeReveal.noteFr).toBeUndefined()

    // …and both come back once the answer is out.
    state = reduce(state, say('ana', { t: 'guess', value: 40 }), noteDeps).state
    state = reduce(state, { type: 'timeout' }, noteDeps).state // -> betting
    state = reduce(state, { type: 'timeout' }, noteDeps).state // -> reveal
    const afterReveal = viewFor(state, 'ana', clock).round!.question
    expect(afterReveal.note).toBe('It is forty-two.')
    expect(afterReveal.noteFr).toBe('C’est quarante-deux.')
  })

  it('gives the TV board a view with no player identity', () => {
    const state = run(lobbyWith(['ana', 'ben']), [say('ana', { t: 'start' })])
    expect(viewFor(state, null, clock).youId).toBeNull()
  })
})

describe('the board tally', () => {
  /** Two players at the reveal of question 1. */
  function atReveal(): GameState {
    return run(lobbyWith(['ana', 'ben']), [
      say('ana', { t: 'start' }),
      say('ana', { t: 'guess', value: 90 }),
      say('ben', { t: 'guess', value: 110 }),
      say('ana', { t: 'advance' }),
      say('ana', { t: 'advance' }),
    ])
  }

  it('starts every reveal at the first player', () => {
    const state = atReveal()
    expect(state.phase).toBe('reveal')
    expect(state.round!.tallied).toBe(0)
  })

  it('is moved on by the host, one player at a time, and stops at standings', () => {
    const tap = say('ana', { t: 'tally' })
    const state = run(atReveal(), [tap, tap, tap, tap])
    // Two players: past the first, past the second (standings), then no further.
    expect(state.round!.tallied).toBe(2)
  })

  it('belongs to the host alone', () => {
    const result = reduce(atReveal(), say('ben', { t: 'tally' }), deps)
    expect(result.error).toBeTruthy()
    expect(result.state.round!.tallied).toBe(0)
  })

  it('does nothing outside the reveal', () => {
    const state = run(lobbyWith(['ana', 'ben']), [
      say('ana', { t: 'start' }),
      say('ana', { t: 'tally' }),
    ])
    expect(state.round!.tallied).toBe(0)
  })

  it('starts over for the next question', () => {
    const state = run(atReveal(), [say('ana', { t: 'tally' }), say('ana', { t: 'advance' })])
    expect(state.round!.number).toBe(2)
    expect(state.round!.tallied).toBe(0)
  })
})
