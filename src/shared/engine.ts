/**
 * The authoritative game state machine.
 *
 * Pure: no sockets, no timers, no I/O. The server owns a `GameState` per room
 * and pushes every action through `reduce`. Time and randomness arrive via
 * `EngineDeps` so tests can drive a whole game deterministically.
 */

import {
  ALL_TOO_HIGH,
  CHIPS_PER_PLAYER,
  buildMat,
  isBettable,
  winningSlotIndex,
} from './mat.ts'
import { bucketFor, pickQuipId, seedFrom } from './quips.ts'
import { applyDeltas, bankAvailable, leaders, scoreRound } from './scoring.ts'
import {
  DEFAULT_CONFIG,
  type Bet,
  type ClientMessage,
  type GameConfig,
  type GameState,
  type Player,
  type Question,
  type Round,
} from './types.ts'

export const PLAYER_COLORS = [
  '#f4c025', // yellow
  '#e03b3b', // red
  '#2f7fd8', // blue
  '#d8d8d8', // white
  '#2fb56e', // green
  '#ef8a2b', // orange
  '#8b5cd6', // purple
  '#e05fa0', // pink
]

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 20

export interface EngineDeps {
  now: () => number
  /** Draws an unused question; the server owns the bank. */
  drawQuestion: (usedIds: string[]) => Question
}

export type Action =
  | { type: 'addPlayer'; playerId: string; name: string }
  | { type: 'reconnect'; playerId: string }
  | { type: 'disconnect'; playerId: string }
  | { type: 'timeout' }
  | { type: 'message'; playerId: string; message: ClientMessage }

export interface ReduceResult {
  state: GameState
  error?: string
}

export function createGame(roomCode: string): GameState {
  return {
    roomCode,
    phase: 'lobby',
    hostId: null,
    players: [],
    config: { ...DEFAULT_CONFIG },
    round: null,
    phaseEndsAt: null,
    winnerIds: [],
    usedQuestionIds: [],
  }
}

export function reduce(
  state: GameState,
  action: Action,
  deps: EngineDeps,
): ReduceResult {
  switch (action.type) {
    case 'addPlayer':
      return addPlayer(state, action.playerId, action.name)
    case 'reconnect':
      return { state: setConnected(state, action.playerId, true) }
    case 'disconnect':
      return { state: setConnected(state, action.playerId, false) }
    case 'timeout':
      return { state: advancePhase(state, deps) }
    case 'message':
      return handleMessage(state, action.playerId, action.message, deps)
  }
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

function addPlayer(state: GameState, playerId: string, rawName: string): ReduceResult {
  const existing = state.players.find((p) => p.id === playerId)
  if (existing) return { state: setConnected(state, playerId, true) }

  if (state.players.length >= MAX_PLAYERS) {
    return { state, error: `This room is full (${MAX_PLAYERS} players).` }
  }
  if (state.phase !== 'lobby') {
    // Late arrivals are welcome, but start with no points so they cannot
    // leapfrog the table; they simply sit out until the next question.
    return { state: insertPlayer(state, playerId, rawName) }
  }
  return { state: insertPlayer(state, playerId, rawName) }
}

function insertPlayer(state: GameState, playerId: string, rawName: string): GameState {
  const taken = new Set(state.players.map((p) => p.color))
  const color = PLAYER_COLORS.find((c) => !taken.has(c)) ?? PLAYER_COLORS[0]!
  const player: Player = {
    id: playerId,
    name: uniqueName(state.players, rawName),
    color,
    score: 0,
    connected: true,
    ready: false,
  }
  return {
    ...state,
    players: [...state.players, player],
    hostId: state.hostId ?? playerId,
  }
}

function uniqueName(players: Player[], raw: string): string {
  const base = raw.trim().slice(0, 16) || 'Player'
  const taken = new Set(players.map((p) => p.name.toLowerCase()))
  if (!taken.has(base.toLowerCase())) return base
  for (let i = 2; i < 50; i++) {
    const candidate = `${base} ${i}`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
  return base
}

function setConnected(state: GameState, playerId: string, connected: boolean): GameState {
  // `hostId` deliberately does not move here. A host whose phone sleeps for
  // twenty seconds must get their controls back on return, and handing the
  // role away on every blip would strand the game behind whoever inherited it.
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, connected } : p)),
  }
}

