import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import styles from './DetailsModal.module.css'

export default function DetailsModal({ open, title, subtitle, onClose, children }) {
  const panelRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    if (!panel) return

    // Always start at the top so "blank sheet until scroll" never happens.
    panel.scrollTop = 0

    // Minimal focus management so mobile Safari doesn’t keep focus on the trigger button.
    try {
      panel.focus({ preventScroll: true })
    } catch {
      panel.focus()
    }
  }, [open])

  if (!open) return null

  const modal = (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={event => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <section
        ref={panelRef}
        tabIndex={-1}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Details'}
        onClick={event => event.stopPropagation()}
        onKeyDown={event => {
          if (event.key === 'Escape') onClose?.()
        }}
      >
        <div className={styles.header}>
          <div className={styles.headerCopy}>
            <div id={titleId} className={styles.title}>{title}</div>
            {subtitle ? <div className={styles.subtitle}>{subtitle}</div> : null}
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close details">
            Done
          </button>
        </div>
        <div className={styles.body}>
          {children}
        </div>
      </section>
    </div>
  )

  // Portaling to <body> avoids mobile Safari/transform stacking bugs where `position: fixed`
  // elements act like they’re positioned inside the scrolling container.
  if (typeof document !== 'undefined') {
    return createPortal(modal, document.body)
  }

  return modal
}
