import { useEffect, useRef, useState } from 'react'

/**
 * The stylesheet already flattens CSS animations under reduced motion, but
 * anything driven from script — Web Animations, rAF counters — has to ask.
 */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * A number that counts to its new value instead of jumping. Mounts showing
 * `from` when given, so a freshly revealed figure can roll up from zero.
 */
export function RollingNumber({
  value,
  from,
  duration = 700,
  format = String,
}: {
  value: number
  from?: number
  duration?: number
  format?: (n: number) => string
}) {
  const [shown, setShown] = useState(from ?? value)
  // Read by the next roll, so interrupting one carries on from where it got to.
  const shownRef = useRef(shown)

  useEffect(() => {
    const start = shownRef.current
    if (start === value) return
    if (prefersReducedMotion()) {
      shownRef.current = value
      setShown(value)
      return
    }

    let frame = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      const eased = 1 - (1 - p) ** 3
      const next = Math.round(start + (value - start) * eased)
      shownRef.current = next
      setShown(next)
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    // Browsers stop running rAF for a hidden tab. Without this a board that
    // was backgrounded mid-roll would sit on a half-counted score for good.
    const settle = setTimeout(() => {
      cancelAnimationFrame(frame)
      shownRef.current = value
      setShown(value)
    }, duration + 100)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(settle)
    }
  }, [value, duration])

  return <>{format(shown)}</>
}

export const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0')
