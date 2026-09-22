/**
 * Socket plumbing.
 *
 * Phones sleep, Wi-Fi blips, people switch apps to check a text. All of that
 * closes the socket, so reconnecting silently is the normal case rather than an
 * error path: identity lives in localStorage and the rejoin is automatic, which
 * is what lets someone lock their phone mid-round and come back to the same
 * seat with the same chips.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClientMessage, ClientView, Phase, ServerMessage } from '../shared/types.ts'
import { newId } from './id.ts'

const ID_KEY = 'wnw.playerId'
const NAME_KEY = 'wnw.name'
const ROOM_KEY = 'wnw.room'

export type Status = 'connecting' | 'open' | 'reconnecting' | 'closed'

export function playerId(): string {
  let id = localStorage.getItem(ID_KEY)
  if (!id) {
    id = newId()
    localStorage.setItem(ID_KEY, id)
  }
  return id
}

export const rememberedName = () => localStorage.getItem(NAME_KEY) ?? ''
export const rememberName = (name: string) => localStorage.setItem(NAME_KEY, name)
export const rememberedRoom = () => localStorage.getItem(ROOM_KEY) ?? ''
export const rememberRoom = (code: string) => localStorage.setItem(ROOM_KEY, code)
export const forgetRoom = () => localStorage.removeItem(ROOM_KEY)

function socketUrl(): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${location.host}/ws`
}

/**
 * How long a socket may stay silent before we stop believing it.
 *
 * `readyState` is not evidence of a live connection: a socket dropped without a
 * FIN — Wi-Fi out of range, the host laptop asleep — reports `OPEN` forever and
 * never fires `onclose`, so the reconnect below would never start and the phone
 * would sit frozen on a stale screen. Silence is the only symptom available.
 *
 * The server sends a `ping` frame every 15s precisely so this has something to
 * measure — protocol-level pongs happen in the network stack and never reach
 * the page, so an idle-but-healthy lobby would otherwise look identical to a
 * dead socket. Two missed beats plus slack, so a single late one is not enough.
 */
const SILENCE_MS = 40_000

/**
 * A tap made while the socket is down.
 *
 * Dropping these silently is indistinguishable from the game ignoring you: the
 * chip does not move, nothing says why, and the round ends without your bet.
 * So they are held and replayed once the socket is back.
 *
 * Replaying blindly is worse than dropping, though. `guess` is only legal
 * during the question phase — but *every* round has a question phase, so a
 * guess held through a reconnect could land against the next round's question,
 * which the server has no way to recognise as stale. A held `advance` is worse
 * still: if the phase moved on by itself, replaying it skips the next one.
 *
 * So each one records the phase and round it was composed in, and is replayed
 * only if the game is still there. Anything else is dropped and *said out
 * loud*, which is the part that was actually missing.
 */
interface Pending {
  message: ClientMessage
  at: number
  phase: Phase | null
  round: number | null
}

/** Where the game was when a message was composed. */
interface Context {
  phase: Phase | null
  round: number | null
}

/**
 * Messages that mean the same thing whenever they arrive. Everything else is
 * an action *within* a phase and has to be checked against one.
 */
const CONTEXT_FREE = new Set<ClientMessage['t']>(['rename', 'locale'])

/** Long enough to cover a reconnect, far short of a round. */
const PENDING_TTL_MS = 20_000

/** A stuck player mashing a button must not build an unbounded replay. */
const PENDING_LIMIT = 16

/**
 * Whether a held message still means what it meant when it was tapped.
 *
 * Pure and exported so the policy can be tested without a socket.
 */
export function stillApplies(entry: Pending, now: number, context: Context): boolean {
  if (now - entry.at > PENDING_TTL_MS) return false
  if (CONTEXT_FREE.has(entry.message.t)) return true
  return entry.phase === context.phase && entry.round === context.round
}

