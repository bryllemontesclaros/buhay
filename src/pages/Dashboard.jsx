import { useState, useMemo } from 'react'
import { fsAdd, fsUpdate } from '../lib/firestore'
import { notifyApp } from '../lib/appFeedback'
import { today, formatDisplayDate } from '../lib/utils'
import { HABIT_OPTIONS, dateDaysAgo } from '../lib/lakasHelpers'
import calStyles from './Calendar.module.css'
import styles from './Dashboard.module.css'

export default function Dashboard({ user, data, onNavigate, privacyMode = false, s = '₱' }) {
  const [journalText, setJournalText] = useState('')
  const [moodRating, setMoodRating] = useState(3) // 1-5 scale (neutral is 3)
  const todayStr = today()

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

    const totalCash = cashAccounts.reduce((sum, a) => sum + (a.balance || 0), 0)
    const totalCCDebt = creditCardAccounts.reduce((sum, a) => sum + (a.balance || 0), 0)
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
    switch (val) {
      case 1: return '😢'
      case 2: return '🙁'
      case 3: return '😐'
      case 4: return '🙂'
      case 5: return '😊'
      default: return '😐'
    }
  }

  const getMoodLabel = (val) => {
    switch (val) {
      case 1: return 'Tired / Low'
      case 2: return 'Slightly Down'
      case 3: return 'Neutral'
      case 4: return 'Good / Peaceful'
      case 5: return 'Excellent'
      default: return 'Neutral'
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.greetingGroup}>
          <h1 className={styles.title}>{greeting}</h1>
          <p className={styles.subtitle}>Welcome to your life control center.</p>
        </div>
        <div className={styles.streakBadge} title="Combined wealth, health, and mind consistency streak">
          <span className={styles.streakEmoji}>🔥</span>
          <div className={styles.streakText}>
            <span className={styles.streakVal}>{streak} day{streak !== 1 ? 's' : ''}</span>
            <span className={styles.streakLabel}>Buhay Rhythm</span>
          </div>
        </div>
      </header>

      <div className={styles.bento}>
        {/* WEALTH CARD */}
        <section className={`${styles.card} ${styles.wealthCard}`}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleBlock}>
              <span className={styles.cardEmoji}>💳</span>
              <h2 className={styles.cardTitle}>Wealth</h2>
            </div>
            <button
              onClick={() => onNavigate('takda', 'calendar')}
              className={styles.viewBtn}
            >
              Open Calendar
            </button>
          </div>

          <div className={styles.bentoBody}>
            <div className={styles.metricBlock}>
              <span className={styles.metricLabel}>Net Worth</span>
              <span className={styles.metricVal} style={{ color: 'var(--accent)' }}>
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
                <span className={styles.subMetricVal} style={{ color: 'var(--red)' }}>
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
                  <span className={styles.nextBillAmount} style={{ color: 'var(--red)' }}>
                    {fmt(wealthInfo.nextBill.amount || 0)}
                  </span>
                </div>
              ) : (
                <p className={styles.emptyText}>All bills are paid! Beautiful.</p>
              )}
            </div>
          </div>
        </section>

        {/* HEALTH CARD */}
        <section className={`${styles.card} ${styles.healthCard}`}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleBlock}>
              <span className={styles.cardEmoji}>🏃‍♂️</span>
              <h2 className={styles.cardTitle}>Health</h2>
            </div>
            <button
              onClick={() => onNavigate('lakas', 'workout')}
              className={styles.viewBtn}
            >
              Open Workout
            </button>
          </div>

          <div className={styles.bentoBody}>
            <div className={styles.metricBlock}>
              <span className={styles.metricLabel}>Habits Completed</span>
              <span className={styles.metricVal} style={{ color: 'var(--blue)' }}>
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
                  >
                    <span className={styles.habitDot}>{isDone ? '✓' : '○'}</span>
                    <span className={styles.habitLabel}>{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        {/* MIND CARD */}
        <section className={`${styles.card} ${styles.mindCard}`}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleBlock}>
              <span className={styles.cardEmoji}>🧠</span>
              <h2 className={styles.cardTitle}>Mind</h2>
            </div>
            <button
              onClick={() => onNavigate('tala', 'journal')}
              className={styles.viewBtn}
            >
              Open Journal
            </button>
          </div>

          <div className={styles.bentoBody}>
            <div className={styles.moodSelectorBlock}>
              <span className={styles.metricLabel}>Mood Check-in</span>
              <div className={styles.sliderLabelRow}>
                <span className={styles.moodEmojiDisplay}>{getMoodEmoji(moodRating)}</span>
                <span className={styles.moodTextDisplay}>{getMoodLabel(moodRating)}</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={moodRating}
                onChange={(e) => setMoodRating(Number(e.target.value))}
                className={styles.moodSlider}
              />
            </div>

            <div className={styles.widgetDivider} />

            <div className={styles.journalLogBlock}>
              <h3 className={styles.extraTitle}>Quick Reflection</h3>
              <textarea
                className={styles.quickJournalInput}
                placeholder="How was today in one sentence? Write it here..."
                value={journalText}
                onChange={(e) => setJournalText(e.target.value)}
                rows={2}
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
        </section>
      </div>
    </div>
  )
}
