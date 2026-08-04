import type { ClientView } from '../../shared/types.ts'
import { useJoinOrigin } from '../useJoinOrigin.ts'
import { QrJoin } from './QrJoin.tsx'

export function BoardLobby({ view }: { view: ClientView }) {
  const origin = useJoinOrigin()
  const joinUrl = origin.state === 'ready' ? `http://${origin.host}/?room=${view.roomCode}` : null

  return (
    <main className="board board--lobby">
      <div className="board__joinpanel">
        {joinUrl && (
          <div className="board__scan">
            <QrJoin url={joinUrl} />
            <p className="board__scan-label">Scan to join</p>
          </div>
        )}

        <div className="board__manual">
          <p className="board__step">…or type it in</p>

          {origin.state === 'ready' ? (
            <p className="board__url">{origin.host}</p>
          ) : origin.state === 'loading' ? (
            <p className="board__url board__url--muted">…</p>
          ) : (
            <p className="board__url board__url--warn">No Wi-Fi address</p>
          )}

          <p className="board__step board__step--second">Room code</p>
          <p className="board__roomcode">{view.roomCode}</p>
        </div>

        {origin.state === 'unreachable' && (
          <p className="board__warn">
            This laptop has no network address, so phones cannot reach it. Connect it to the
            same Wi-Fi as everyone else.
          </p>
        )}
      </div>

      <div className="board__roster">
        <h2>
          At the table <span className="count">{view.players.length}</span>
        </h2>
        <ul className="board__players">
          {view.players.map((p) => (
            <li key={p.id} className={p.connected ? '' : 'is-away'}>
              <span className="board__avatar" style={{ background: p.color }}>
                {p.name.slice(0, 1).toUpperCase()}
              </span>
              <span>{p.name}</span>
              {p.id === view.hostId ? (
                <span className="board__hosttag">Host</span>
              ) : p.ready ? (
                <span className="board__hosttag board__hosttag--ready">Ready</span>
              ) : null}
            </li>
          ))}
        </ul>
        {view.players.length === 0 && <p className="board__empty">Waiting for players…</p>}
      </div>
    </main>
  )
}
