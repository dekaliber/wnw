import type { ClientView } from '../../shared/types.ts'
import { useRequestRestart } from './RestartProvider.tsx'

/**
 * The host's badge, plus the restart control.
 *
 * "Move to betting" / "Reveal answer" used to live here too, but the bottom
 * of the screen is a much better home for it — see `HostAdvanceButton`, which
 * sits in the same footer as the player's own primary action instead of a
 * corner nobody looks at.
 *
 * Restart opens a confirmation instead of acting — hitting it by accident
 * would wipe a game everyone is midway through — but the dialog itself lives
 * in `RestartProvider`, above the phase screens. It cannot live here: each
 * phase renders a different screen, so this component unmounts every time the
 * round advances, which would silently drop an open dialog mid-decision.
 */
export function HostControls({
  view,
  restart = true,
}: {
  view: ClientView
  /** Off where a restart would be redundant — the lobby *is* the settings screen. */
  restart?: boolean
}) {
  const requestRestart = useRequestRestart()
  if (view.hostId !== view.youId) return null

  return (
    <div className="hostbar">
      <span className="hostbar__badge">Host</span>

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
