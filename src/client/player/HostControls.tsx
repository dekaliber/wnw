import type { ClientView } from '../../shared/types.ts'
import { actedCount, expectedActors } from '../format.ts'
import type { Game } from '../net.ts'
import { useRequestRestart } from './RestartProvider.tsx'

/**
 * The host's badge, and their controls for driving the game along.
 *
 * Guessing and betting never advance on their own once everyone has acted —
 * only the clock or the host can end those phases. A phone that fell asleep
 * would otherwise miss its turn the instant the room reconnects and finishes
 * without it, since "everyone connected has gone" briefly looks like "everyone
 * has gone". Advancing early is now always a deliberate call by the host, who
 * can see how many are still out and choose to wait for them.
 *
 * Restart opens a confirmation instead of acting — hitting it by accident
 * would wipe a game everyone is midway through — but the dialog itself lives
 * in `RestartProvider`, above the phase screens. It cannot live here: each
 * phase renders a different screen, so this component unmounts every time the
 * round advances, which would silently drop an open dialog mid-decision.
 */
export function HostControls({
  game,
  view,
  restart = true,
}: {
  game: Game
  view: ClientView
  /** Off where a restart would be redundant — the lobby *is* the settings screen. */
  restart?: boolean
}) {
  const requestRestart = useRequestRestart()
  if (view.hostId !== view.youId) return null

  const canAdvance = view.phase === 'question' || view.phase === 'betting'
  const acted = canAdvance ? actedCount(view) : 0
  const total = canAdvance ? expectedActors(view).length : 0
  const everyoneIn = canAdvance && total > 0 && acted >= total

  return (
    <div className="hostbar">
      <div className="hostbar__left">
        <span className="hostbar__badge">Host</span>
        {canAdvance && (
          <button
            type="button"
            className={`hostbar__advance ${everyoneIn ? 'is-ready' : ''}`}
            onClick={() => game.send({ t: 'advance' })}
          >
            {view.phase === 'question' ? 'Move to betting' : 'Reveal answer'}
            <span className="hostbar__advance-count">
              {acted}/{total}
            </span>
          </button>
        )}
      </div>

      {restart && requestRestart && (
        <button
          type="button"
          className="hostbar__restart"
          onClick={requestRestart}
          aria-label="Restart the game"
          title="Restart the game"
        >
          ⟲
        </button>
      )}
    </div>
  )
}
