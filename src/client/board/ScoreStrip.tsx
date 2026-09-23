import { useLayoutEffect, useRef } from 'react'
import type { Player } from '../../shared/types.ts'
import { prefersReducedMotion, RollingNumber } from './motion.tsx'

export interface StripEntry {
  player: Player
  /** What to show, which during the scoring playthrough lags `player.score`. */
  score: number
}

/**
 * The running totals along the bottom of the board.
 *
 * A score that changes counts to its new value with a brief pop, and a change
 * of order slides everyone to their new place (FLIP: measure, reorder, then
 * animate from the old position back to zero) rather than cutting.
 */
export function ScoreStrip({ entries }: { entries: StripEntry[] }) {
  const items = useRef(new Map<string, HTMLElement>())
  const order = entries.map((e) => e.player.id).join(',')
  const lastOrder = useRef(order)
  const before = useRef<Map<string, DOMRect> | null>(null)

  // Measured during render on purpose: the DOM still shows the old order
  // here, and scores roll (changing widths) right up until the reorder, so
  // positions cached from any earlier commit would be stale.
  if (lastOrder.current !== order) {
    lastOrder.current = order
    before.current = new Map([...items.current].map(([id, el]) => [id, el.getBoundingClientRect()]))
  }

  useLayoutEffect(() => {
    const prevRects = before.current
    before.current = null
    if (!prevRects || prefersReducedMotion()) return

    for (const [id, el] of items.current) {
      const prev = prevRects.get(id)
      if (!prev) continue
      const next = el.getBoundingClientRect()
      const dx = prev.left - next.left
      const dy = prev.top - next.top
      if (!dx && !dy) continue
      // Anyone climbing rises over the people they pass.
      const lift = dx > 0 ? -14 : 8
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: `translate(${dx / 2}px, ${dy / 2 + lift}px)`, offset: 0.5 },
          { transform: 'translate(0, 0)' },
        ],
        { duration: 900, easing: 'cubic-bezier(.45,0,.25,1)' },
      )
    }
  }, [order])

  return (
    <footer className="board__scores">
      {entries.map(({ player, score }) => (
        <span
          key={player.id}
          className="board__score"
          ref={(el) => {
            if (el) items.current.set(player.id, el)
            else items.current.delete(player.id)
          }}
        >
          <span className="dot" style={{ background: player.color }} />
          {player.name}
          <StripScore playerId={player.id} value={score} />
        </span>
      ))}
    </footer>
  )
}

function StripScore({ playerId, value }: { playerId: string; value: number }) {
  const ref = useRef<HTMLElement>(null)
  const last = useRef(value)

  useLayoutEffect(() => {
    const prev = last.current
    last.current = value
    if (prev === value || !ref.current || prefersReducedMotion()) return
    const color = value > prev ? 'var(--win)' : 'var(--lose)'
    ref.current.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.7)', color, offset: 0.3 },
        { transform: 'scale(1)', color },
        { transform: 'scale(1)' },
      ],
      { duration: 900, easing: 'ease-out' },
    )
  }, [value])

  return (
    // The playthrough finds this by id to aim the flying delta at it.
    <strong ref={ref} data-score-for={playerId} className="board__score-value">
      <RollingNumber value={value} duration={600} />
    </strong>
  )
}
