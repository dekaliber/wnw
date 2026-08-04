import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * The five-card "how to play", shown from the lobby while waiting to start.
 *
 * Paging is a CSS scroll-snap track rather than hand-rolled touch handlers:
 * swiping gets the platform's own momentum and rubber-banding for free, works
 * with a trackpad and a mouse wheel, and cannot fight the browser the way a
 * homemade drag usually does. Arrows and dots are there for the laptop.
 *
 * Deliberately silent on anything the game does for you — how guesses are
 * sorted, which slot is left open on an even count. Nobody needs to know the
 * rules a computer is already following.
 */

interface Page {
  step: string
  title: string
  body: string
}

const PAGES: Page[] = [
  {
    step: 'The idea',
    title: 'Nobody has to know anything',
    body: 'Every question has a number for an answer, and nobody expects you to know it. You write a guess, then bet on whichever guess looks best — including someone else’s. Most chips at the end wins.',
  },
  {
    step: 'Step 1',
    title: 'Write a guess',
    body: 'A question appears and you tap in a number. All the guesses then line up on the board, smallest to largest. The one that wins is the closest to the real answer without going over — so overshooting is worth nothing.',
  },
  {
    step: 'Step 2',
    title: 'Place your chips',
    body: 'You get two chips. Put both on one guess, or split them across two — and betting on your own guess is entirely allowed. If you reckon everyone overshot, there is a slot for that too.',
  },
  {
    step: 'Step 3',
    title: 'Raise, if you dare',
    body: 'Each slot pays different odds: the middle pays 2 to 1, the outer edges up to 6 to 1, because the safe-looking guess is worth less. On top of a chip you can raise, staking chips you have already won. Your two chips always come back — only what you raise can be lost.',
  },
  {
    step: 'Step 4',
    title: 'Collect',
    body: 'Bet on the winning slot and you get your stake back plus the odds, so 4 chips at 3 to 1 pays 12. If your own guess is the one that won, you collect 3 bonus chips on top. Highest pile after the last question takes it.',
  },
]

export function Rules({ onClose }: { onClose: () => void }) {
  const track = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)

  const goTo = useCallback((index: number) => {
    const el = track.current
    if (!el) return
    const clamped = Math.max(0, Math.min(PAGES.length - 1, index))
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' })
  }, [])

  // The scroll position is the source of truth, so a swipe and a button press
  // converge on the same state instead of drifting apart.
  const onScroll = () => {
    const el = track.current
    if (!el || el.clientWidth === 0) return
    setPage(Math.round(el.scrollLeft / el.clientWidth))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') goTo(page + 1)
      if (e.key === 'ArrowLeft') goTo(page - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, goTo, page])

  const last = page === PAGES.length - 1

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="How to play">
      <div className="modal__scrim" onClick={onClose} />

      <div className="modal__card rules">
        <button type="button" className="rules__close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="rules__track" ref={track} onScroll={onScroll}>
          {PAGES.map((p) => (
            <section className="rules__page" key={p.step}>
              <p className="rules__step">{p.step}</p>
              <h2 className="rules__title">{p.title}</h2>
              <p className="rules__body">{p.body}</p>
            </section>
          ))}
        </div>

        <div className="rules__dots">
          {PAGES.map((p, i) => (
            <button
              key={p.step}
              type="button"
              className={`rules__dot ${i === page ? 'is-current' : ''}`}
              onClick={() => goTo(i)}
              aria-label={`Page ${i + 1}`}
              aria-current={i === page}
            />
          ))}
        </div>

        <div className="rules__nav">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => goTo(page - 1)}
            disabled={page === 0}
          >
            Back
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => (last ? onClose() : goTo(page + 1))}
          >
            {last ? 'Got it' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