export function activePlayers(state: GameState): Player[] {
  return state.players.filter((p) => p.connected)
}

/**
 * Who may drive the game right now.
 *
 * Normally the host. While the host is away, the role falls to the first
 * connected player so the table is never stuck waiting on an empty chair — and
 * it returns to the real host the moment they reconnect.
 */
export function effectiveHostId(state: GameState): string | null {
  const host = state.players.find((p) => p.id === state.hostId)
  if (host?.connected) return host.id
  return activePlayers(state)[0]?.id ?? state.hostId
}

/**
 * Whether the host may start.
 *
 * The host does not mark themselves ready — pressing Start is their signal.
 * Only connected players count, so someone whose phone has dropped cannot hold
 * the table hostage; and an empty set is vacuously ready, leaving the minimum
 * player count to give the more useful message.
 */
export function everyoneReady(players: Player[], hostId: string | null): boolean {
  return players.every((p) => !p.connected || p.id === hostId || p.ready)
}

/** Ready is a per-game signal, so it clears whenever a new one is set up. */
function clearReady(players: Player[]): Player[] {
  return players.map((p) => (p.ready ? { ...p, ready: false } : p))
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

function handleMessage(
  state: GameState,
  playerId: string,
  msg: ClientMessage,
  deps: EngineDeps,
): ReduceResult {
  const isHost = effectiveHostId(state) === playerId

  switch (msg.t) {
    case 'rename': {
      const players = state.players.map((p) =>
        p.id === playerId
          ? { ...p, name: uniqueName(state.players.filter((o) => o.id !== playerId), msg.name) }
          : p,
      )
      return { state: { ...state, players } }
    }

    case 'config': {
      if (!isHost) return { state, error: 'Only the host can change settings.' }
      if (state.phase !== 'lobby') return { state, error: 'Settings are locked once the game starts.' }
      return { state: { ...state, config: sanitizeConfig({ ...state.config, ...msg.config }) } }
    }

    case 'kick': {
      if (!isHost) return { state, error: 'Only the host can remove players.' }
      return { state: { ...state, players: state.players.filter((p) => p.id !== msg.playerId) } }
    }

    case 'ready': {
      if (state.phase !== 'lobby') return { state }
      const players = state.players.map((p) =>
        p.id === playerId ? { ...p, ready: Boolean(msg.ready) } : p,
      )
      return { state: { ...state, players } }
    }

    case 'start': {
      if (!isHost) return { state, error: 'Only the host can start the game.' }
      if (state.phase !== 'lobby') return { state, error: 'The game is already running.' }
      if (activePlayers(state).length < MIN_PLAYERS) {
        return { state, error: `Need at least ${MIN_PLAYERS} players.` }
      }
      if (!everyoneReady(state.players, effectiveHostId(state))) {
        return { state, error: 'Not everyone is ready yet.' }
      }
      return { state: beginRound({ ...state, players: clearReady(state.players) }, 1, false, deps) }
    }

    case 'guess': {
      if (state.phase !== 'question' || !state.round) {
        return { state, error: 'Not accepting guesses right now.' }
      }
      if (!Number.isFinite(msg.value)) return { state, error: 'That is not a number.' }
      if (state.round.isTiebreak && !state.winnerIds.includes(playerId)) {
        return { state, error: 'Only the tied players guess in a tiebreak.' }
      }
      const round: Round = {
        ...state.round,
        guesses: { ...state.round.guesses, [playerId]: msg.value },
      }
      // No auto-advance on quorum: a phone that has gone to sleep can miss its
      // guess entirely if the phase moves on the instant everyone else is in.
      // The phase now only ends when the timer runs out or the host advances
      // it manually — see `case 'advance'`.
      return { state: { ...state, round } }
    }

    case 'bet': {
      if (state.phase !== 'betting' || !state.round) {
        return { state, error: 'Not accepting bets right now.' }
      }
      if (state.round.locked.includes(playerId)) {
        return { state, error: 'Your bets are locked in.' }
      }
      const player = state.players.find((p) => p.id === playerId)
      if (!player) return { state, error: 'Unknown player.' }
      if (!isBettable(state.round.slots, msg.slotIndex)) {
        return { state, error: 'That slot is empty — nothing to bet on.' }
      }

      const wager = Math.max(0, Math.floor(msg.wager))
      const others = state.round.bets.filter(
        (b) => !(b.playerId === playerId && b.chip === msg.chip),
      )
      if (wager > bankAvailable(player, others)) {
        return { state, error: 'You do not have that many points to wager.' }
      }

      const bet: Bet = { playerId, chip: msg.chip, slotIndex: msg.slotIndex, wager }
      return { state: { ...state, round: { ...state.round, bets: [...others, bet] } } }
    }

    case 'clearBet': {
      if (state.phase !== 'betting' || !state.round) return { state }
      if (state.round.locked.includes(playerId)) {
        return { state, error: 'Your bets are locked in.' }
      }
      const bets = state.round.bets.filter(
        (b) => !(b.playerId === playerId && b.chip === msg.chip),
      )
      return { state: { ...state, round: { ...state.round, bets } } }
    }

    case 'lock': {
      if (state.phase !== 'betting' || !state.round) return { state }
      const placed = state.round.bets.filter((b) => b.playerId === playerId).length
      if (placed === 0) return { state, error: 'Place at least one chip first.' }
      if (state.round.locked.includes(playerId)) return { state }
      const locked = [...state.round.locked, playerId]
      // Same reasoning as `guess`: no early advance on quorum.
      return { state: { ...state, round: { ...state.round, locked } } }
    }

    case 'unlock': {
      if (state.phase !== 'betting' || !state.round) return { state }
      const locked = state.round.locked.filter((id) => id !== playerId)
      return { state: { ...state, round: { ...state.round, locked } } }
    }

    case 'advance': {
      if (!isHost) return { state, error: 'Only the host can advance the game.' }
      return { state: advancePhase(state, deps) }
    }

    case 'rematch': {
      if (!isHost) return { state, error: 'Only the host can start a rematch.' }
      return {
        state: {
          ...state,
          phase: 'lobby',
          round: null,
          phaseEndsAt: null,
          winnerIds: [],
          players: clearReady(state.players).map((p) => ({ ...p, score: 0 })),
        },
      }
    }

    default:
      return { state }
  }
}

function sanitizeConfig(config: GameConfig): GameConfig {
  return {
    totalRounds: clamp(Math.floor(config.totalRounds), 1, 20),
    guessSeconds: clamp(Math.floor(config.guessSeconds), 10, 300),
    betSeconds: clamp(Math.floor(config.betSeconds), 10, 300),
    timersEnabled: Boolean(config.timersEnabled),
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo))
}

