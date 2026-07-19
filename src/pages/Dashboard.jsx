import { useState, useMemo } from 'react'
import { fsAdd, fsUpdate } from '../lib/firestore'
import { notifyApp } from '../lib/appFeedback'
import { today, formatDisplayDate } from '../lib/utils'
import { getBalanceAtDate } from '../lib/finance'
import { HABIT_OPTIONS, dateDaysAgo } from '../lib/lakasHelpers'
import styles from './Dashboard.module.css'


export default function Dashboard({ user, data, onNavigate, privacyMode = false, s = '₱' }) {
  const [journalText, setJournalText] = useState('')
  const [moodRating, setMoodRating] = useState(3) // 1-5 scale (neutral is 3)
  const todayStr = today()

  // Find today's checkin to initialize daily focus
  const todayCheckin = useMemo(() => {
    return (data.talaCheckins || []).find(c => c.date === todayStr) || {}
  }, [data.talaCheckins, todayStr])

  const [dailyFocus, setDailyFocus] = useState(todayCheckin.priority || '')



  // 1. Personalized greeting based on local time
  const greeting = useMemo(() => {
    const hours = new Date().getHours()
    const firstName = user?.displayName?.split(' ')[0] || 'there'
    if (hours < 12) return `Good morning, ${firstName}`
    if (hours < 18) return `Good afternoon, ${firstName}`
    return `Good evening, ${firstName}`
  }, [user])

  // 2. Calculate Buhay Unified Consistency Streak
  const streak = useMemo(() => {
    const activityDates = new Set()

    // Wealth (Takda) activities
    ;(data.income || []).forEach(tx => { if (tx.date) activityDates.add(tx.date) })
    ;(data.expenses || []).forEach(tx => { if (tx.date) activityDates.add(tx.date) })
    ;(data.transfers || []).forEach(tx => { if (tx.date) activityDates.add(tx.date) })

    // Health (Lakas) activities
    ;(data.lakasWorkouts || []).forEach(w => { if (w.date) activityDates.add(w.date) })

    // Mind (Tala) activities
    ;(data.talaJournal || []).forEach(j => { if (j.date) activityDates.add(j.date) })
    ;(data.talaCheckins || []).forEach(c => { if (c.date) activityDates.add(c.date) })

    let currentStreak = 0
    let cursor = todayStr

    if (!activityDates.has(cursor)) {
      const yesterday = dateDaysAgo(1)
      if (activityDates.has(yesterday)) {
        cursor = yesterday
      } else {
        return 0
      }
    }

    while (activityDates.has(cursor)) {
      currentStreak += 1
      cursor = dateDaysAgo(currentStreak)
    }
    return currentStreak
  }, [data.income, data.expenses, data.transfers, data.lakasWorkouts, data.talaJournal, data.talaCheckins, todayStr])

  // 3. Wealth (Takda) calculations
  const wealthInfo = useMemo(() => {
    const accounts = data.accounts || []
    const cashAccounts = accounts.filter(a => a.type !== 'Credit Card')
    const creditCardAccounts = accounts.filter(a => a.type === 'Credit Card')

    const totalCash = cashAccounts.reduce((sum, a) => sum + Math.max(0, a.balance || 0), 0)
    const totalCCDebt = creditCardAccounts.reduce((sum, a) => sum + Math.abs(a.balance || 0), 0)
    const netWorth = totalCash - totalCCDebt

    // Closest upcoming unpaid bill
    const upcomingBills = (data.bills || [])
      .filter(b => !b.isPaid && b.dueDate >= todayStr)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

    return {
      netWorth,
      totalCash,
      totalCCDebt,
      nextBill: upcomingBills[0],
    }
  }, [data.accounts, data.bills, todayStr])

  // 4. Health (Lakas) habits checked off today
  const todayHabit = useMemo(() => {
    return (data.lakasHabits || []).find(h => h.date === todayStr) || {}
  }, [data.lakasHabits, todayStr])

  const habitsDoneCount = useMemo(() => {
    return HABIT_OPTIONS.reduce((count, option) => count + (todayHabit[option.key] ? 1 : 0), 0)
  }, [todayHabit])

  const handleToggleHabit = async (optionKey, currentVal) => {
    if (!user?.uid) return
    const nextVal = !currentVal
    try {
      if (todayHabit._id) {
        await fsUpdate(user.uid, 'lakasHabits', todayHabit._id, {
          ...todayHabit,
          [optionKey]: nextVal,
        })
      } else {
        await fsAdd(user.uid, 'lakasHabits', {
          date: todayStr,
          [optionKey]: nextVal,
        })
      }
      notifyApp({ title: 'Habits updated', message: 'Your daily health log has been updated.', tone: 'success' })
    } catch (err) {
      console.error(err)
      notifyApp({ title: 'Update failed', message: 'Could not log habit.', tone: 'danger' })
    }
  }

  // 5. Mind (Tala) Quick Check-in & Journal logging
  const handleQuickJournal = async () => {
    if (!journalText.trim()) return
    const moods = ['very_sad', 'sad', 'neutral', 'happy', 'very_happy']
    const moodStr = moods[moodRating - 1] || 'neutral'

    try {
      await fsAdd(user.uid, 'talaJournal', {
        date: todayStr,
        title: 'Reflection',
        mood: moodStr,
        tags: [],
        body: journalText.trim(),
        private: false,
        source: 'tala',
      })

      // Create or update today's general checkin for energy/stress average
      const checkins = data.talaCheckins || []
      const existingCheckin = checkins.find(row => row.date === todayStr)
      const checkinPayload = {
        date: todayStr,
        energy: 3,
        stress: 3,
        sleepQuality: 3,
        priority: '',
        gratitude: '',
        reflection: journalText.trim(),
        source: 'tala',
      }

      if (existingCheckin?._id) {
        await fsUpdate(user.uid, 'talaCheckins', existingCheckin._id, checkinPayload)
      } else {
        await fsAdd(user.uid, 'talaCheckins', checkinPayload)
      }

      setJournalText('')
      notifyApp({ title: 'Reflection saved', message: 'Your entry has been recorded in Tala.', tone: 'success' })
    } catch (err) {
      console.error(err)
      notifyApp({ title: 'Error saving', message: 'Could not save journal entry.', tone: 'danger' })
    }
  }

  // 6. Micro-Charts (Sparklines) Data
  const sparklines = useMemo(() => {
    const days = Array.from({length: 7}, (_, i) => dateDaysAgo(6 - i))
    
    // Net Worth Sparkline
    const nwData = days.map(d => getBalanceAtDate(data.accounts || [], data.transfers || [], data.income || [], data.expenses || [], d))
    const nwMin = Math.min(...nwData)
    const nwMax = Math.max(...nwData)
    const nwRange = nwMax - nwMin || 1
    const nwPoints = nwData.map((val, idx) => {
      const x = (idx / 6) * 100
      const y = 100 - (((val - nwMin) / nwRange) * 100)
      return `${x},${y}`
    }).join(' ')

    // Mood Sparkline
    const moodMap = { 'very_sad': 1, 'sad': 2, 'neutral': 3, 'happy': 4, 'very_happy': 5 }
    const moodData = days.map(d => {
      const checkin = (data.talaCheckins || []).find(c => c.date === d)
      const journal = (data.talaJournal || []).find(j => j.date === d)
      if (checkin?.energy) return checkin.energy
      if (journal?.mood) return moodMap[journal.mood] || 3
      return 3
    })
    const moodPoints = moodData.map((val, idx) => {
      const x = (idx / 6) * 100
      const y = 100 - (((val - 1) / 4) * 100)
      return `${x},${y}`
    }).join(' ')

    return { nwPoints, moodPoints }
  }, [data, todayStr])

  // 7. The Pulse (Recent Activity)
  const pulseFeed = useMemo(() => {
    const activities = []
    
    ;(data.expenses || []).forEach(tx => {
      activities.push({ id: tx._id, date: tx.date, type: 'expense', label: `Logged expense`, meta: tx.desc || tx.cat, amount: tx.amount, icon: '💳' })
    })
    ;(data.income || []).forEach(tx => {
      activities.push({ id: tx._id, date: tx.date, type: 'income', label: `Logged income`, meta: tx.desc || tx.cat, amount: tx.amount, icon: '💰' })
    })
    ;(data.lakasWorkouts || []).forEach(w => {
      activities.push({ id: w._id, date: w.date, type: 'workout', label: `Completed workout`, meta: w.title || w.type, icon: '🏃‍♂️' })
    })
    ;(data.talaJournal || []).forEach(j => {
      activities.push({ id: j._id, date: j.date, type: 'journal', label: `Saved reflection`, meta: j.title || 'Journal entry', icon: '🧠' })
    })

    return activities
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
  }, [data])

  // Handle Daily Focus
  const handleSaveFocus = async () => {
    if (!user?.uid) return
    const payload = {
      date: todayStr,
      priority: dailyFocus.trim(),
      source: 'tala'
    }
    try {
      if (todayCheckin._id) {
        await fsUpdate(user.uid, 'talaCheckins', todayCheckin._id, { ...todayCheckin, priority: dailyFocus.trim() })
      } else {
        await fsAdd(user.uid, 'talaCheckins', payload)
      }
      notifyApp({ title: 'Focus set', message: 'Your daily priority is locked in.', tone: 'success' })
    } catch (err) {
      console.error(err)
    }
  }

  // Format currency helpers
  const fmt = (val) => {
    if (privacyMode) return '••••'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val).replace('PHP', s)
  }

  const getMoodEmoji = (val) => {
    const emojis = { 1: '😢', 2: '🙁', 3: '😐', 4: '🙂', 5: '😊' }
    return emojis[val] || '😐'
  }

  const getMoodLabel = (val) => {
    const labels = { 1: 'Tired', 2: 'Down', 3: 'Neutral', 4: 'Good', 5: 'Excellent' }
    return labels[val] || 'Neutral'
  }

  return (
    <div className={styles.container}>

      {/* ── HEADER ─────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.greetingGroup}>
          <h1 className={styles.title}>{greeting}</h1>
          <p className={styles.subtitle}>Your life control center — all in one view.</p>
          <div className={styles.dailyFocusWrap}>
            <input 
              type="text" 
              className={styles.dailyFocusInput} 
              placeholder="What's your #1 priority today?"
              value={dailyFocus}
              onChange={(e) => setDailyFocus(e.target.value)}
              onBlur={handleSaveFocus}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.target.blur() } }}
              aria-label="Daily focus"
            />
          </div>
        </div>
        <div className={styles.streakBadge} title="Combined wealth, health, and mind consistency streak">
          <span className={styles.streakEmoji}>🔥</span>
          <div className={styles.streakText}>
            <span className={styles.streakVal}>{streak} day{streak !== 1 ? 's' : ''}</span>
            <span className={styles.streakLabel}>Buhay Rhythm</span>
          </div>
        </div>
      </header>

      {/* ── STAT STRIP ─────────────────────── */}
      <div className={styles.statStrip} aria-label="Today's key numbers">
        <div className={styles.statChip}>
          <div className={styles.sparklineWrap}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.sparklineSvg}>
              <polyline points={sparklines.nwPoints} className={styles.sparklinePathWealth} />
            </svg>
          </div>
          <span className={styles.statChipIcon} aria-hidden="true">💳</span>
          <div className={styles.statChipBody}>
            <span className={styles.statChipLabel}>Net Worth</span>
            <span className={`${styles.statChipVal} ${styles.statChipValWealth}`}>
              {fmt(wealthInfo.netWorth)}
            </span>
          </div>
        </div>
        <div className={styles.statDivider} aria-hidden="true" />
        <div className={styles.statChip}>
          <span className={styles.statChipIcon} aria-hidden="true">🏃‍♂️</span>
          <div className={styles.statChipBody}>
            <span className={styles.statChipLabel}>Habits Today</span>
            <span className={`${styles.statChipVal} ${styles.statChipValHealth}`}>
              {habitsDoneCount} / {HABIT_OPTIONS.length}
            </span>
          </div>
        </div>
        <div className={styles.statDivider} aria-hidden="true" />
        <div className={styles.statChip}>
          <div className={styles.sparklineWrap}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.sparklineSvg}>
              <polyline points={sparklines.moodPoints} className={styles.sparklinePathMind} />
            </svg>
          </div>
          <span className={styles.statChipIcon} aria-hidden="true">{getMoodEmoji(moodRating)}</span>
          <div className={styles.statChipBody}>
            <span className={styles.statChipLabel}>Mood</span>
            <span className={`${styles.statChipVal} ${styles.statChipValMind}`}>
              {getMoodLabel(moodRating)}
            </span>
          </div>
        </div>
      </div>

      {/* ── BENTO GRID ─────────────────────── */}
      <div className={styles.bento}>

        {/* WEALTH — spans 2 rows on left */}
        <section className={`${styles.card} ${styles.wealthCard}`} aria-label="Wealth overview">
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleBlock}>
              <span className={styles.cardEmoji} aria-hidden="true">💳</span>
              <h2 className={styles.cardTitle}>Wealth</h2>
            </div>
            <span className={styles.cardTag}>Takda</span>
          </div>

          <div className={styles.bentoBody}>
            <div className={styles.metricBlock}>
              <span className={styles.metricLabel}>Net Worth</span>
              <span className={`${styles.metricVal} ${styles.metricValWealth}`}>
                {fmt(wealthInfo.netWorth)}
              </span>
            </div>

            <div className={styles.subMetricsGrid}>
              <div className={styles.subMetric}>
                <span className={styles.subMetricLabel}>Cash Assets</span>
                <span className={styles.subMetricVal}>{fmt(wealthInfo.totalCash)}</span>
              </div>
              <div className={styles.subMetric}>
                <span className={styles.subMetricLabel}>Credit Debt</span>
                <span className={`${styles.subMetricVal} ${styles.subMetricValRed}`}>
                  {fmt(wealthInfo.totalCCDebt)}
                </span>
              </div>
            </div>

            <div className={styles.widgetDivider} />

            <div className={styles.extraWidget}>
              <h3 className={styles.extraTitle}>Next Upcoming Bill</h3>
              {wealthInfo.nextBill ? (
                <div className={styles.nextBillRow}>
                  <div className={styles.nextBillDetails}>
                    <span className={styles.nextBillName}>{wealthInfo.nextBill.desc || wealthInfo.nextBill.cat}</span>
                    <span className={styles.nextBillDate}>Due {formatDisplayDate(wealthInfo.nextBill.dueDate)}</span>
                  </div>
                  <span className={`${styles.nextBillAmount} ${styles.nextBillAmountRed}`}>
                    {fmt(wealthInfo.nextBill.amount || 0)}
                  </span>
                </div>
              ) : (
                <p className={styles.emptyText}>All bills are paid! Beautiful.</p>
              )}
            </div>
          </div>

          <button
            type="button"
            className={`${styles.spaceChip} ${styles.spaceChipWealth}`}
            onClick={() => onNavigate('takda', 'calendar')}
          >
            Open Takda <span className={styles.spaceChipArrow} aria-hidden="true">→</span>
          </button>
        </section>

        {/* HEALTH */}
        <section className={`${styles.card} ${styles.healthCard}`} aria-label="Health overview">
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleBlock}>
              <span className={styles.cardEmoji} aria-hidden="true">🏃‍♂️</span>
              <h2 className={styles.cardTitle}>Health</h2>
            </div>
            <span className={styles.cardTag}>Lakas</span>
          </div>

          <div className={styles.bentoBody}>
            <div className={styles.metricBlock}>
              <span className={styles.metricLabel}>Habits Completed</span>
              <span className={`${styles.metricVal} ${styles.metricValHealth}`}>
                {habitsDoneCount} / {HABIT_OPTIONS.length}
              </span>
            </div>

            <div className={styles.habitsGrid}>
              {HABIT_OPTIONS.map(opt => {
                const isDone = Boolean(todayHabit[opt.key])
                return (
                  <button
                    key={opt.key}
                    type="button"
                    className={`${styles.habitPill} ${isDone ? styles.habitPillDone : ''}`}
                    onClick={() => handleToggleHabit(opt.key, isDone)}
                    aria-pressed={isDone}
                    aria-label={`${opt.label}: ${isDone ? 'done' : 'not done'}`}
                  >
                    <span className={styles.habitDot} aria-hidden="true">{isDone ? '✓' : '○'}</span>
                    <span className={styles.habitLabel}>{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <button
            type="button"
            className={`${styles.spaceChip} ${styles.spaceChipHealth}`}
            onClick={() => onNavigate('lakas', 'workout')}
          >
            Open Lakas <span className={styles.spaceChipArrow} aria-hidden="true">→</span>
          </button>
        </section>

        {/* MIND */}
        <section className={`${styles.card} ${styles.mindCard}`} aria-label="Mind overview">
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleBlock}>
              <span className={styles.cardEmoji} aria-hidden="true">🧠</span>
              <h2 className={styles.cardTitle}>Mind</h2>
            </div>
            <span className={styles.cardTag}>Tala</span>
          </div>

          <div className={styles.bentoBody}>
            <div className={styles.moodSelectorBlock}>
              <span className={styles.metricLabel}>Mood Check-in</span>
              <div className={styles.sliderLabelRow}>
                <span className={styles.moodEmojiDisplay} aria-hidden="true">{getMoodEmoji(moodRating)}</span>
                <span className={styles.moodTextDisplay}>{getMoodLabel(moodRating)}</span>
              </div>
              <input
                type="range"
                min="1" max="5" step="1"
                value={moodRating}
                onChange={(e) => setMoodRating(Number(e.target.value))}
                className={styles.moodSlider}
                aria-label={`Mood rating: ${getMoodLabel(moodRating)}`}
              />
            </div>

            <div className={styles.widgetDivider} />

            <div className={styles.journalLogBlock}>
              <h3 className={styles.extraTitle}>Quick Reflection</h3>
              <textarea
                className={styles.quickJournalInput}
                placeholder="How was today in one sentence?"
                value={journalText}
                onChange={(e) => setJournalText(e.target.value)}
                rows={2}
                aria-label="Quick journal reflection"
              />
              <button
                type="button"
                className={styles.journalSubmitBtn}
                onClick={handleQuickJournal}
                disabled={!journalText.trim()}
              >
                Log Reflection
              </button>
            </div>
          </div>

          <button
            type="button"
            className={`${styles.spaceChip} ${styles.spaceChipMind}`}
            onClick={() => onNavigate('tala', 'journal')}
          >
            Open Tala <span className={styles.spaceChipArrow} aria-hidden="true">→</span>
          </button>
        </section>


        {/* THE PULSE */}
        <section className={`${styles.card} ${styles.pulseCard}`} aria-label="Recent activity">
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleBlock}>
              <span className={styles.cardEmoji} aria-hidden="true">⚡</span>
              <h2 className={styles.cardTitle}>The Pulse</h2>
            </div>
            <span className={styles.cardTag}>Activity</span>
          </div>
          <div className={styles.pulseFeed}>
            {pulseFeed.length > 0 ? pulseFeed.map(item => (
              <div key={item.id} className={styles.pulseItem}>
                <span className={styles.pulseIcon} aria-hidden="true">{item.icon}</span>
                <div className={styles.pulseBody}>
                  <span className={styles.pulseLabel}>{item.label}</span>
                  <span className={styles.pulseMeta}>{item.meta}</span>
                </div>
                {item.amount && (
                  <span className={`${styles.pulseAmount} ${item.type === 'expense' ? styles.subMetricValRed : styles.metricValWealth}`}>
                    {item.type === 'expense' ? '-' : '+'}{fmt(item.amount)}
                  </span>
                )}
              </div>
            )) : (
              <p className={styles.emptyText}>No recent activity.</p>
            )}
          </div>
        </section>

      </div>
    </div>
  )
}
