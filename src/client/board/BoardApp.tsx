import { useEffect, useState } from 'react'
import type { Game } from '../net.ts'
import { BoardLobby } from './BoardLobby.tsx'
import { BoardRound } from './BoardRound.tsx'
import { BoardOver } from './BoardOver.tsx'
import { useAudioUnlock } from './chime.ts'
import { boardStrings } from './useBoardLocales.ts'

export function BoardApp({ game }: { game: Game }) {
  const { view, connect } = game
  const [code, setCode] = useState('')
  const soundReady = useAudioUnlock()

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

  return (
    <>
      {view.phase === 'lobby' ? (
        <BoardLobby view={view} />
      ) : view.phase === 'gameover' ? (
        <BoardOver view={view} />
      ) : (
        <BoardRound game={game} view={view} />
      )}

      {/* Kept in a corner through the game, for reconnecting a phone or
          reopening this board. The lobby already shows it large. */}
      {view.phase !== 'lobby' && (
        <p className="board__roomtag">
          {boardStrings(view).room} <strong>{view.roomCode}</strong>
        </p>
      )}

      {/* A board opened straight from a ?room= link has never seen a gesture,
          so the browser keeps audio suspended. Ask for the one click rather
          than letting the ten-second warning silently never fire. */}
      {!soundReady && (
        <p className="board__soundoff" role="status">
          {boardStrings(view).boardSoundPrompt}
        </p>
      )}
    </>
  )
}
