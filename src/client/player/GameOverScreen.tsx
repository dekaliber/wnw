import type { ClientView } from '../../shared/types.ts'
import { playerById, standings } from '../format.ts'
import type { Game } from '../net.ts'
import { HostControls } from './HostControls.tsx'

export function GameOverScreen({ game, view }: { game: Game; view: ClientView }) {
  const isHost = view.hostId === view.youId
  const winner = view.winnerIds[0] ? playerById(view, view.winnerIds[0]) : undefined
  const youWon = view.winnerIds.includes(view.youId ?? '')

  return (
    <main className="screen screen--over">
      {/* "Play again" below already is the restart. */}
      <HostControls game={game} view={view} restart={false} />
      <p className="over__label">{youWon ? 'You win' : 'Winner'}</p>
      <h1 className="over__name" style={{ color: winner?.color }}>
        {winner?.name ?? '—'}
      </h1>

      <ol className="standings standings--final">
        {standings(view).map((p, i) => (
          <li key={p.id} className={p.id === view.youId ? 'standings--you' : ''}>
            <span className="standings__rank">{i + 1}</span>
            <span className="dot" style={{ background: p.color }} />
            <span className="standings__name">{p.name}</span>
            <span className="standings__score">{p.score}</span>
          </li>
        ))}
      </ol>

      {isHost ? (
        <button className="btn btn--primary btn--fixed" onClick={() => game.send({ t: 'rematch' })}>
          Play again
        </button>
      ) : (
        <p className="waiting">Waiting for the host to start a rematch…</p>
      )}

      <button className="btn btn--quiet" onClick={game.leave}>
        Leave room
      </button>
    </main>
  )
}