/** What the client wants to be doing; replayed verbatim after a reconnect. */
export type Intent =
  | { kind: 'idle' }
  | { kind: 'create'; name: string }
  | { kind: 'join'; roomCode: string; name: string }
  | { kind: 'watch'; roomCode: string }

export interface Game {
  status: Status
  view: ClientView | null
  error: string | null
  send: (message: ClientMessage) => void
  connect: (intent: Intent) => void
  leave: () => void
  clearError: () => void
  /** Best estimate of the server clock right now, for phase countdowns. */
  serverNow: () => number
  /**
   * The room in the link does not exist — usually a QR from a previous
   * session, or a server that has been restarted since.
   */
  roomMissing: boolean
}

export function useGame(): Game {
  const [status, setStatus] = useState<Status>('closed')
  const [view, setView] = useState<ClientView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [roomMissing, setRoomMissing] = useState(false)

  const socket = useRef<WebSocket | null>(null)
  const intent = useRef<Intent>({ kind: 'idle' })
  const retries = useRef(0)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closing = useRef(false)
  /** When anything last arrived. The only real liveness signal we get. */
  const lastMessage = useRef(0)
  /** Taps made while the socket was down, awaiting a replay that still fits. */
  const pending = useRef<Pending[]>([])
  /** The phase/round the last state put us in, for judging that fit. */
  const context = useRef<Context>({ phase: null, round: null })
  const watchdog = useRef<ReturnType<typeof setInterval> | null>(null)
  /** localClock - serverClock, sampled each time a state message lands. */
  const drift = useRef(0)

  /**
   * Send everything held during the outage that still fits the game as it now
   * stands, and say so when something did not. Silence here is the whole bug.
   */
  const flush = useCallback((ws: WebSocket) => {
    const held = pending.current
    pending.current = []
    const now = Date.now()
    let dropped = 0

    for (const entry of held) {
      if (stillApplies(entry, now, context.current)) {
        ws.send(JSON.stringify(entry.message))
      } else {
        dropped += 1
      }
    }

    if (dropped > 0) {
      setError(
        dropped === 1
          ? 'The round moved on before that reached the table — tap it again.'
          : `The round moved on before ${dropped} taps reached the table — try again.`,
      )
    }
  }, [])

  const open = useCallback(() => {
    if (intent.current.kind === 'idle') return
    if (retryTimer.current) clearTimeout(retryTimer.current)

    setStatus(retries.current === 0 ? 'connecting' : 'reconnecting')
    const ws = new WebSocket(socketUrl())
    socket.current = ws
    lastMessage.current = Date.now()

    ws.onopen = () => {
      retries.current = 0
      setStatus('open')
      lastMessage.current = Date.now()
      const current = intent.current

      // A throw in here is invisible: the socket is open, the handshake never
      // goes out, and the player stares at an unchanged join screen. Surface it
      // instead of letting it strand them.
      try {
        if (current.kind === 'create') {
          ws.send(JSON.stringify({ t: 'create', name: current.name, playerId: playerId() }))
        } else if (current.kind === 'join') {
          ws.send(
            JSON.stringify({
              t: 'join',
              roomCode: current.roomCode,
              name: current.name,
              playerId: playerId(),
            }),
          )
        } else if (current.kind === 'watch') {
          ws.send(JSON.stringify({ t: 'watch', roomCode: current.roomCode }))
        }
      } catch (cause) {
        console.error('Could not send the join handshake', cause)
        setError('Could not join — please reload and try again.')
        closing.current = true
        ws.close()
      }
    }

    ws.onmessage = (event) => {
      lastMessage.current = Date.now()
      const msg: ServerMessage = JSON.parse(event.data)
      // `ping` carries nothing — stamping the arrival above was the entire
      // point of it, so there is deliberately no branch for it below.
      if (msg.t === 'state') {
        drift.current = Date.now() - msg.state.now
        context.current = { phase: msg.state.phase, round: msg.state.round?.number ?? null }
        // Replay against *this* state rather than on `onopen`: until the first
        // state lands there is nothing to judge a held message against.
        if (pending.current.length > 0) flush(ws)
        setView(msg.state)
      } else if (msg.t === 'joined') {
        rememberRoom(msg.roomCode)
        // Pin the intent to the resolved code so a created room can be rejoined.
        intent.current = {
          kind: 'join',
          roomCode: msg.roomCode,
          name: rememberedName(),
        }
      } else if (msg.t === 'watching') {
        intent.current = { kind: 'watch', roomCode: msg.roomCode }
      } else if (msg.t === 'error') {
        setError(msg.message)
        if (msg.code === 'room-not-found') {
          // Stop retrying into a room that is not there; the join screen
          // offers to start a new game instead.
          setRoomMissing(true)
          closing.current = true
          intent.current = { kind: 'idle' }
          pending.current = []
          socket.current?.close()
        }
      }
    }

    ws.onclose = () => {
      socket.current = null
      if (closing.current || intent.current.kind === 'idle') {
        setStatus('closed')
        return
      }
      setStatus('reconnecting')
      const delay = Math.min(500 * 2 ** retries.current, 5000)
      retries.current += 1
      retryTimer.current = setTimeout(open, delay)
    }

    ws.onerror = () => ws.close()
  }, [flush])

  const connect = useCallback(
    (next: Intent) => {
      closing.current = false
      intent.current = next
      retries.current = 0
      setRoomMissing(false)
      if (next.kind === 'join' || next.kind === 'create') rememberName(next.name)
      socket.current?.close()
      open()
    },
    [open],
  )

  const leave = useCallback(() => {
    closing.current = true
    intent.current = { kind: 'idle' }
    if (retryTimer.current) clearTimeout(retryTimer.current)
    socket.current?.close()
    socket.current = null
    pending.current = []
    context.current = { phase: null, round: null }
    forgetRoom()
    setView(null)
    setStatus('closed')
  }, [])

  const send = useCallback((message: ClientMessage) => {
    const ws = socket.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
      return
    }
    // Not in a game, so there is nothing for a replay to land in.
    if (intent.current.kind === 'idle') return

    pending.current.push({ message, at: Date.now(), ...context.current })
    // Oldest first: the newest tap is the one they are waiting on.
    if (pending.current.length > PENDING_LIMIT) pending.current.shift()
  }, [])

  /**
   * Drop a socket that has gone quiet, so `onclose` fires and the backoff above
   * takes over. Without this the reconnect machinery is unreachable for exactly
   * the failure it exists to handle — see SILENCE_MS.
   */
  const dropIfStale = useCallback(() => {
    const ws = socket.current
    if (!ws || intent.current.kind === 'idle') return false
    if (Date.now() - lastMessage.current < SILENCE_MS) return false
    // Not `closing`: we want the reconnect, not a teardown.
    ws.close()
    return true
  }, [])

  // A phone waking from sleep reports `online` long before the dead socket
  // notices, so nudge it rather than waiting out the backoff.
  useEffect(() => {
    const wake = () => {
      if (intent.current.kind === 'idle') return
      // A stale socket still claims to be OPEN, so check liveness before
      // trusting readyState — otherwise waking the phone does nothing at all.
      if (dropIfStale()) return
      if (socket.current?.readyState === WebSocket.OPEN) return
      retries.current = 0
      open()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') wake()
    }
    window.addEventListener('online', wake)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', wake)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [open, dropIfStale])

  // Backstop for the phone that is awake and foregrounded the whole time: no
  // wake event ever fires, so only polling notices the connection died.
  useEffect(() => {
    watchdog.current = setInterval(dropIfStale, 5_000)
    return () => {
      if (watchdog.current) clearInterval(watchdog.current)
    }
  }, [dropIfStale])

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(null), 4000)
    return () => clearTimeout(timer)
  }, [error])

  const serverNow = useCallback(() => Date.now() - drift.current, [])

  return {
    status,
    view,
    error,
    send,
    connect,
    leave,
    clearError: () => setError(null),
    serverNow,
    roomMissing,
  }
}
