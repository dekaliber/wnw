/**
 * Room lifecycle, kept free of any transport detail.
 *
 * A `Room` owns one authoritative `GameState`, a set of connections, and the
 * phase timer. It talks to the outside world only through the `Send` callback
 * handed to it, so the same class backs the local WebSocket server today and a
 * Durable Object later without changes.
 */

import { createGame, reduce, type Action, type EngineDeps } from '../shared/engine.ts'
import { viewFor } from '../shared/view.ts'
import type { ClientMessage, GameState, ServerMessage } from '../shared/types.ts'
import { clearResting, drawQuestion, restingCount } from './questions.ts'

export type ConnectionId = string
export type Send = (connectionId: ConnectionId, message: ServerMessage) => void

interface Connection {
  /** null for the TV board, which watches but never acts. */
  playerId: string | null
}

const EMPTY_ROOM_TTL_MS = 30 * 60 * 1000

export class Room {
  state: GameState
  private connections = new Map<ConnectionId, Connection>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private emptySince: number | null = Date.now()

  private deps: EngineDeps = {
    now: () => Date.now(),
    drawQuestion,
  }

  constructor(
    readonly code: string,
    private send: Send,
  ) {
    this.state = createGame(code)
  }

  // -- connections ---------------------------------------------------------

  attachPlayer(connectionId: ConnectionId, playerId: string, name: string): string | undefined {
    const known = this.state.players.some((p) => p.id === playerId)
    const { error } = this.apply(
      known
        ? { type: 'reconnect', playerId }
        : { type: 'addPlayer', playerId, name },
    )
    if (error) return error

    this.connections.set(connectionId, { playerId })
    this.emptySince = null
    this.send(connectionId, { t: 'joined', playerId, roomCode: this.code })
    this.broadcast()
    return undefined
  }

  attachBoard(connectionId: ConnectionId): void {
    this.connections.set(connectionId, { playerId: null })
    this.emptySince = null
    this.send(connectionId, { t: 'watching', roomCode: this.code })
    this.pushTo(connectionId)
  }

  detach(connectionId: ConnectionId): void {
    const connection = this.connections.get(connectionId)
    if (!connection) return
    this.connections.delete(connectionId)

    // Only mark a player away when they have no other tab still open.
    if (connection.playerId) {
      const stillHere = [...this.connections.values()].some(
        (c) => c.playerId === connection.playerId,
      )
      if (!stillHere) this.apply({ type: 'disconnect', playerId: connection.playerId })
    }

    if (this.connections.size === 0) this.emptySince = Date.now()
    this.broadcast()
  }

  handle(connectionId: ConnectionId, message: ClientMessage): void {
    const connection = this.connections.get(connectionId)
    if (!connection?.playerId) {
      this.send(connectionId, { t: 'error', message: 'The board cannot play — join on a phone.' })
      return
    }
    const { error } = this.apply({ type: 'message', playerId: connection.playerId, message })
    if (error) this.send(connectionId, { t: 'error', message: error })
    // The engine has checked it is the host, in the lobby; the 24h rest lives
    // on disk, out of the engine's reach, so it is cleared here.
    else if (message.t === 'resetPlayed') clearResting()
    this.broadcast()
  }

  isExpired(now: number): boolean {
    return this.emptySince !== null && now - this.emptySince > EMPTY_ROOM_TTL_MS
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  // -- internals -----------------------------------------------------------

  private apply(action: Action): { error?: string } {
    const before = this.state.phaseEndsAt
    const result = reduce(this.state, action, this.deps)
    this.state = result.state
    if (this.state.phaseEndsAt !== before) this.rescheduleTimer()
    return { error: result.error }
  }

  /**
   * The clock lives on the server. Clients only ever render a countdown to
   * `phaseEndsAt`, so a laggy or backgrounded phone can never desync the round.
   */
  private rescheduleTimer(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null

    const endsAt = this.state.phaseEndsAt
    if (endsAt === null) return

    this.timer = setTimeout(
      () => {
        this.timer = null
        this.apply({ type: 'timeout' })
        this.broadcast()
      },
      Math.max(0, endsAt - Date.now()),
    )
  }

  broadcast(): void {
    const resting = this.resting()
    for (const connectionId of this.connections.keys()) this.pushTo(connectionId, resting)
  }

  private pushTo(connectionId: ConnectionId, resting = this.resting()): void {
    const connection = this.connections.get(connectionId)
    if (!connection) return
    this.send(connectionId, {
      t: 'state',
      state: viewFor(this.state, connection.playerId, Date.now(), resting),
    })
  }

  /** Read from disk, so only worked out where the host can act on it. */
  private resting(): number {
    if (this.state.phase !== 'lobby') return 0
    return restingCount(this.state.customQuestions?.questions ?? null)
  }
}

// ---------------------------------------------------------------------------

/** Ambiguous characters are omitted so a code is readable across a room. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

export class RoomManager {
  private rooms = new Map<string, Room>()

  constructor(private send: Send) {
    setInterval(() => this.sweep(), 5 * 60 * 1000).unref?.()
  }

  create(): Room {
    let code = this.randomCode()
    while (this.rooms.has(code)) code = this.randomCode()
    const room = new Room(code, this.send)
    this.rooms.set(code, room)
    return room
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase())
  }

  private randomCode(): string {
    let code = ''
    for (let i = 0; i < 4; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
    }
    return code
  }

  private sweep(): void {
    const now = Date.now()
    for (const [code, room] of this.rooms) {
      if (room.isExpired(now)) {
        room.dispose()
        this.rooms.delete(code)
      }
    }
  }
}
