import { useState, useEffect, useRef } from 'react'
import styles from './GuidedTour.module.css'

const TOUR_CONFIGS = {
  takda: {
    accentColor: 'var(--accent)',
    steps: [
      {
        target: '#takda-calendar',
        title: 'Daily Cashflow & Log',
        body: 'Welcome to Takda! This interactive calendar shows daily income/expense dots. Tap any date to add a record or view daily entries.',
        tab: 'calendar'
      },
      {
        target: '#takda-savings-summary',
        title: 'Savings Targets',
        body: 'Track your savings goals, set target dates, and simulate your monthly deposits.',
        tab: 'savings'
      },
      {
        target: '#takda-debts-summary',
        title: 'Debt & Interest Tracker',
        body: 'Tracks credit cards, interest, repayment milestones, and transaction logs in one place.',
        tab: 'debts'
      }
    ]
  },
  lakas: {
    accentColor: 'var(--accent)',
    steps: [
      {
        target: '#lakas-start-workout',
        title: 'Quick Workout Logger',
        body: 'Begin a new workout template (Push, Pull, Legs) or log custom exercises directly.',
        tab: 'workout'
      },
      {
        target: '#lakas-charts',
        title: 'Weekly Progress & Habits',
        body: 'Monitor step trends, active minutes, and weight check-ins in focused weekly layouts.',
        tab: 'progress'
      },
      {
        target: '#lakas-plate-calc',
        title: 'Plate Weight Calculator',
        body: 'Expand this tool during any barbell set to calculate the exact plates to load per side.',
        tab: 'workout'
      }
    ]
  },
  tala: {
    accentColor: 'var(--accent)',
    steps: [
      {
        target: '#tala-new-entry',
        title: 'Daily Reflection Space',
        body: 'Log your mood, set a primary focus, and write down an honest reflection for today.',
        tab: 'journal'
      },
      {
        target: '#tala-history',
        title: 'Reflection History',
        body: 'Scroll back through your timeline of moods and written logs to trace your personal growth.',
        tab: 'history'
      }
    ]
  }
}

export default function GuidedTour({ space, activeTab, onTabChange, onFinish }) {
  const config = TOUR_CONFIGS[space]
  if (!config) return null

  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const [coords, setCoords] = useState(null)
  const resizeTimeoutRef = useRef(null)
  const lastCardStyleRef = useRef(null)

  const step = config.steps[currentStepIdx]

  // Handle auto-tab switching if the step is on another tab
  useEffect(() => {
    if (step && step.tab && step.tab !== activeTab) {
      onTabChange(step.tab)
    }
  }, [currentStepIdx, step, activeTab, onTabChange])

  // Recalculate target element position continuously to handle layout shifts, animations, and transitions
  useEffect(() => {
    let active = true
    let frameId

    const updateCoords = () => {
      if (!active || !step) return
      const el = document.querySelector(step.target)
      if (el) {
        const rect = el.getBoundingClientRect()
        setCoords(current => {
          // Avoid triggering re-renders if coordinates did not change
          if (
            current &&
            current.top === rect.top &&
            current.left === rect.left &&
            current.width === rect.width &&
            current.height === rect.height
          ) {
            return current
          }
          return {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height
          }
        })
      } else {
        setCoords(null)
      }

      if (active) {
        frameId = requestAnimationFrame(updateCoords)
      }
    }

    // Scroll target into view once on step load
    const el = document.querySelector(step.target)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    frameId = requestAnimationFrame(updateCoords)

    return () => {
      active = false
      cancelAnimationFrame(frameId)
    }
  }, [currentStepIdx, step, activeTab])

  const handleNext = () => {
    if (currentStepIdx < config.steps.length - 1) {
      setCurrentStepIdx(idx => idx + 1)
    } else {
      onFinish()
    }
  }

  const handleBack = () => {
    if (currentStepIdx > 0) {
      setCurrentStepIdx(idx => idx - 1)
    }
  }

  if (!step) return null

  const isLastStep = currentStepIdx === config.steps.length - 1

  // Dynamic inline style variables for cards
  const inlineStyles = {
    '--tour-accent': config.accentColor
  }

  // Calculate card position on desktop/mobile
  const getCardStyle = () => {
    if (!coords) {
      return lastCardStyleRef.current || { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', position: 'fixed', opacity: 0 }
    }

    if (window.innerWidth <= 1024) {
      // Mobile & Tablet: Place card at the top if target element is in bottom half of screen (and vice versa)
      const isTargetInBottomHalf = coords.top + coords.height / 2 > window.innerHeight / 2
      
      const leftOffset = '16px'
      const rightOffset = '16px'
      const widthVal = 'calc(100% - 32px)'

      const mobileStyle = {
        position: 'fixed',
        left: leftOffset,
        right: rightOffset,
        width: widthVal,
        opacity: 1,
        transform: 'none'
      }

      if (isTargetInBottomHalf) {
        mobileStyle.top = '16px'
        mobileStyle.bottom = 'auto'
      } else {
        mobileStyle.bottom = '16px'
        mobileStyle.top = 'auto'
      }

      lastCardStyleRef.current = mobileStyle
      return mobileStyle
    }

    // Desktop: Position popover relative to spotlight element
    const spacing = 16
    let cardLeft = coords.left + coords.width / 2 - 160 // Center popover horizontally
    let cardTop = coords.top + coords.height + spacing

    // Bounds checking
    if (cardLeft < 20) cardLeft = 20
    if (cardLeft + 320 > window.innerWidth) cardLeft = window.innerWidth - 340
    if (cardTop + 220 > window.innerHeight) {
      cardTop = coords.top - 220 - spacing // Place above target if bottom exceeds height
    }
    if (cardTop < 20) {
      cardTop = Math.max(20, coords.top + 20) // Fallback to safe top if pushed off-screen
    }

    const nextStyle = {
      position: 'fixed',
      top: `${cardTop}px`,
      left: `${cardLeft}px`,
      right: 'auto',
      bottom: 'auto',
      width: '320px',
      transform: 'none',
      opacity: 1
    }
    lastCardStyleRef.current = nextStyle
    return nextStyle
  }

  return (
    <>
      <div 
        className={styles.overlay} 
        style={{ backgroundColor: coords ? 'transparent' : 'rgba(0, 0, 0, 0.75)' }} 
        onClick={onFinish} 
      />
      {coords && (
        <div
          className={styles.spotlight}
          style={{
            ...inlineStyles,
            top: `${coords.top - 4}px`,
            left: `${coords.left - 4}px`,
            width: `${coords.width + 8}px`,
            height: `${coords.height + 8}px`
          }}
        />
      )}
      <div className={styles.tourCard} style={{ ...inlineStyles, ...getCardStyle() }}>
        <div className={styles.header}>
          <span className={styles.stepIndicator}>
            Step {currentStepIdx + 1} of {config.steps.length}
          </span>
          <button className={styles.closeBtn} onClick={onFinish} aria-label="Skip onboarding tour">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div>
          <h4 className={styles.title}>{step.title}</h4>
          <p className={styles.body}>{step.body}</p>
        </div>
        <div className={styles.footer}>
          <button className={styles.btn + ' ' + styles.btnSecondary} onClick={onFinish}>
            Skip Tour
          </button>
          <div className={styles.actions}>
            {currentStepIdx > 0 && (
              <button className={styles.btn + ' ' + styles.btnSecondary} onClick={handleBack}>
                Back
              </button>
            )}
            <button className={styles.btn + ' ' + styles.btnPrimary} onClick={handleNext}>
              {isLastStep ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
