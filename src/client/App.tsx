import { useEffect } from 'react'
import { useGame } from './net.ts'
import { LocaleProvider } from './i18n/LocaleProvider.tsx'
import { PlayerApp } from './player/PlayerApp.tsx'
import { ConnectionOverlay } from './player/ConnectionOverlay.tsx'
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

  // Only once they are actually in a game. On the join screen "connecting" is
  // the normal state of affairs and covering it would be nonsense.
  const seated = game.view !== null
  const interrupted = seated && (game.status === 'connecting' || game.status === 'reconnecting')

  return (
    <>
      {/*
        Taps are refused in CSS rather than by disabling each control: every
        screen would otherwise need to thread a prop through every button, and
        one missed control is a tap that silently does nothing — the exact
        failure this replaces. `aria-hidden` keeps the same promise for a
        screen reader, which would otherwise happily read and act on it.
      */}
      <div className={interrupted ? 'shell shell--interrupted' : 'shell'} aria-hidden={interrupted}>
        <PlayerApp game={game} />
      </div>

      {/* An error under the overlay is unreadable, and stale by the time it
          lifts — the overlay is already saying the more useful thing. */}
      {game.error && !interrupted && (
        <div className="toast" role="status" onClick={game.clearError}>
          {game.error}
        </div>
      )}

      <ConnectionOverlay status={game.status} active={seated} />
    </>
  )
}
