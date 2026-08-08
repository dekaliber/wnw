import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '../i18n/LocaleProvider.tsx'

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
export function Rules({ onClose }: { onClose: () => void }) {
  const t = useT()
  const track = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)

  const pages = t.rules

  const goTo = useCallback(
    (index: number) => {
      const el = track.current
      if (!el) return
      const clamped = Math.max(0, Math.min(pages.length - 1, index))
      el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' })
    },
    [pages.length],
  )

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

  const last = page === pages.length - 1

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={t.rulesTitle}>
      <div className="modal__scrim" onClick={onClose} />

      <div className="modal__card rules">
        <button type="button" className="rules__close" onClick={onClose} aria-label={t.close}>
          ×
        </button>

        <div className="rules__track" ref={track} onScroll={onScroll}>
          {pages.map((p) => (
            <section className="rules__page" key={p.step}>
              <p className="rules__step">{p.step}</p>
              <h2 className="rules__title">{p.title}</h2>
              <p className="rules__body">{p.body}</p>
            </section>
          ))}
        </div>

        <div className="rules__dots">
          {pages.map((p, i) => (
            <button
              key={p.step}
              type="button"
              className={`rules__dot ${i === page ? 'is-current' : ''}`}
              onClick={() => goTo(i)}
              aria-label={`${i + 1}`}
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
            {t.back}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => (last ? onClose() : goTo(page + 1))}
          >
            {last ? t.gotIt : t.next}
          </button>
        </div>
      </div>
    </div>
  )
}