// ---------------------------------------------------------------------------
// Phase machine
// ---------------------------------------------------------------------------

function beginRound(
  state: GameState,
  number: number,
  isTiebreak: boolean,
  deps: EngineDeps,
): GameState {
  const question = deps.drawQuestion(state.usedQuestionIds)
  const round: Round = {
    number,
    question,
    guesses: {},
    slots: [],
    bets: [],
    locked: [],
    result: null,
    isTiebreak,
  }
  return {
    ...state,
    phase: 'question',
    round,
    usedQuestionIds: [...state.usedQuestionIds, question.id],
    phaseEndsAt: deadline(state.config, 'question', deps),
  }
}

function deadline(
  config: GameConfig,
  phase: 'question' | 'betting',
  deps: EngineDeps,
): number | null {
  if (!config.timersEnabled) return null
  const seconds = phase === 'question' ? config.guessSeconds : config.betSeconds
  return deps.now() + seconds * 1000
}

export function advancePhase(state: GameState, deps: EngineDeps): GameState {
  switch (state.phase) {
    case 'question':
      return openBetting(state, deps)
    case 'betting':
      return revealAnswer(state)
    case 'reveal':
      return afterReveal(state, deps)
    default:
      return state
  }
}

function openBetting(state: GameState, deps: EngineDeps): GameState {
  if (!state.round) return state
  const slots = buildMat(state.round.guesses)

  // A tiebreak is sudden death on the guess alone — no wagering.
  if (state.round.isTiebreak) {
    return resolveTiebreak({ ...state, round: { ...state.round, slots } })
  }

  return {
    ...state,
    phase: 'betting',
    round: { ...state.round, slots },
    phaseEndsAt: deadline(state.config, 'betting', deps),
  }
}

