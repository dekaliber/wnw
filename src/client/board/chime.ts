/**
 * The ten-second warning on the board.
 *
 * Synthesised with WebAudio rather than shipping an audio file — it keeps the
 * app asset-free and lets the tone be tuned in code.
 *
 * The wrinkle is autoplay policy: an AudioContext starts suspended until the
 * page has seen a user gesture, and a board opened straight from
 * `/board?room=ABCD` may never get one. So we expose whether audio is actually
 * running, and the board can prompt for the single click that unlocks it —
 * better than a chime that silently never fires.
 */

import { useEffect, useState } from 'react'

export const CHIME_AT_SECONDS = 10

type AudioContextCtor = typeof AudioContext

function contextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext ??
    null
  )
}

let context: AudioContext | null = null

function ensureContext(): AudioContext | null {
  if (context) return context
  const Ctor = contextCtor()
  if (!Ctor) return null
  try {
    context = new Ctor()
  } catch {
    return null
  }
  return context
}

export function audioReady(): boolean {
  return context?.state === 'running'
}

/** Called on any user gesture; resolves once the browser lets audio run. */
export async function primeAudio(): Promise<void> {
  const ctx = ensureContext()
  if (!ctx || ctx.state === 'running') return
  try {
    await ctx.resume()
  } catch {
    // Still blocked. The board keeps showing its prompt.
  }
}

/**
 * A two-tone bell. Short, bright, and clearly not part of the room's
 * conversation — it has to cut through people shouting at each other.
 */
export function playChime(): void {
  const ctx = ensureContext()
  if (!ctx || ctx.state !== 'running') return

  const start = ctx.currentTime
  const tones: readonly [number, number][] = [
    [988, 0], // B5
    [1319, 0.13], // E6
  ]

  for (const [frequency, delay] of tones) {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.value = frequency

    // Percussive envelope: near-instant attack, exponential decay. Ramping to
    // exactly zero is undefined for exponentialRamp, hence the tiny floor.
    const at = start + delay
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.3, at + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.55)

    oscillator.connect(gain).connect(ctx.destination)
    oscillator.start(at)
    oscillator.stop(at + 0.6)
  }
}

/**
 * Whether sound can actually play, unlocking on the first click or keypress.
 * Returns false while blocked so the board can ask for that one interaction.
 */
export function useAudioUnlock(): boolean {
  const [ready, setReady] = useState(audioReady)

  useEffect(() => {
    if (ready) return

    let cancelled = false
    const attempt = () => {
      void primeAudio().then(() => {
        if (!cancelled && audioReady()) setReady(true)
      })
    }

    // Some contexts (a reloaded page that already had a gesture) allow it
    // outright, so try before waiting on the user.
    attempt()
    window.addEventListener('pointerdown', attempt)
    window.addEventListener('keydown', attempt)

    return () => {
      cancelled = true
      window.removeEventListener('pointerdown', attempt)
      window.removeEventListener('keydown', attempt)
    }
  }, [ready])

  return ready
}
