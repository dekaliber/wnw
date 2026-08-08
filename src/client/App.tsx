import { useEffect } from 'react'
import { useGame } from './net.ts'
import { LocaleProvider, useT } from './i18n/LocaleProvider.tsx'
import { PlayerApp } from './player/PlayerApp.tsx'
import { BoardApp } from './board/BoardApp.tsx'

/** `/board` is the laptop-on-the-TV view; everything else is a phone. */
const isBoard = () => location.pathname.replace(/\/+$/, '') === '/board'

export function App() {
  useEffect(() => {
    document.body.dataset.surface = isBoard() ? 'board' : 'player'
  }, [])

  // The board stays in one language — it is the shared surface, so it must not
  // flip to whoever last touched a phone. Only the player app is wrapped.
  return isBoard() ? <BoardShell /> : <LocaleProvider><PlayerShell /></LocaleProvider>
}

function BoardShell() {
  const game = useGame()
  return (
    <>
      <BoardApp game={game} />
      {game.error && (
        <div className="toast" role="status" onClick={game.clearError}>
          {game.error}
        </div>
      )}
    </>
  )
}

function PlayerShell() {
  const game = useGame()
  const t = useT()

  return (
    <>
      <PlayerApp game={game} />
      {game.error && (
        <div className="toast" role="status" onClick={game.clearError}>
          {game.error}
        </div>
      )}
      {(game.status === 'reconnecting' || game.status === 'connecting') && game.view && (
        <div className="reconnecting" role="status">
          {t.reconnecting}
        </div>
      )}
    </>
  )
}
