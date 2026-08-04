import { useEffect, useState } from 'react'
import type { ClientView } from '../../shared/types.ts'
import { expectedActors } from '../format.ts'
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
        <PhaseHeader view={view} seconds={seconds} title="Sudden death" />
        <p className="waiting">
          The leaders are tied. They are settling it — closest without going over.
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
        title={round.isTiebreak ? 'Sudden death' : `Question ${round.number}`}
        subtitle={round.isTiebreak ? undefined : `of ${view.config.totalRounds}`}
      />

      <p className="question">{round.question.text}</p>

      {submitted ? (
        <>
          <section className="locked-in">
            <p className="locked-in__label">Your guess</p>
            <p className="locked-in__value">{round.yourGuess?.toLocaleString()}</p>
            <p className="waiting">
              {round.submitted.length} of {expectedActors(view).length} in — waiting for the
              rest…
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
            {draft || <span className="readout__placeholder">Your guess</span>}
          </div>

          <p className="hint hint--tight">Closest without going over wins the slot.</p>

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
              Lock in {valid ? value.toLocaleString() : ''}
            </button>
          </div>
        </>
      )}
    </main>
  )
}
