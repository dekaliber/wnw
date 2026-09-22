import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n/LocaleProvider.tsx'
import type { Status } from '../net.ts'

/**
 * What a phone shows while it is not really in the game.
 *
 * The alternative was holding taps and replaying them, which cannot be made
 * safe: a guess is legal in any question phase and every round has one, so a
 * held tap can land on the next round's question with the server none the
 * wiser. Saying "not now" up front is both simpler and more honest than
 * accepting a tap and quietly deciding later whether it counted.
 *
 * So this covers the screen rather than annotating it. A player who cannot see
 * that they are disconnected will keep tapping and conclude the game is
 * broken; one who can see it waits. The dimmed board stays visible behind —
 * it is still the truth, just a few seconds stale.
 */

/**
 * How long "Back in" stays up once the socket returns.
 *
 * Deliberately not instant. The point is to answer the question the player is
 * already asking — *did it come back?* — and an acknowledgement that appears
 * and vanishes inside a couple of frames reads as a glitch rather than an
 * answer. Long enough to register, short enough to never be in the way.
 */
const RECONNECTED_MS = 1_200

/**
 * One value rather than two booleans, deliberately.
 *
 * Deriving "show the tick" from `!offline && justCameBack` leaves a render
 * where neither is true — the overlay unmounts for a frame and remounts, which
 * restarts its entry animation and flashes the card in from nothing. Holding a
 * single mode means the element is never torn down between the two states.
 */
type Mode = 'hidden' | 'offline' | 'settled'

export function ConnectionOverlay({ status, active }: { status: Status; active: boolean }) {
  const t = useT()
  const offline = active && (status === 'connecting' || status === 'reconnecting')

  const [mode, setMode] = useState<Mode>('hidden')
  const wasOffline = useRef(false)

  useEffect(() => {
    if (offline) {
      wasOffline.current = true
      setMode('offline')
      return
    }
    // Only acknowledge a return, never the first connection of the session.
    if (!wasOffline.current) {
      setMode('hidden')
      return
    }
    wasOffline.current = false
    setMode('settled')
    const timer = setTimeout(() => setMode('hidden'), RECONNECTED_MS)
    return () => clearTimeout(timer)
  }, [offline])

  if (mode === 'hidden') return null

  // `offline` leads `mode` by a render, since mode is set from an effect. Take
  // the live value too, so the card can never say "back in" over a screen that
  // is still dimmed — and so a connection that drops again mid-acknowledgement
  // goes straight back to waiting instead of finishing the lap.
  const waiting = offline || mode === 'offline'

  return (
    <div className={`connection ${waiting ? 'connection--offline' : 'connection--settled'}`}>
      {/*
        `alert` rather than `status`: this interrupts, and a screen reader
        should say so without waiting for a pause.
      */}
      <div className="connection__card" role="alert" aria-live="assertive">
        {waiting ? (
          <>
            <span className="connection__spinner" aria-hidden="true" />
            <strong className="connection__title">{t.reconnecting}</strong>
            <span className="connection__hint">{t.reconnectingHint}</span>
          </>
        ) : (
          <>
            <span className="connection__tick" aria-hidden="true">
              ✓
            </span>
            <strong className="connection__title">{t.reconnected}</strong>
          </>
        )}
      </div>
    </div>
  )
}
