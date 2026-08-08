import type { ClientView } from '../../shared/types.ts'
import { Mat } from '../Mat.tsx'
import { expectedActors, formatAnswer, playerById, standings } from '../format.ts'
import { localisedQuip, questionNote, questionText } from '../i18n/content.ts'
import type { Game } from '../net.ts'
import { useCountdown } from '../useCountdown.ts'
import { boardLocales, boardStrings, inEachLocale } from './useBoardLocales.ts'
import { useTimerChime } from './useTimerChime.ts'

export function BoardRound({ game, view }: { game: Game; view: ClientView }) {
  const round = view.round!
  const seconds = useCountdown(view, game.serverNow)
  const revealed = view.phase === 'reveal'

  useTimerChime(seconds, `${view.phase}-${round.number}`)

  // Follows the room: one language when everyone agrees, both when they do not.
  const locales = boardLocales(view)
  const t = boardStrings(view)

  const expected = expectedActors(view)
  const waitingOn =
    view.phase === 'question'
      ? expected.filter((p) => !round.submitted.includes(p.id))
      : expected.filter((p) => !round.locked.includes(p.id))

  const questions = inEachLocale(locales, (l) => questionText(round.question, l))
  const quips = inEachLocale(locales, (l) => localisedQuip(round.result?.quipId, l))
  const notes = inEachLocale(locales, (l) => questionNote(round.question, l))

  return (
    <main className="board board--round">
      <header className="board__head">
        <span className="board__round">
          {round.isTiebreak ? t.suddenDeath : t.questionN(round.number)}
          {!round.isTiebreak && <em> {t.ofN(view.config.totalRounds)}</em>}
        </span>
        {seconds !== null && (
          <span className={`board__timer ${seconds <= 5 ? 'is-urgent' : ''}`}>{seconds}</span>
        )}
      </header>

      {/* Both languages stacked, the majority one first and full size. The
          second is quieter so the board reads as one question in two voices
          rather than two competing headlines. */}
      <div className="board__question-group">
        {questions.map((text, i) => (
          <h1 key={text} className={`board__question ${i > 0 ? 'board__question--alt' : ''}`}>
            {text}
          </h1>
        ))}
      </div>

      {view.phase === 'question' ? (
        <section className="board__waiting">
          <p className="board__counter">
            <strong>{round.submitted.length}</strong>{' '}
            {t.boardInCount(round.submitted.length, expected.length)}
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
            <p className="board__counter board__counter--bet">{t.boardAllInWaitingHost}</p>
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
            allTooHighLabel={t.allAnswersTooHigh}
          />

          {revealed ? (
            <section className="board__reveal">
              <p className="board__answer-label">{t.boardAnswer}</p>
              <p className="board__answer">
                {formatAnswer(round.question.answer ?? 0, round.question.format)}
              </p>
              {quips.map((quip, i) =>
                quip ? (
                  <p key={quip} className={`quip quip--board ${i > 0 ? 'quip--alt' : ''}`}>
                    {quip}
                  </p>
                ) : null,
              )}
              {notes.map((note, i) =>
                note ? (
                  <p key={note} className={`board__note ${i > 0 ? 'board__note--alt' : ''}`}>
                    {note}
                  </p>
                ) : null,
              )}
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
                ? t.boardAllIn
                : t.waitingOnNames(waitingOn.map((p) => p.name).join(', '))}
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
