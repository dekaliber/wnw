import type { ClientView } from '../../shared/types.ts'
import { playerById, standings } from '../format.ts'
import { boardStrings } from './useBoardLocales.ts'

export function BoardOver({ view }: { view: ClientView }) {
  const t = boardStrings(view)
  const ranked = standings(view)
  const winner = view.winnerIds[0] ? playerById(view, view.winnerIds[0]) : undefined
  const podium = [ranked[1], ranked[0], ranked[2]] // silver, gold, bronze

  return (
    <main className="board board--over">
      <p className="board__over-label">{t.winner}</p>
      <h1 className="board__over-name" style={{ color: winner?.color }}>
        {winner?.name ?? '—'}
      </h1>

      <div className="podium">
        {podium.map((p, i) =>
          p ? (
            <div key={p.id} className={`podium__step podium__step--${[2, 1, 3][i]}`}>
              <span className="board__avatar" style={{ background: p.color }}>
                {p.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="podium__name">{p.name}</span>
              <span className="podium__score">{p.score}</span>
            </div>
          ) : (
            <div key={i} className="podium__step podium__step--empty" />
          ),
        )}
      </div>

      {ranked.length > 3 && (
        <ol className="board__rest">
          {ranked.slice(3).map((p, i) => (
            <li key={p.id}>
              <span className="standings__rank">{i + 4}</span>
              <span className="dot" style={{ background: p.color }} />
              {p.name}
              <strong>{p.score}</strong>
            </li>
          ))}
        </ol>
      )}
    </main>
  )
}
