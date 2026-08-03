import { useEffect, useState } from 'react'
import type { Game } from '../net.ts'
import { BoardLobby } from './BoardLobby.tsx'
import { BoardRound } from './BoardRound.tsx'
import { BoardOver } from './BoardOver.tsx'

export function BoardApp({ game }: { game: Game }) {
  const { view, connect } = game
  const [code, setCode] = useState('')

  // ?room=ABCD on the board URL connects straight away.
  useEffect(() => {
    const fromUrl = new URLSearchParams(location.search).get('room')
    if (fromUrl) connect({ kind: 'watch', roomCode: fromUrl.toUpperCase() })
  }, [connect])

  if (!view) {
    return (
      <main className="board board--join">
        <h1 className="board__brand">Wits &amp; Wagers</h1>
        <p className="board__tagline">Put this screen where everyone can see it.</p>
        <form
          className="board__form"
          onSubmit={(e) => {
            e.preventDefault()
            if (code.length === 4) connect({ kind: 'watch', roomCode: code })
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
            placeholder="ROOM"
            className="board__code-input"
            autoFocus
          />
          <button className="btn btn--primary" disabled={code.length < 4}>
            Show the board
          </button>
        </form>
        <p className="board__hint">
          Start the game on a phone first, then type its room code here.
        </p>
      </main>
    )
  }

  if (view.phase === 'lobby') return <BoardLobby view={view} />
  if (view.phase === 'gameover') return <BoardOver view={view} />
  return <BoardRound game={game} view={view} />
}