function revealAnswer(state: GameState): GameState {
  if (!state.round) return state
  const { slots, bets, question, number } = state.round
  const winner = winningSlotIndex(slots, question.answer)
  const deltas = scoreRound(state.players, slots, bets, winner)

  // Nobody guessed at all, so there is no near-miss to comment on.
  const anyGuesses = slots.some((s) => s.guess)
  const winningGuess = winner === ALL_TOO_HIGH ? null : (slots[winner]?.guess?.value ?? null)
  const quipId = anyGuesses
    ? pickQuipId(
        // The format matters: a year 500 out is not a near miss, whatever the
        // ratio says.
        bucketFor(question.answer, winningGuess, question.format),
        question.category,
        // Seeded off the round so the same question can still draw a different
        // line next time it comes up, and tests stay deterministic.
        seedFrom(`${question.id}:${number}:${winner}`),
      )
    : null

  return {
    ...state,
    phase: 'reveal',
    players: applyDeltas(state.players, deltas),
    round: { ...state.round, result: { winningSlotIndex: winner, deltas, quipId } },
    phaseEndsAt: null,
  }
}

function afterReveal(state: GameState, deps: EngineDeps): GameState {
  if (!state.round) return state

  // A tiebreak already narrowed the field; go again only if it stayed tied.
  if (state.round.isTiebreak) {
    if (state.winnerIds.length > 1) {
      return beginRound(state, state.round.number + 1, true, deps)
    }
    return { ...state, phase: 'gameover', phaseEndsAt: null }
  }

  if (state.round.number >= state.config.totalRounds) {
    const tied = leaders(state.players)
    if (tied.length > 1) {
      return beginRound({ ...state, winnerIds: tied }, state.round.number + 1, true, deps)
    }
    return { ...state, phase: 'gameover', winnerIds: tied, phaseEndsAt: null }
  }

  return beginRound(state, state.round.number + 1, false, deps)
}

/**
 * Sudden death: among the tied leaders, closest without going over takes it.
 * If everyone overshoots or they tie again, we go around once more.
 */
function resolveTiebreak(state: GameState): GameState {
  if (!state.round) return state
  const { guesses, question } = state.round
  const contenders = state.winnerIds

  let best = -Infinity
  let winners: string[] = []
  for (const id of contenders) {
    const value = guesses[id]
    if (value === undefined || value > question.answer) continue
    if (value > best) {
      best = value
      winners = [id]
    } else if (value === best) {
      winners.push(id)
    }
  }

  // Nobody stayed under: closest from above keeps it moving rather than
  // stalling the party on a technicality.
  if (winners.length === 0) {
    let closest = Infinity
    for (const id of contenders) {
      const value = guesses[id]
      if (value === undefined) continue
      const distance = Math.abs(value - question.answer)
      if (distance < closest) {
        closest = distance
        winners = [id]
      } else if (distance === closest) {
        winners.push(id)
      }
    }
  }

  const resolved = winners.length > 0 ? winners : contenders
  return {
    ...state,
    phase: 'reveal',
    winnerIds: resolved,
    round: {
      ...state.round,
      // A tiebreak has no mat and no betting, so there is nothing to quip at.
      result: { winningSlotIndex: -1, deltas: [], quipId: null },
    },
    phaseEndsAt: null,
  }
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export function chipsRemaining(state: GameState, playerId: string): number {
  if (!state.round) return CHIPS_PER_PLAYER
  const placed = state.round.bets.filter((b) => b.playerId === playerId).length
  return CHIPS_PER_PLAYER - placed
}
