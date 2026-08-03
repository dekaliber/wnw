import { useEffect } from 'react'
import { useGame } from './net.ts'
import { PlayerApp } from './player/PlayerApp.tsx'
import { BoardApp } from './board/BoardApp.tsx'

/** `/board` is the laptop-on-the-TV view; everything else is a phone. */
const isBoard = () => location.pathname.replace(/\/+$/, '') === '/board'

export function App() {
  const game = useGame()

  useEffect(() => {
    document.body.dataset.surface = isBoard() ? 'board' : 'player'
  }, [])

  return (
    <>
      {isBoard() ? <BoardApp game={game} /> : <PlayerApp game={game} />}
      {game.error && (
        <div className="toast" role="status" onClick={game.clearError}>
          {game.error}
        </div>
      )}
      {(game.status === 'reconnecting' || game.status === 'connecting') && game.view && (
        <div className="reconnecting" role="status">
          Reconnecting…
        </div>
      )}
    </>
  )
}
