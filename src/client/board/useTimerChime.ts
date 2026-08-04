import { useEffect, useRef } from 'react'
import { CHIME_AT_SECONDS, playChime } from './chime.ts'

/**
 * Sounds the warning once as the countdown crosses ten seconds.
 *
 * Arms only after seeing a value above the threshold, so a phase that is
 * already inside ten seconds — a board opened late, or a reconnect — does not
 * fire immediately. `phaseKey` re-arms it for each new phase, and the crossing
 * is detected by comparison rather than equality because a throttled tab can
 * skip straight from 12 to 8 without ever rendering 10.
 */
export function useTimerChime(seconds: number | null, phaseKey: string): void {
  const armed = useRef(false)
  const key = useRef(phaseKey)

  useEffect(() => {
    if (key.current !== phaseKey) {
      key.current = phaseKey
      armed.current = false
    }

    if (seconds === null) {
      armed.current = false
      return
    }

    if (seconds > CHIME_AT_SECONDS) {
      armed.current = true
      return
    }

    // Ignore an expired clock: the phase is over, nothing left to warn about.
    if (seconds <= 0) return

    if (armed.current) {
      armed.current = false
      playChime()
    }
  }, [seconds, phaseKey])
}
