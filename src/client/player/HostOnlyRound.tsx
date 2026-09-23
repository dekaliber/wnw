import type { ClientView } from '../../shared/types.ts'
import { expectedActors } from '../format.ts'
import { questionText } from '../i18n/content.ts'
import { useLocale } from '../i18n/LocaleProvider.tsx'
import type { Game } from '../net.ts'
import { useCountdown } from '../useCountdown.ts'
import { HostAdvanceButton } from './HostAdvanceButton.tsx'
import { PhaseHeader } from './PhaseHeader.tsx'

/**
 * The guessing and betting phases for a host who is running the game without
 * playing it. There is nothing for them to enter, so the screen is given over
 * to what they do need: the question, who is still going, and the button that
 * moves everyone on.
 */
export function HostOnlyRound({ game, view }: { game: Game; view: ClientView }) {
  const { locale, t } = useLocale()
  const round = view.round!
  const seconds = useCountdown(view, game.serverNow)
  const guessing = view.phase === 'question'
  const acted = new Set(guessing ? round.submitted : round.locked)

  return (
    <main className="screen">
      <PhaseHeader
        view={view}
        seconds={seconds}
        title={round.isTiebreak ? t.suddenDeath : t.questionN(round.number)}
        subtitle={
          round.isTiebreak || round.isPractice ? undefined : t.ofN(view.config.totalRounds)
        }
      />

      <p className="question">{questionText(round.question, locale)}</p>
      <p className="hint hint--tight">{t.hostOnlyRunning}</p>

      <section className="panel">
        <h2 className="panel__title">
          {round.isTiebreak
            ? t.tiebreakBystander
            : guessing
              ? t.hostOnlyGuessing
              : t.hostOnlyBetting}
        </h2>
        <ul className="players">
          {expectedActors(view).map((p) => (
            <li key={p.id}>
              <span className="dot" style={{ background: p.color }} />
              <span className="players__name">{p.name}</span>
              {acted.has(p.id) ? (
                <span className="tag tag--ready">{t.actedIn}</span>
              ) : (
                <span className="tag tag--waiting">{t.actedPending}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="bottom-actions">
        <HostAdvanceButton game={game} view={view} />
      </div>
    </main>
  )
}
