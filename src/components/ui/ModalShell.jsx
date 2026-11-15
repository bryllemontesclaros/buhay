import React, { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

/**
 * Shared accessible modal shell component providing:
 * - createPortal rendering to document.body
 * - role="dialog" and aria-modal="true" semantics
 * - Global Escape key listener to close
 * - Safe backdrop click dismissal
 * - Focus trapping (Tab / Shift+Tab)
 * - Automatic focus restoration to previously active element on close
 * - Body scroll locking while open
 */
export default function ModalShell({
  isOpen = true,
  onClose,
  title,
  titleId: customTitleId,
  ariaLabel,
  overlayClassName = '',
  className = '',
  overlayStyle,
  style,
  closeOnEscape = true,
  closeOnBackdrop = true,
  lockScroll = true,
  children,
}) {
  const panelRef = useRef(null)
  const prevActiveElementRef = useRef(null)
  const generatedId = useId()
  const effectiveTitleId = customTitleId || (title ? `modal-title-${generatedId}` : undefined)

  // 1. Manage focus & scroll locking
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return

    prevActiveElementRef.current = document.activeElement

    let origOverflow = ''
    if (lockScroll) {
      origOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }

    const panel = panelRef.current
    if (panel) {
      panel.scrollTop = 0
      // Focus element with autofocus or data-autofocus, else focus the container
      const autoFocusEl = panel.querySelector('[autofocus], [data-autofocus]')
      if (autoFocusEl && typeof autoFocusEl.focus === 'function') {
        try {
          autoFocusEl.focus({ preventScroll: true })
        } catch {
          autoFocusEl.focus()
        }
      } else {
        try {
          panel.focus({ preventScroll: true })
        } catch {
          panel.focus()
        }
      }
    }

    return () => {
      if (lockScroll) {
        document.body.style.overflow = origOverflow
      }
      if (prevActiveElementRef.current && typeof prevActiveElementRef.current.focus === 'function') {
        try {
          prevActiveElementRef.current.focus({ preventScroll: true })
        } catch {
          prevActiveElementRef.current.focus()
        }
      }
    }
  }, [isOpen, lockScroll])

  // 2. Global Escape key handling and Focus Trap
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return

    const handleKeyDown = event => {
      if (closeOnEscape && event.key === 'Escape') {
        event.stopPropagation()
        onClose?.()
        return
      }

      if (event.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (!focusables || focusables.length === 0) return

        const first = focusables[0]
        const last = focusables[focusables.length - 1]

        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            event.preventDefault()
            first.focus()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen, closeOnEscape, onClose])

  if (!isOpen || typeof document === 'undefined') return null

  const handleOverlayClick = event => {
    if (closeOnBackdrop && event.target === event.currentTarget) {
      onClose?.()
    }
  }

  return createPortal(
    <div
      className={overlayClassName}
      style={overlayStyle}
      role="presentation"
      onClick={handleOverlayClick}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={effectiveTitleId}
        aria-label={!effectiveTitleId ? (ariaLabel || title || 'Dialog') : undefined}
        className={className}
        style={style}
        onClick={e => e.stopPropagation()}
      >
        {typeof children === 'function' ? children({ titleId: effectiveTitleId }) : children}
      </div>
    </div>,
    document.body
  )
}

