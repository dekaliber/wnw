import type { ClientView } from '../../shared/types.ts'
import { playerById } from '../format.ts'

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
  const you = view.youId ? playerById(view, view.youId) : undefined

  return (
    <header className="phase-head">
      <div className="phase-head__left">
        <span className="phase-head__title">{title}</span>
        {subtitle && <span className="phase-head__of">{subtitle}</span>}
      </div>

      <div className="phase-head__right">
        {you && (
          <span className="score-pill" style={{ borderColor: you.color }}>
            {you.score} <small>pts</small>
          </span>
        )}
        {seconds !== null && (
          <span className={`timer ${seconds <= 5 ? 'timer--urgent' : ''}`}>{seconds}</span>
        )}
      </div>
    </header>
  )
}
