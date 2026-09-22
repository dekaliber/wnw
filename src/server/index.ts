/**
 * WebSocket adapter + static host.
 *
 * In development Vite serves the client on :5173 and proxies /ws here. For game
 * night `npm start` builds the client and serves everything from this one port,
 * so there is a single URL to read out loud.
 */

import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer, type WebSocket } from 'ws'
import type { ClientMessage, ErrorCode, ServerMessage } from '../shared/types.ts'
import { RoomManager, type ConnectionId } from './room.ts'
import { questionCount, retiredCount } from './questions.ts'
import { lanAddresses } from './network.ts'

const PORT = Number(process.env.PORT ?? 8787)
const DIST = fileURLToPath(new URL('../../dist', import.meta.url))
// Serve the built client whenever there is one. In development Vite owns :5173
// and proxies /ws here, so this simply stays dormant until the first build.
const SERVE_STATIC = existsSync(join(DIST, 'index.html'))

const sockets = new Map<ConnectionId, WebSocket>()

const rooms = new RoomManager((connectionId, message) => {
  const socket = sockets.get(connectionId)
  if (socket?.readyState === socket?.OPEN) socket?.send(JSON.stringify(message))
})

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true, questions: questionCount }))
    return
  }

  // The board is usually opened on localhost, where `location.host` is useless
  // to a phone. This is how it learns an address the room can actually type.
  if (req.url === '/api/net') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
    res.end(JSON.stringify({ addresses: lanAddresses(), port: PORT }))
    return
  }

  if (!SERVE_STATIC) {
    res.writeHead(404).end('Run the Vite dev server for the client.')
    return
  }

  const requested = (req.url ?? '/').split('?')[0]!
  // normalize + prefix check keeps `..` from escaping the build directory
  const candidate = normalize(join(DIST, requested))
  const file =
    candidate.startsWith(DIST) && existsSync(candidate) && statSync(candidate).isFile()
      ? candidate
      : join(DIST, 'index.html') // SPA fallback

  if (!existsSync(file)) {
    res.writeHead(404).end('Client not built. Run `npm run build`.')
    return
  }

  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
  createReadStream(file).pipe(res)
})

// ---------------------------------------------------------------------------
// WebSocket
// ---------------------------------------------------------------------------

const wss = new WebSocketServer({ server, path: '/ws' })

/**
 * Heartbeat.
 *
 * A phone that leaves Wi-Fi range, or a host laptop that sleeps, drops the
 * connection without ever sending a FIN. Both ends keep a socket that reports
 * itself open and will never carry another byte — so the room goes on
 * broadcasting to a dead player, and the phone sits frozen on whatever screen
 * it last received. Nothing in the close path runs, because nothing closed.
 *
 * Pinging is what turns that silent half-open socket into a real close. It also
 * keeps the connection from looking idle to the router, which is the other way
 * these die: a game spends minutes at a time with nothing to say.
 *
 * Each tick sends two things. The protocol-level `ping` is what this side
 * judges liveness by. The `{ t: 'ping' }` frame is for the other side: browsers
 * answer protocol pings in the network stack and never tell the page, so a
 * client watching for silence needs a frame that actually reaches `onmessage`.
 */
const HEARTBEAT_MS = 15_000

/**
 * How many beats a socket may miss before we give up on it.
 *
 * Terminating on the first miss is wrong, and was: a phone's radio sleeps
 * between packets, the browser answers pings on its own schedule, and a pong
 * that arrives a second late is an ordinary phone being a phone. Cutting those
 * players produced a disconnect and a reconnect every 15s, and since both ends
 * broadcast on attach and detach, every screen in the room re-rendered twice a
 * beat — which is what the flicker was.
 *
 * Three misses is ~45s of genuine silence. Nothing is waiting on this number:
 * a *player* who has really gone is noticed by the phase rules, not here. All
 * this decides is when a dead socket's seat is released, so it can afford to
 * be slow and certain rather than fast and wrong.
 */
const MISSES_ALLOWED = 3
const missed = new WeakMap<WebSocket, number>()

const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    const misses = (missed.get(socket) ?? 0) + 1
    if (misses > MISSES_ALLOWED) {
      // `terminate` rather than `close` — a half-open socket will never
      // complete a closing handshake, and we would wait out the timeout for
      // nothing.
      socket.terminate()
      continue
    }
    missed.set(socket, misses)

    // Pinging a socket that has not finished opening throws, and the error
    // handler below would close a connection that was doing nothing wrong.
    if (socket.readyState !== socket.OPEN) continue

    socket.ping()
    const beat: ServerMessage = { t: 'ping' }
    socket.send(JSON.stringify(beat))
  }
}, HEARTBEAT_MS)

// Never hold the process open on the heartbeat alone.
heartbeat.unref?.()

let nextConnectionId = 1

wss.on('connection', (socket: WebSocket) => {
  const connectionId = String(nextConnectionId++)
  sockets.set(connectionId, socket)
  missed.set(socket, 0)

  // Any sign of life resets the count, not just a pong: a phone sending a bet
  // is demonstrably there whatever its pong timing looks like.
  const heard = () => missed.set(socket, 0)
  socket.on('pong', heard)

  let joinedRoom: string | null = null

  const fail = (message: string, code?: ErrorCode) => {
    const payload: ServerMessage = { t: 'error', message, code }
    socket.send(JSON.stringify(payload))
  }

  socket.on('message', (raw) => {
    heard()
    let msg: ClientMessage
    try {
      msg = JSON.parse(String(raw))
    } catch {
      return fail('Malformed message.')
    }

    if (msg.t === 'create') {
      const room = rooms.create()
      joinedRoom = room.code
      const error = room.attachPlayer(connectionId, msg.playerId ?? connectionId, msg.name)
      if (error) fail(error)
      return
    }

    if (msg.t === 'join' || msg.t === 'watch') {
      const room = rooms.get(msg.roomCode)
      if (!room) {
        return fail(`No room called ${msg.roomCode.toUpperCase()}.`, 'room-not-found')
      }
      joinedRoom = room.code
      if (msg.t === 'watch') return room.attachBoard(connectionId)
      const error = room.attachPlayer(connectionId, msg.playerId ?? connectionId, msg.name)
      if (error) fail(error)
      return
    }

    if (!joinedRoom) return fail('Join a room first.')
    rooms.get(joinedRoom)?.handle(connectionId, msg)
  })

  socket.on('close', () => {
    sockets.delete(connectionId)
    if (joinedRoom) rooms.get(joinedRoom)?.detach(connectionId)
  })

  socket.on('error', () => socket.close())
})

// ---------------------------------------------------------------------------

server.listen(PORT, () => {
  const [best, ...alternates] = lanAddresses()
  const where = SERVE_STATIC ? 'Game night' : 'API'

  const resting = retiredCount()
  console.log(
    `\n  Wits & Wagers — ${questionCount} questions loaded` +
      (resting > 0 ? ` (${resting} resting from the last 24h)` : '') +
      '\n',
  )
  console.log(`  ${where} server on  http://localhost:${PORT}`)

  if (best) {
    console.log(`  Phones on Wi-Fi   http://${best}:${PORT}`)
    for (const alternate of alternates) {
      console.log(`    or              http://${alternate}:${PORT}`)
    }
  } else {
    console.log('  No network address found — phones will not be able to connect.')
  }

  if (!SERVE_STATIC) console.log(`  Client (dev)      http://localhost:5173`)
  console.log('')
})
