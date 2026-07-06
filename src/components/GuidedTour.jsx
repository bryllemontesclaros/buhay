import { useState, useEffect, useRef } from 'react'
import styles from './GuidedTour.module.css'

const TOUR_CONFIGS = {
  takda: {
    accentColor: 'var(--accent, #9b51e0)',
    steps: [
      {
        target: '#takda-balance-card',
        title: 'Buhay Summary',
        body: 'Welcome to Takda! Here is your net worth, monthly income, and expenses calculated at a glance.',
        tab: 'dashboard'
      },
      {
        target: '#takda-calendar',
        title: 'Daily Cashflow & Log',
        body: 'This interactive calendar shows daily income/expense dots. Tap any date to add a record or view daily entries.',
        tab: 'calendar'
      },
      {
        target: '#takda-nav-savings',
        title: 'Savings Targets',
        body: 'Tap here to track your savings goals, set target dates, and simulate your monthly deposits.',
        tab: 'savings'
      },
      {
        target: '#takda-nav-debts',
        title: 'Debt & Interest Tracker',
        body: 'Tracks credit cards, interest, repayment milestones, and transaction logs in one place.',
        tab: 'debts'
      }
    ]
  },
  lakas: {
    accentColor: 'var(--lakas-accent, #ff9f43)',
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
    accentColor: 'var(--tala-accent, #00d2d3)',
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

  const step = config.steps[currentStepIdx]

  // Handle auto-tab switching if the step is on another tab
  useEffect(() => {
    if (step && step.tab && step.tab !== activeTab) {
      onTabChange(step.tab)
    }
  }, [currentStepIdx, step, activeTab, onTabChange])

  // Recalculate target element position
  useEffect(() => {
    let active = true

    const updateCoords = () => {
      if (!active || !step) return
      const el = document.querySelector(step.target)
      if (el) {
        const rect = el.getBoundingClientRect()
        setCoords({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        })
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else {
        setCoords(null)
      }
    }

    // Delay slightly to allow the DOM/tab switch to complete
    const timer = setTimeout(updateCoords, 250)

    const handleResize = () => {
      clearTimeout(resizeTimeoutRef.current)
      resizeTimeoutRef.current = setTimeout(updateCoords, 100)
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', updateCoords)

    return () => {
      active = false
      clearTimeout(timer)
      clearTimeout(resizeTimeoutRef.current)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', updateCoords)
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

  // Calculate card position on desktop
  const getCardStyle = () => {
    if (window.innerWidth <= 768) return {} // Bottom sheet style handled by CSS Media query
    if (!coords) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', position: 'fixed' }

    // Position popover relative to spotlight element
    const spacing = 16
    let cardLeft = coords.left + coords.width / 2 - 160 // Center popover horizontally
    let cardTop = coords.top + coords.height + spacing

    // Bounds checking
    if (cardLeft < 20) cardLeft = 20
    if (cardLeft + 320 > window.innerWidth) cardLeft = window.innerWidth - 340
    if (cardTop + 220 > window.innerHeight) {
      cardTop = coords.top - 220 - spacing // Place above target if bottom exceeds height
    }

    return {
      top: `${cardTop}px`,
      left: `${cardLeft}px`
    }
  }

  return (
    <>
      <div className={styles.overlay} onClick={onFinish} />
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
