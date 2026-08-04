import type { ClientView } from '../../shared/types.ts'
import { playerById } from '../format.ts'
import type { Game } from '../net.ts'
import { HostControls } from './HostControls.tsx'

export function PhaseHeader({
  game,
  view,
  seconds,
  title,
  subtitle,
}: {
  game: Game
  view: ClientView
  seconds: number | null
  title: string
  subtitle?: string
}) {
  const you = view.youId ? playerById(view, view.youId) : undefined

  return (
    <>
      <HostControls game={game} view={view} />

      <header className="phase-head">
        <div className="phase-head__left">
          <span className="phase-head__title">{title}</span>
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
