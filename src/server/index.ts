/**
 * WebSocket adapter + static host.
 *
 * In development Vite serves the client on :5173 and proxies /ws here. For game
 * night `npm start` builds the client and serves everything from this one port,
 * so there is a single URL to read out loud.
 */

import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { networkInterfaces } from 'node:os'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer, type WebSocket } from 'ws'
import type { ClientMessage, ServerMessage } from '../shared/types.ts'
import { RoomManager, type ConnectionId } from './room.ts'
import { questionCount } from './questions.ts'

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

let nextConnectionId = 1

wss.on('connection', (socket: WebSocket) => {
  const connectionId = String(nextConnectionId++)
  sockets.set(connectionId, socket)

  let joinedRoom: string | null = null

  const fail = (message: string) => {
    const payload: ServerMessage = { t: 'error', message }
    socket.send(JSON.stringify(payload))
  }

  socket.on('message', (raw) => {
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
      if (!room) return fail(`No room called ${msg.roomCode.toUpperCase()}.`)
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

function lanAddress(): string | null {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) return address.address
    }
  }
  return null
}

server.listen(PORT, () => {
  const lan = lanAddress()
  const where = SERVE_STATIC ? 'Game night' : 'API'
  console.log(`\n  Wits & Wagers — ${questionCount} questions loaded\n`)
  console.log(`  ${where} server on  http://localhost:${PORT}`)
  if (lan) console.log(`  Phones on Wi-Fi   http://${lan}:${PORT}`)
  if (!SERVE_STATIC) console.log(`  Client (dev)      http://localhost:5173`)
  console.log('')
})
