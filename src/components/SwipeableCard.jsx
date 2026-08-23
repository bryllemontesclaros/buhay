import { useRef, useState } from 'react'
import { triggerHaptic, playHapticTick } from '../lib/gestures'
import styles from './SwipeableCard.module.css'

export default function SwipeableCard({
  children,
  onSwipeRight,
  onSwipeLeft,
  onDoubleTap,
  rightLabel = 'Mark Paid',
  rightIcon = '✓',
  rightTone = 'success', // success | primary | amber
  leftLabel = 'Edit',
  leftIcon = '✎',
  leftTone = 'amber', // amber | danger | blue
  threshold = 75,
  disabled = false,
  className = '',
  style = {},
}) {
  const [offsetX, setOffsetX] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const [thresholdReached, setThresholdReached] = useState(false)

  const startPosRef = useRef({ x: 0, y: 0 })
  const lastTapRef = useRef(0)
  const isDraggingRef = useRef(false)
  const isHorizontalRef = useRef(false)
  const thresholdFiredRef = useRef(false)

  function handleTouchStart(e) {
    if (disabled) return
    const touch = e.touches[0]
    startPosRef.current = { x: touch.clientX, y: touch.clientY }
    isDraggingRef.current = true
    isHorizontalRef.current = false
    thresholdFiredRef.current = false
    setIsSwiping(false)
  }

  function handleTouchMove(e) {
    if (!isDraggingRef.current || disabled) return
    const touch = e.touches[0]
    const deltaX = touch.clientX - startPosRef.current.x
    const deltaY = touch.clientY - startPosRef.current.y

    // Determine direction on initial move
    if (!isHorizontalRef.current) {
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
        isDraggingRef.current = false
        return
      }
      if (Math.abs(deltaX) > 8) {
        isHorizontalRef.current = true
        setIsSwiping(true)
      }
    }

    if (!isHorizontalRef.current) return

    // Prevent vertical scroll while swiping horizontally
    if (e.cancelable) e.preventDefault()

    // Filter by available actions
    if (deltaX > 0 && !onSwipeRight) return
    if (deltaX < 0 && !onSwipeLeft) return

    // Elastic rubber band resistance past threshold
    const maxDrag = 140
    let resistanceX = deltaX
    if (Math.abs(deltaX) > threshold) {
      const excess = Math.abs(deltaX) - threshold
      const damped = threshold + excess * 0.35
      resistanceX = deltaX > 0 ? Math.min(maxDrag, damped) : Math.max(-maxDrag, -damped)
    }

    setOffsetX(resistanceX)

    const pastThreshold = Math.abs(deltaX) >= threshold
    setThresholdReached(pastThreshold)

    if (pastThreshold && !thresholdFiredRef.current) {
      thresholdFiredRef.current = true
      triggerHaptic('medium')
      playHapticTick(950, 0.04)
    } else if (!pastThreshold && thresholdFiredRef.current) {
      thresholdFiredRef.current = false
    }
  }

  function handleTouchEnd() {
    if (!isDraggingRef.current || disabled) {
      isDraggingRef.current = false
      return
    }
    isDraggingRef.current = false

    if (thresholdReached) {
      if (offsetX > 0 && onSwipeRight) {
        triggerHaptic('success')
        playHapticTick(1200, 0.06)
        onSwipeRight()
      } else if (offsetX < 0 && onSwipeLeft) {
        triggerHaptic('warning')
        playHapticTick(650, 0.05)
        onSwipeLeft()
      }
    }

    // Spring back
    setIsSwiping(false)
    setOffsetX(0)
    setThresholdReached(false)
    thresholdFiredRef.current = false
  }

  function handleClick(e) {
    if (disabled || !onDoubleTap) return
    // Ignore clicks if originating from buttons or inputs
    if (e.target.closest('button, input, select, a')) return

    const now = Date.now()
    const diff = now - lastTapRef.current
    if (diff < 280 && diff > 40) {
      // Double tap detected!
      lastTapRef.current = 0
      triggerHaptic('light')
      playHapticTick(1100, 0.03)
      onDoubleTap(e)
    } else {
      lastTapRef.current = now
    }
  }

  const isRight = offsetX > 0
  const isLeft = offsetX < 0
  const showBackground = Math.abs(offsetX) > 4

  return (
    <div
      className={`${styles.swipeContainer} ${className}`}
      style={style}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {showBackground && (
        <div
          className={`${styles.actionBackground} ${
            isRight
              ? rightTone === 'success'
                ? styles.toneSuccess
                : rightTone === 'primary'
                ? styles.tonePrimary
                : styles.toneAmber
              : leftTone === 'danger'
              ? styles.toneDanger
              : leftTone === 'blue'
              ? styles.toneBlue
              : styles.toneAmber
          }`}
          style={{ justifyContent: isRight ? 'flex-start' : 'flex-end' }}
        >
          {isRight && onSwipeRight && (
            <div className={`${styles.actionPill} ${thresholdReached ? styles.actionPillActive : ''}`}>
              <span className={styles.actionIcon}>{rightIcon}</span>
              <span className={styles.actionText}>{rightLabel}</span>
            </div>
          )}
          {isLeft && onSwipeLeft && (
            <div className={`${styles.actionPill} ${thresholdReached ? styles.actionPillActive : ''}`}>
              <span className={styles.actionText}>{leftLabel}</span>
              <span className={styles.actionIcon}>{leftIcon}</span>
            </div>
          )}
        </div>
      )}

      <div
        className={`${styles.cardContent} ${isSwiping ? styles.isSwiping : styles.springReturn}`}
        style={{
          transform: `translate3d(${offsetX}px, 0, 0)`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
