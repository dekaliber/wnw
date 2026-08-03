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
import type { ClientMessage, ClientView, ServerMessage } from '../shared/types.ts'
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
}

export function useGame(): Game {
  const [status, setStatus] = useState<Status>('closed')
  const [view, setView] = useState<ClientView | null>(null)
  const [error, setError] = useState<string | null>(null)

  const socket = useRef<WebSocket | null>(null)
  const intent = useRef<Intent>({ kind: 'idle' })
  const retries = useRef(0)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closing = useRef(false)
  /** localClock - serverClock, sampled each time a state message lands. */
  const drift = useRef(0)

  const open = useCallback(() => {
    if (intent.current.kind === 'idle') return
    if (retryTimer.current) clearTimeout(retryTimer.current)

    setStatus(retries.current === 0 ? 'connecting' : 'reconnecting')
    const ws = new WebSocket(socketUrl())
    socket.current = ws

    ws.onopen = () => {
      retries.current = 0
      setStatus('open')
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
      const msg: ServerMessage = JSON.parse(event.data)
      if (msg.t === 'state') {
        drift.current = Date.now() - msg.state.now
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
  }, [])

  const connect = useCallback(
    (next: Intent) => {
      closing.current = false
      intent.current = next
      retries.current = 0
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
    forgetRoom()
    setView(null)
    setStatus('closed')
  }, [])

  const send = useCallback((message: ClientMessage) => {
    const ws = socket.current
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message))
  }, [])

  // A phone waking from sleep reports `online` long before the dead socket
  // notices, so nudge it rather than waiting out the backoff.
  useEffect(() => {
    const wake = () => {
      if (intent.current.kind === 'idle') return
      if (socket.current?.readyState === WebSocket.OPEN) return
      retries.current = 0
      open()
    }
    window.addEventListener('online', wake)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') wake()
    })
    return () => window.removeEventListener('online', wake)
  }, [open])

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
  }
}
