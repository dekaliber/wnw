import type { ClientView } from '../../shared/types.ts'
import { Mat } from '../Mat.tsx'
import { contestants, expectedActors, formatAnswer, standings } from '../format.ts'
import { localisedQuip, questionNote, questionText } from '../i18n/content.ts'
import type { Game } from '../net.ts'
import { useCountdown } from '../useCountdown.ts'
import { boardLocales, boardStrings, inEachLocale } from './useBoardLocales.ts'
import { useTimerChime } from './useTimerChime.ts'
import { ScoreStrip, type StripEntry } from './ScoreStrip.tsx'
import {
  RoundSummary,
  ScoringTally,
  ScoringTeaser,
  useScoringPlaythrough,
} from './ScoringPlaythrough.tsx'
import { REVEAL_STEP_MS, standingsBefore } from './scoringTimeline.ts'

export function BoardRound({ game, view }: { game: Game; view: ClientView }) {
  const round = view.round!
  const seconds = useCountdown(view, game.serverNow)
  const revealed = view.phase === 'reveal'

  useTimerChime(seconds, `${view.phase}-${round.number}`)

  // Scores arrive already settled; the playthrough holds the strip at the
  // pre-round totals and releases each player's as their result lands.
  const playthrough = useScoringPlaythrough(view)
  const strip: StripEntry[] =
    playthrough && !playthrough.reordered
      ? standingsBefore(contestants(view), playthrough.scorings).map((player) => {
          const s = playthrough.scorings.find((x) => x.playerId === player.id)
          const settled = !s || playthrough.landed.has(player.id)
          return { player, score: settled ? player.score : s.before }
        })
      : standings(view).map((player) => ({ player, score: player.score }))
  const tallying = Boolean(playthrough && !playthrough.reordered)

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
    <main className={`board board--round board--${view.phase}`}>
      <header className={`board__head ${revealed ? 'board__head--reveal' : ''}`}>
        {round.isPractice ? (
          <span className="board__round">
            <span className="practice-badge practice-badge--board">{t.practiceQuestion}</span>
            <em> {t.practiceNoScore}</em>
          </span>
        ) : (
          <span className="board__round">
            {round.isTiebreak ? t.suddenDeath : t.questionN(round.number)}
            {!round.isTiebreak && <em> {t.ofN(view.config.totalRounds)}</em>}
          </span>
        )}
        {revealed ? (
          // Still there to refer back to, but the reveal needs the headline
          // space for the scoring.
          <div className="board__head-question">
            {questions.map((text, i) => (
              <h1
                key={text}
                className={`board__head-q ${i > 0 ? 'board__head-q--alt' : ''}`}
              >
                {text}
              </h1>
            ))}
          </div>
        ) : (
          seconds !== null && (
            <span className={`board__timer ${seconds <= 5 ? 'is-urgent' : ''}`}>{seconds}</span>
          )
        )}
      </header>

      {/* Both languages stacked, the majority one first and full size. The
          second is quieter so the board reads as one question in two voices
          rather than two competing headlines. */}
      {!revealed && (
        <div className="board__question-group">
          {questions.map((text, i) => (
            <h1 key={text} className={`board__question ${i > 0 ? 'board__question--alt' : ''}`}>
              {text}
            </h1>
          ))}
        </div>
      )}

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
          {/* The reveal comes in a step at a time — mat, then the answer, the
              quip, and only then the tally — so the room reads one thing at
              once instead of everything landing together. */}
          {revealed && (
            <section className="board__reveal">
              <p
                className="board__answer-label reveal-step"
                style={stepDelay(REVEAL_STEP_MS.answer)}
              >
                {t.boardAnswer}
              </p>
              <p className="board__answer reveal-step" style={stepDelay(REVEAL_STEP_MS.answer)}>
                {formatAnswer(round.question.answer ?? 0, round.question.format)}
              </p>
              {quips.map((quip, i) =>
                quip ? (
                  <p
                    key={quip}
                    className={`quip quip--board reveal-step ${i > 0 ? 'quip--alt' : ''}`}
                    style={stepDelay(REVEAL_STEP_MS.quip)}
                  >
                    {quip}
                  </p>
                ) : null,
              )}
              {notes.map((note, i) =>
                note ? (
                  <p
                    key={note}
                    className={`board__note reveal-step ${i > 0 ? 'board__note--alt' : ''}`}
                    style={stepDelay(REVEAL_STEP_MS.quip)}
                  >
                    {note}
                  </p>
                ) : null,
              )}
            </section>
          )}

          <Mat
            view={view}
            slots={round.slots}
            bets={round.bets}
            winningSlotIndex={revealed ? round.result?.winningSlotIndex : null}
            // Chips stay anonymous while betting is live: you can see a slot
            // getting crowded without knowing who is piling on.
            anonymousChips={!revealed}
            allTooHighLabel={t.allAnswersTooHigh}
            winnerLabel={t.slotWinner}
            spotlight={
              playthrough?.current
                ? {
                    playerId: playthrough.current.playerId,
                    chips: playthrough.current.bets
                      .slice(0, playthrough.betsShown)
                      .flatMap((b) => b.chips),
                  }
                : null
            }
          />

          {revealed ? (
            !round.isTiebreak && (
              // Fixed-height band, so the score strip does not jump as lines arrive.
              <section className="board__tally reveal-step" style={stepDelay(REVEAL_STEP_MS.tally)}>
                {playthrough?.intro ? (
                  <ScoringTeaser waiting={!round.scoring} t={t} />
                ) : playthrough && tallying ? (
                  <ScoringTally view={view} frame={playthrough} t={t} />
                ) : (
                  <RoundSummary view={view} t={t} />
                )}
              </section>
            )
          ) : (
            <div className="board__bet-status">
              <p className="board__counter board__counter--bet">
                {waitingOn.length === 0
                  ? t.boardAllIn
                  : t.waitingOnNames(waitingOn.map((p) => p.name).join(', '))}
              </p>
              {/* Betting only ends when the host reveals the answer, so once
                  everyone is in, say who the room is waiting on — the same
                  line the scoring teaser uses. */}
              {waitingOn.length === 0 && (
                <p className="board__host-hint">{t.waitingForHostShort}</p>
              )}
            </div>
          )}
        </>
      )}

      <ScoreStrip entries={strip} />
    </main>
  )
}

/** Holds a reveal element back until its turn; see `.reveal-step`. */
const stepDelay = (ms: number) => ({ animationDelay: `${ms}ms` })
