import { useEffect, useRef } from 'react'
import { useT } from './i18n/LocaleProvider.tsx'

/**
 * A deliberate speed bump for actions that would wreck a game in progress.
 *
 * Built in-app rather than using `window.confirm`, which on iOS Safari can be
 * suppressed entirely — a confirmation that silently does not appear is worse
 * than none, since the caller would proceed as if it had been accepted.
 *
 * The cancel button takes focus so a stray Return dismisses rather than
 * confirms.
 *
 * `nudge` is for the gentler case: nothing breaks if they carry on, but going
 * back is the better move, so going back is the highlighted button.
 */
export function Confirm({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  cancelLabel,
  tone = 'danger',
}: {
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  cancelLabel?: string
  tone?: 'danger' | 'nudge'
}) {
  const t = useT()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
      {/* Tapping the backdrop cancels, never confirms. */}
      <div className="modal__scrim" onClick={onCancel} />
      <div className="modal__card">
        <h2 className="modal__title">{title}</h2>
        <p className="modal__body">{body}</p>
        <div className="modal__actions">
          <button
            ref={cancelRef}
            type="button"
            className={`btn ${tone === 'nudge' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={onCancel}
          >
            {cancelLabel ?? t.cancel}
          </button>
          <button
            type="button"
            className={`btn ${tone === 'nudge' ? 'btn--ghost' : 'btn--danger'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
