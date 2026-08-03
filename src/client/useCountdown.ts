import { useEffect, useState } from 'react'
import type { ClientView } from '../shared/types.ts'
import { secondsLeft } from './format.ts'

/**
 * Ticks a phase countdown once a second. Purely cosmetic — the server is what
 * actually ends a phase, so a stalled tab can never cut a round short.
 */
export function useCountdown(view: ClientView | null, serverNow: () => number): number | null {
  const [seconds, setSeconds] = useState<number | null>(null)

  useEffect(() => {
    if (!view || view.phaseEndsAt === null) {
      setSeconds(null)
      return
    }
    const tick = () => setSeconds(secondsLeft(view, serverNow()))
    tick()
    const timer = setInterval(tick, 250)
    return () => clearInterval(timer)
  }, [view, serverNow])

  return seconds
}
