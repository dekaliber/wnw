import { createContext, useContext, useState, type ReactNode } from 'react'
import { Confirm } from '../Confirm.tsx'
import type { ClientView } from '../../shared/types.ts'
import { useT } from '../i18n/LocaleProvider.tsx'
import type { Game } from '../net.ts'

/**
 * Owns the restart confirmation above the phase screens.
 *
 * The dialog cannot live inside `HostControls`: each phase renders a different
 * screen, so when a round advances — a timer expiring, the host moving on —
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
  const t = useT()
  const [confirming, setConfirming] = useState(false)
  const midGame = view.phase !== 'lobby' && view.phase !== 'gameover'

  return (
    <RestartContext.Provider value={() => setConfirming(true)}>
      {children}
      {confirming && (
        <Confirm
          title={t.restartTitle}
          body={midGame ? t.restartBodyMid(view.round?.number ?? 1) : t.restartBodyIdle}
          confirmLabel={t.restart}
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
