import { useEffect, useState } from 'react'
import type { ClientView } from '../../shared/types.ts'
import { expectedActors, formatAnswer } from '../format.ts'
import { questionText } from '../i18n/content.ts'
import { useLocale } from '../i18n/LocaleProvider.tsx'
import type { Game } from '../net.ts'
import { useCountdown } from '../useCountdown.ts'
import { HostAdvanceButton } from './HostAdvanceButton.tsx'
import { PhaseHeader } from './PhaseHeader.tsx'

/**
 * A purpose-built keypad rather than the system keyboard: it never covers half
 * the screen, it cannot produce a non-numeric answer, and the keys are big
 * enough to hit while laughing at someone.
 */
export function GuessScreen({ game, view }: { game: Game; view: ClientView }) {
  const { locale, t } = useLocale()
  const round = view.round!
  const seconds = useCountdown(view, game.serverNow)
  const [draft, setDraft] = useState('')

  const submitted = round.yourGuess !== null
  const tiebreakBystander = round.isTiebreak && !view.winnerIds.includes(view.youId ?? '')
  const isHost = view.hostId === view.youId

  // Clear the pad when a new question starts.
  useEffect(() => setDraft(''), [round.number])

  const press = (key: string) => {
    setDraft((current) => {
      if (key === 'del') return current.slice(0, -1)
      if (key === '.') return current.includes('.') ? current : (current || '0') + '.'
      if (key === '-') return current.startsWith('-') ? current.slice(1) : '-' + current
      if (current.replace(/[-.]/g, '').length >= 12) return current
      return current + key
    })
  }

  const value = Number(draft)
  const valid = draft !== '' && draft !== '-' && Number.isFinite(value)

  if (tiebreakBystander) {
    return (
      <main className="screen">
        <PhaseHeader view={view} seconds={seconds} title={t.suddenDeath} />
        <p className="waiting">
          {t.tiebreakBystander}
        </p>
        {/* The host might not be one of the tied leaders and so never guesses
            here themselves — this is their only way to move things along. */}
        {isHost && (
          <div className="bottom-actions">
            <HostAdvanceButton game={game} view={view} />
          </div>
        )}
      </main>
    )
  }

  return (
    <main className="screen screen--guess">
      <PhaseHeader
        view={view}
        seconds={seconds}
        title={round.isTiebreak ? t.suddenDeath : t.questionN(round.number)}
        subtitle={
          round.isTiebreak || round.isPractice ? undefined : t.ofN(view.config.totalRounds)
        }
      />

      <p className="question">{questionText(round.question, locale)}</p>

      {submitted ? (
        <>
          <section className="locked-in">
            <p className="locked-in__label">{t.yourGuess}</p>
            <p className="locked-in__value">
              {round.yourGuess !== null && formatAnswer(round.yourGuess, round.question.format)}
            </p>
            <p className="waiting">
              {t.inWaitingForRest(round.submitted.length, expectedActors(view).length)}
            </p>
          </section>
          {/* Nothing left for this player to do, so — for the host — this is
              where the "move on" action gets to be the only thing at the
              bottom, not a corner afterthought. */}
          {isHost && (
            <div className="bottom-actions">
              <HostAdvanceButton game={game} view={view} />
            </div>
          )}
        </>
      ) : (
        <>
          <div className="readout" aria-live="polite">
            {draft || <span className="readout__placeholder">{t.guessPlaceholder}</span>}
          </div>

          <p className="hint hint--tight">{t.closestWithoutGoingOver}</p>

          <div className="keypad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'].map((key) => (
              <button
                key={key}
                type="button"
                className={`keypad__key ${key === 'del' ? 'keypad__key--del' : ''}`}
                onClick={() => press(key)}
              >
                {key === 'del' ? '⌫' : key}
              </button>
            ))}
          </div>

          {/* The host's own guess stays the true primary action — closest to
              the thumb — with "move on" stacked just above it rather than
              replacing it, since the host is a player here too. */}
          <div className="bottom-actions">
            {isHost && <HostAdvanceButton game={game} view={view} />}
            <button
              className="btn btn--primary"
              disabled={!valid}
              onClick={() => game.send({ t: 'guess', value })}
            >
              {/* Through formatAnswer, like everywhere else a number is shown:
                  a year must read 1989, not 1,989. */}
              {valid ? t.lockInValue(formatAnswer(value, round.question.format)) : t.lockIn}
            </button>
          </div>
        </>
      )}
    </main>
  )
}
