import { useEffect, useState } from 'react'
import type { ClientView } from '../../shared/types.ts'
import type { Game } from '../net.ts'
import { useCountdown } from '../useCountdown.ts'
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
        <section className="locked-in">
          <p className="locked-in__label">Your guess</p>
          <p className="locked-in__value">{round.yourGuess?.toLocaleString()}</p>
          <p className="waiting">
            {round.submitted.length} of {expected(view)} in — waiting for the rest…
          </p>
        </section>
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

          <button
            className="btn btn--primary btn--fixed"
            disabled={!valid}
            onClick={() => game.send({ t: 'guess', value })}
          >
            Lock in {valid ? value.toLocaleString() : ''}
          </button>
        </>
      )}
    </main>
  )
}

function expected(view: ClientView): number {
  const active = view.players.filter((p) => p.connected)
  if (view.round?.isTiebreak) return active.filter((p) => view.winnerIds.includes(p.id)).length
  return active.length
}
