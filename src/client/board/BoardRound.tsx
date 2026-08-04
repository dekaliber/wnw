import { quipText } from '../../shared/quips.ts'
import type { ClientView } from '../../shared/types.ts'
import { Mat } from '../Mat.tsx'
import { expectedActors, formatAnswer, playerById, standings } from '../format.ts'
import type { Game } from '../net.ts'
import { useCountdown } from '../useCountdown.ts'
import { useTimerChime } from './useTimerChime.ts'

export function BoardRound({ game, view }: { game: Game; view: ClientView }) {
  const round = view.round!
  const seconds = useCountdown(view, game.serverNow)
  const revealed = view.phase === 'reveal'

  useTimerChime(seconds, `${view.phase}-${round.number}`)

  const expected = expectedActors(view)
  const waitingOn =
    view.phase === 'question'
      ? expected.filter((p) => !round.submitted.includes(p.id))
      : expected.filter((p) => !round.locked.includes(p.id))

  return (
    <main className="board board--round">
      <header className="board__head">
        <span className="board__round">
          {round.isTiebreak ? 'Sudden death' : `Question ${round.number}`}
          {!round.isTiebreak && <em> of {view.config.totalRounds}</em>}
        </span>
        {seconds !== null && (
          <span className={`board__timer ${seconds <= 5 ? 'is-urgent' : ''}`}>{seconds}</span>
        )}
      </header>

      <h1 className="board__question">{round.question.text}</h1>

      {view.phase === 'question' ? (
        <section className="board__waiting">
          <p className="board__counter">
            <strong>{round.submitted.length}</strong> of {expected.length} in
          </p>
          <ul className="board__tokens">
            {expected.map((p) => (
              <li
                key={p.id}
                className={round.submitted.includes(p.id) ? 'is-in' : ''}
                style={{ background: round.submitted.includes(p.id) ? p.color : undefined }}
              >
                {p.name}
              </li>
            ))}
          </ul>
          {/* Guessing no longer ends on its own once everyone's in, so the
              room needs to know the host is the next step. */}
          {expected.length > 0 && round.submitted.length >= expected.length && (
            <p className="board__counter board__counter--bet">
              All in — waiting on the host to move on.
            </p>
          )}
        </section>
      ) : (
        <>
          <Mat
            view={view}
            slots={round.slots}
            bets={round.bets}
            winningSlotIndex={revealed ? round.result?.winningSlotIndex : null}
            // Chips stay anonymous while betting is live: you can see a slot
            // getting crowded without knowing who is piling on.
            anonymousChips={!revealed}
          />

          {revealed ? (
            <section className="board__reveal">
              <p className="board__answer-label">Answer</p>
              <p className="board__answer">
                {formatAnswer(round.question.answer ?? 0, round.question.format)}
              </p>
              {quipText(round.result!.quipId) && (
                <p className="quip quip--board">{quipText(round.result!.quipId)}</p>
              )}
              {round.question.note && <p className="board__note">{round.question.note}</p>}
              <ul className="board__deltas">
                {round.result!.deltas
                  .filter((d) => d.total !== 0)
                  .sort((a, b) => b.total - a.total)
                  .map((d) => {
                    const p = playerById(view, d.playerId)
                    return (
                      <li key={d.playerId} className={d.total > 0 ? 'is-up' : 'is-down'}>
                        <span className="dot" style={{ background: p?.color }} />
                        {p?.name}
                        <strong>
                          {d.total > 0 ? '+' : ''}
                          {d.total}
                        </strong>
                      </li>
                    )
                  })}
              </ul>
            </section>
          ) : (
            <p className="board__counter board__counter--bet">
              {waitingOn.length === 0
                ? 'All in.'
                : `Waiting on ${waitingOn.map((p) => p.name).join(', ')}`}
            </p>
          )}
        </>
      )}

      <footer className="board__scores">
        {standings(view).map((p) => (
          <span key={p.id} className="board__score">
            <span className="dot" style={{ background: p.color }} />
            {p.name}
            <strong>{p.score}</strong>
          </span>
        ))}
      </footer>
    </main>
  )
}
