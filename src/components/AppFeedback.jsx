import { useEffect, useRef, useState } from 'react'
import styles from './AppFeedback.module.css'

const DEFAULT_TOAST = {
  title: 'Heads up',
  message: '',
  tone: 'info',
}

const DEFAULT_CONFIRM = {
  title: 'Are you sure?',
  message: '',
  confirmLabel: 'Continue',
  cancelLabel: 'Cancel',
  tone: 'default',
}

export default function AppFeedback() {
  const [toast, setToast] = useState(null)
  const [confirmState, setConfirmState] = useState(null)
  const toastTimerRef = useRef(null)
  const confirmResolveRef = useRef(null)

  function clearToastTimer() {
    if (!toastTimerRef.current) return
    window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = null
  }

  function dismissToast() {
    clearToastTimer()
    setToast(null)
  }

  function resolveConfirm(answer) {
    confirmResolveRef.current?.(answer)
    confirmResolveRef.current = null
    setConfirmState(null)
  }

  useEffect(() => {
    window.__takdaFeedbackReady = true

    function handleNotify(event) {
      const detail = { ...DEFAULT_TOAST, ...(event.detail || {}) }
      clearToastTimer()
      setToast(detail)
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null)
        toastTimerRef.current = null
      }, detail.duration || 3600)
    }

    function handleConfirm(event) {
      confirmResolveRef.current?.(false)
      confirmResolveRef.current = event.detail?.resolve || null
      setConfirmState({ ...DEFAULT_CONFIRM, ...(event.detail || {}) })
    }

    window.addEventListener('takda:notify', handleNotify)
    window.addEventListener('takda:confirm', handleConfirm)

    return () => {
      window.__takdaFeedbackReady = false
      clearToastTimer()
      confirmResolveRef.current?.(false)
      confirmResolveRef.current = null
      window.removeEventListener('takda:notify', handleNotify)
      window.removeEventListener('takda:confirm', handleConfirm)
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key !== 'Escape') return
      if (confirmState) resolveConfirm(false)
      else if (toast) dismissToast()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [confirmState, toast])

  return (
    <>
      {toast && (
        <div className={styles.toastWrap}>
          <div className={`${styles.toast} ${styles[`tone${capitalizeTone(toast.tone)}`] || ''}`} role="status" aria-live="polite">
            <div className={styles.toastCopy}>
              {toast.title && <div className={styles.toastTitle}>{toast.title}</div>}
              {toast.message && <div className={styles.toastMessage}>{toast.message}</div>}
            </div>
            <button type="button" className={styles.toastClose} onClick={dismissToast} aria-label="Dismiss message">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {confirmState && (
        <div className={styles.confirmOverlay} role="presentation" onClick={() => resolveConfirm(false)}>
          <div
            className={`${styles.confirmSheet} ${styles[`tone${capitalizeTone(confirmState.tone)}`] || ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="takda-confirm-title"
            aria-describedby={confirmState.message ? 'takda-confirm-message' : undefined}
            onClick={event => event.stopPropagation()}
          >
            <div className={styles.confirmHandle} aria-hidden="true" />
            <div className={styles.confirmBadge} aria-hidden="true">
              {confirmState.tone === 'danger' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 9v4"/>
                  <path d="M12 17h.01"/>
                  <path d="M10.3 4.3 2.8 17.2A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.8L13.7 4.3a2 2 0 0 0-3.4 0Z"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"/>
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                </svg>
              )}
            </div>
            <div className={styles.confirmTitle} id="takda-confirm-title">{confirmState.title}</div>
            {confirmState.message && (
              <div className={styles.confirmMessage} id="takda-confirm-message">{confirmState.message}</div>
            )}
            <div className={styles.confirmActions}>
              <button type="button" className={styles.cancelBtn} onClick={() => resolveConfirm(false)}>
                {confirmState.cancelLabel}
              </button>
              <button type="button" className={styles.confirmBtn} onClick={() => resolveConfirm(true)}>
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function capitalizeTone(tone = '') {
  return `${tone.charAt(0).toUpperCase()}${tone.slice(1)}`
}
