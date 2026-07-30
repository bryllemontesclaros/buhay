import React, { useEffect } from 'react'
import styles from './ModalSheet.module.css'

export default function ModalSheet({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth,
  className = '',
}) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div 
        className={`${styles.container} ${className}`} 
        style={maxWidth ? { maxWidth } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.dragPill} />
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <button 
            type="button" 
            className={styles.closeBtn} 
            onClick={onClose} 
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
        <div className={styles.content}>
          {children}
        </div>
        {footer && (
          <div className={styles.footer}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
