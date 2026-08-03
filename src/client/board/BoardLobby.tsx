import type { ClientView } from '../../shared/types.ts'

export function BoardLobby({ view }: { view: ClientView }) {
  const joinUrl = `${location.host}/?room=${view.roomCode}`

  return (
    <main className="board board--lobby">
      <div className="board__joinpanel">
        <p className="board__step">Open this on your phone</p>
        <p className="board__url">{joinUrl}</p>
        <p className="board__step board__step--second">Room code</p>
        <p className="board__roomcode">{view.roomCode}</p>
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
            </li>
          ))}
        </ul>
        {view.players.length === 0 && <p className="board__empty">Waiting for players…</p>}
      </div>
    </main>
  )
}
