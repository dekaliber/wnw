import type { ClientView } from '../../shared/types.ts'
import { useRequestRestart } from './RestartProvider.tsx'

/**
 * The host's badge and restart control.
 *
 * Restart is kept small and off to one side, away from the primary action at
 * the bottom of every screen, and opens a confirmation rather than acting —
 * hitting it by accident would wipe a game everyone is midway through. The
 * dialog itself lives in `RestartProvider`, above the phase screens.
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
