import type { ClientView } from '../../shared/types.ts'
import { playerById } from '../format.ts'
import { useT } from '../i18n/LocaleProvider.tsx'
import { HostControls } from './HostControls.tsx'

export function PhaseHeader({
  view,
  seconds,
  title,
  subtitle,
}: {
  view: ClientView
  seconds: number | null
  title: string
  subtitle?: string
}) {
  const t = useT()
  const you = view.youId ? playerById(view, view.youId) : undefined
  // Decided here rather than by each screen, so no phase of the practice
  // round can forget to say it does not count.
  const practice = Boolean(view.round?.isPractice)

  return (
    <>
      <HostControls view={view} />

      <header className="phase-head">
        <div className="phase-head__left">
          {practice ? (
            <span className="practice-badge">{t.practiceQuestion}</span>
          ) : (
            <span className="phase-head__title">{title}</span>
          )}
          {subtitle && <span className="phase-head__of">{subtitle}</span>}
        </div>

        <div className="phase-head__right">
          {you && (
            <span className="score-pill" style={{ borderColor: you.color }}>
              {you.score} <small>chips</small>
            </span>
          )}
          {seconds !== null && (
            <span className={`timer ${seconds <= 5 ? 'timer--urgent' : ''}`}>{seconds}</span>
          )}
        </div>
      </header>
    </>
  )
}
