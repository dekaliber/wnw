import { createContext, useContext, useState, type ReactNode } from 'react'
import { Confirm } from '../Confirm.tsx'
import type { ClientView } from '../../shared/types.ts'
import type { Game } from '../net.ts'

/**
 * Owns the restart confirmation above the phase screens.
 *
 * The dialog cannot live inside `HostControls`: each phase renders a different
 * screen, so when a round advances — a timer expiring, everyone locking in —
 * that subtree unmounts and the open dialog disappears mid-decision. Holding
 * the state here keeps it up until the host actually answers it.
 */

const RestartContext = createContext<(() => void) | null>(null)

export const useRequestRestart = () => useContext(RestartContext)

export function RestartProvider({
  game,
  view,
  children,
}: {
  game: Game
  view: ClientView
  children: ReactNode
}) {
  const [confirming, setConfirming] = useState(false)
  const midGame = view.phase !== 'lobby' && view.phase !== 'gameover'

  return (
    <RestartContext.Provider value={() => setConfirming(true)}>
      {children}
      {confirming && (
        <Confirm
          title="Restart the game?"
          body={
            midGame
              ? `This ends question ${view.round?.number ?? 1} and sends everyone back to the settings screen. All scores are cleared.`
              : 'Everyone goes back to the settings screen and all scores are cleared.'
          }
          confirmLabel="Restart"
          onConfirm={() => {
            game.send({ t: 'rematch' })
            setConfirming(false)
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </RestartContext.Provider>
  )
}
