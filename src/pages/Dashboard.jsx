import { useState, useMemo, useEffect } from 'react'
import { fsAdd, fsUpdate, fsSetProfile } from '../lib/firestore'
import { notifyApp } from '../lib/appFeedback'
import { today, formatDisplayDate } from '../lib/utils'
import { getBalanceAtDate } from '../lib/finance'
import { HABIT_OPTIONS, dateDaysAgo } from '../lib/lakasHelpers'
import { generateDashboardInsight } from '../lib/insights'
import ErrorBoundary from '../components/ErrorBoundary'
import PortfolioWidget from '../components/PortfolioWidget'
import styles from './Dashboard.module.css'

// Default layout if user has no saved layout
const DEFAULT_LAYOUT = ['insightBanner', 'statStrip', 'wealthCard', 'portfolioCard', 'healthCard', 'mindCard', 'pulseFeed']

const WIDGET_TITLES = {
  insightBanner: 'Smart Insight',
  statStrip: 'Key Stats Strip',
  wealthCard: 'Takda Wealth Card',
  portfolioCard: 'Asset Portfolio',
  healthCard: 'Lakas Health Card',
  mindCard: 'Tala Mind Card',
  pulseFeed: 'The Pulse Feed',
}

const WIDGET_ICONS = {
  insightBanner: '💡',
  statStrip: '📊',
  wealthCard: '💰',
  portfolioCard: '📈',
  healthCard: '💪',
  mindCard: '🧠',
  pulseFeed: '📰',
}

export default function Dashboard({ user, data, profile, onNavigate, privacyMode = false, s = '₱', isEditing: isEditingProp, onToggleEdit }) {
  const [journalText, setJournalText] = useState('')
  const [moodRating, setMoodRating] = useState(3)
  const [isEditingLocal, setIsEditingLocal] = useState(false)
  const isEditing = isEditingProp !== undefined ? isEditingProp : isEditingLocal
  const [showLibrary, setShowLibrary] = useState(false)

  const toggleEditMode = () => {
    if (onToggleEdit) {
      onToggleEdit()
    } else {
      setIsEditingLocal(!isEditingLocal)
    }
  }

  const [layout, setLayout] = useState(profile?.dashboardLayout || DEFAULT_LAYOUT)

  useEffect(() => {
    if (profile?.dashboardLayout) {
      setLayout(profile.dashboardLayout)
    }
  }, [profile?.dashboardLayout])
  
  const todayStr = today()

  // Find today's checkin to initialize daily focus
  const todayCheckin = useMemo(() => {
    return (data.talaCheckins || []).find(c => c.date === todayStr) || {}
  }, [data.talaCheckins, todayStr])

  const [dailyFocus, setDailyFocus] = useState(todayCheckin.priority || '')

  const dailyInsight = useMemo(() => {
    return generateDashboardInsight(data, todayStr)
  }, [data, todayStr])

  const greeting = useMemo(() => {
    const hours = new Date().getHours()
    const firstName = user?.displayName?.split(' ')[0] || 'there'
    if (hours < 12) return `Good morning, ${firstName}`
    if (hours < 18) return `Good afternoon, ${firstName}`
    return `Good evening, ${firstName}`
  }, [user])

  const streak = useMemo(() => {
    const activityDates = new Set()
    ;(data.income || []).forEach(tx => { if (tx.date) activityDates.add(tx.date) })
    ;(data.expenses || []).forEach(tx => { if (tx.date) activityDates.add(tx.date) })
    ;(data.transfers || []).forEach(tx => { if (tx.date) activityDates.add(tx.date) })
    ;(data.lakasWorkouts || []).forEach(w => { if (w.date) activityDates.add(w.date) })
    ;(data.talaJournal || []).forEach(j => { if (j.date) activityDates.add(j.date) })
    ;(data.talaCheckins || []).forEach(c => { if (c.date) activityDates.add(c.date) })

    let currentStreak = 0
    let cursor = todayStr

    if (!activityDates.has(cursor)) {
      const yesterday = dateDaysAgo(1)
      if (activityDates.has(yesterday)) cursor = yesterday
      else return 0
    }

    while (activityDates.has(cursor)) {
      currentStreak += 1
      cursor = dateDaysAgo(currentStreak)
    }
    return currentStreak
  }, [data.income, data.expenses, data.transfers, data.lakasWorkouts, data.talaJournal, data.talaCheckins, todayStr])

  const wealthInfo = useMemo(() => {
    const accounts = Array.isArray(data.accounts) ? data.accounts.filter(Boolean) : []
    const cashAccounts = accounts.filter(a => a && a.type !== 'Credit Card')
    const creditCardAccounts = accounts.filter(a => a && a.type === 'Credit Card')

    const totalCash = cashAccounts.reduce((sum, a) => sum + Math.max(0, a?.balance || 0), 0)
    const totalCCDebt = creditCardAccounts.reduce((sum, a) => sum + Math.abs(a?.balance || 0), 0)
    const netWorth = totalCash - totalCCDebt

    const upcomingBills = (data.bills || [])
      .filter(b => !b.isPaid && b.dueDate >= todayStr)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

    // 30-day cash balance trend sparkline
    const days = 30
    const dateMap = {}
    for (let i = 0; i < days; i++) {
      const d = new Date()
      d.setDate(d.getDate() - (days - 1 - i))
      const dateKey = d.toISOString().slice(0, 10)
      dateMap[dateKey] = { income: 0, expense: 0 }
    }

    ;(data.income || []).forEach(tx => {
      if (tx?.date && dateMap[tx.date]) {
        dateMap[tx.date].income += Number(tx.amount || 0)
      }
    })
    ;(data.expenses || []).forEach(tx => {
      if (tx?.date && dateMap[tx.date]) {
        dateMap[tx.date].expense += Number(tx.amount || 0)
      }
    })

    const dateKeys = Object.keys(dateMap).sort()
    let running = totalCash
    const reverseBalances = [running]
    for (let i = dateKeys.length - 1; i > 0; i--) {
      const k = dateKeys[i]
      const dayNet = dateMap[k].income - dateMap[k].expense
      running -= dayNet
      reverseBalances.unshift(running)
    }

    const minB = Math.min(...reverseBalances)
    const maxB = Math.max(...reverseBalances)
    const range = (maxB - minB) || 1

    const svgPath = reverseBalances.map((val, idx) => {
      const x = (idx / (days - 1)) * 200
      const y = 35 - ((val - minB) / range) * 28
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    }).join(' ')

    const areaPath = `${svgPath} L 200 40 L 0 40 Z`
    const startVal = reverseBalances[0] || 1
    const endVal = reverseBalances[reverseBalances.length - 1] || 1
    const percentChange = startVal !== 0 ? (((endVal - startVal) / Math.abs(startVal)) * 100).toFixed(1) : 0

    return { netWorth, totalCash, totalCCDebt, nextBill: upcomingBills[0], svgPath, areaPath, percentChange: Number(percentChange) }
  }, [data.accounts, data.bills, data.income, data.expenses, todayStr])

  const todayHabit = useMemo(() => {
    return (data.lakasHabits || []).find(h => h.date === todayStr) || {}
  }, [data.lakasHabits, todayStr])

  const habitsDoneCount = useMemo(() => {
    return HABIT_OPTIONS.reduce((count, option) => count + (todayHabit[option.key] ? 1 : 0), 0)
  }, [todayHabit])

  const sparklines = useMemo(() => {
    const days = Array.from({length: 7}, (_, i) => dateDaysAgo(6 - i))
    
    const nwData = days.map(d => getBalanceAtDate(data.accounts || [], data.transfers || [], data.income || [], data.expenses || [], d))
    const nwMin = Math.min(...nwData)
    const nwMax = Math.max(...nwData)
    const nwRange = nwMax - nwMin || 1
    const nwPoints = nwData.map((val, idx) => {
      const x = (idx / 6) * 100
      const y = 100 - (((val - nwMin) / nwRange) * 100)
      return `${x},${y}`
    }).join(' ')

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

  const pulseFeed = useMemo(() => {
    const raw = []
    ;(data.expenses || []).forEach(tx => {
      raw.push({ id: tx._id, date: tx.date, type: 'expense', label: `Logged expense`, meta: tx.desc || tx.cat, amount: Number(tx.amount) || 0, icon: '💳' })
    })
    ;(data.income || []).forEach(tx => {
      raw.push({ id: tx._id, date: tx.date, type: 'income', label: `Logged income`, meta: tx.desc || tx.cat, amount: Number(tx.amount) || 0, icon: '💰' })
    })
    ;(data.lakasWorkouts || []).forEach(w => {
      raw.push({ id: w._id, date: w.date, type: 'workout', label: `Completed workout`, meta: w.title || w.type, icon: '🏃‍♂️' })
    })
    ;(data.talaJournal || []).forEach(j => {
      raw.push({ id: j._id, date: j.date, type: 'journal', label: `Saved reflection`, meta: j.title || 'Journal entry', icon: '🧠' })
    })

    const grouped = {}
    raw.forEach(item => {
      if (!item.date) return
      if (!grouped[item.date]) grouped[item.date] = {}
      if (!grouped[item.date][item.type]) {
        grouped[item.date][item.type] = { ...item, count: 1 }
      } else {
        const g = grouped[item.date][item.type]
        g.count += 1
        g.amount = (g.amount || 0) + (item.amount || 0)
        if (item.type === 'expense') { g.label = `Logged ${g.count} expenses`; g.meta = 'Multiple transactions' }
        else if (item.type === 'income') { g.label = `Received ${g.count} incomes`; g.meta = 'Multiple sources' }
        else if (item.type === 'workout') { g.label = `Completed ${g.count} workouts`; g.meta = 'Multiple sessions' }
        else if (item.type === 'journal') { g.label = `Saved ${g.count} reflections`; g.meta = 'Multiple entries' }
      }
    })

    const finalFeed = []
    Object.keys(grouped).sort((a, b) => b.localeCompare(a)).forEach(dateStr => {
      finalFeed.push(...Object.values(grouped[dateStr]))
    })
    return finalFeed.slice(0, 5)
  }, [data])

  const fmt = (val) => {
    if (privacyMode) return '••••'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val).replace('PHP', s)
  }

  const getMoodEmoji = (val) => {
    const emojis = { 1: '😢', 2: '🙁', 3: '😐', 4: '🙂', 5: '😊' }
    return emojis[val] || '😐'
  }

  const getMoodLabel = (val) => {
    const labels = { 1: 'Tired', 2: 'Down', 3: 'Neutral', 4: 'Good', 5: 'Excellent' }
    return labels[val] || 'Neutral'
  }

  // --- Handlers ---
  const handleToggleHabit = async (optionKey, currentVal) => {
    if (!user?.uid) return
    const nextVal = !currentVal
    try {
      if (todayHabit._id) {
        await fsUpdate(user.uid, 'lakasHabits', todayHabit._id, { ...todayHabit, [optionKey]: nextVal })
      } else {
        await fsAdd(user.uid, 'lakasHabits', { date: todayStr, [optionKey]: nextVal })
      }
    } catch (err) { console.error(err) }
  }

  const handleQuickJournal = async () => {
    if (!journalText.trim() || !user?.uid) return
    const moods = ['very_sad', 'sad', 'neutral', 'happy', 'very_happy']
    const moodStr = moods[moodRating - 1] || 'neutral'
    try {
      await fsAdd(user.uid, 'talaJournal', { date: todayStr, title: 'Reflection', mood: moodStr, tags: [], body: journalText.trim(), private: false, source: 'tala' })
      const checkins = data.talaCheckins || []
      const existingCheckin = checkins.find(row => row.date === todayStr)
      const checkinPayload = { date: todayStr, energy: 3, stress: 3, sleepQuality: 3, priority: '', gratitude: '', reflection: journalText.trim(), source: 'tala' }
      if (existingCheckin?._id) await fsUpdate(user.uid, 'talaCheckins', existingCheckin._id, checkinPayload)
      else await fsAdd(user.uid, 'talaCheckins', checkinPayload)
      setJournalText('')
      notifyApp({ title: 'Reflection saved', message: 'Your entry has been recorded.', tone: 'success' })
    } catch (err) { console.error(err) }
  }

  const handleSaveFocus = async () => {
    if (!user?.uid) return
    const payload = { date: todayStr, priority: dailyFocus.trim(), source: 'tala' }
    try {
      if (todayCheckin._id) await fsUpdate(user.uid, 'talaCheckins', todayCheckin._id, { ...todayCheckin, priority: dailyFocus.trim() })
      else await fsAdd(user.uid, 'talaCheckins', payload)
      notifyApp({ title: 'Focus set', message: 'Priority locked in.', tone: 'success' })
    } catch (err) { console.error(err) }
  }

  const saveLayout = async (newLayout) => {
    setLayout(newLayout)
    if (!user?.uid) return
    try {
      await fsSetProfile(user.uid, { dashboardLayout: newLayout })
    } catch(err) {
      console.error('Failed to save widget layout', err)
    }
  }
  const moveWidget = (id, direction) => {
    const currentIndex = layout.indexOf(id)
    if (currentIndex === -1) return

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= layout.length) return

    const newLayout = [...layout]
    const temp = newLayout[currentIndex]
    newLayout[currentIndex] = newLayout[targetIndex]
    newLayout[targetIndex] = temp

    saveLayout(newLayout)
  }



  const removeWidget = (id) => {
    const newLayout = (layout || []).filter(w => w !== id)
    saveLayout(newLayout)
  }

  const addWidget = (id) => {
    if (!(layout || []).includes(id)) {
      const newLayout = [...(layout || []), id]
      saveLayout(newLayout)
    }
  }

  const toggleWidget = (id) => {
    if ((layout || []).includes(id)) {
      removeWidget(id)
    } else {
      addWidget(id)
    }
  }


  // --- WIDGET RENDERERS ---
  const widgets = {
    insightBanner: (
      <div className={`${styles.insightBanner} ${styles['insight_' + dailyInsight.type]}`}>
        <span className={styles.insightIcon}>{dailyInsight.icon}</span>
        <div className={styles.insightContent}>
          <strong className={styles.insightTitle}>{dailyInsight.title}</strong>
          <p className={styles.insightMessage}>{dailyInsight.message}</p>
        </div>
      </div>
    ),
    statStrip: (
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
            <span className={`${styles.statChipVal} ${styles.statChipValWealth}`}>{fmt(wealthInfo.netWorth)}</span>
          </div>
        </div>
        <div className={styles.statDivider} aria-hidden="true" />
        <div className={styles.statChip}>
          <span className={styles.statChipIcon} aria-hidden="true">🏃‍♂️</span>
          <div className={styles.statChipBody}>
            <span className={styles.statChipLabel}>Habits Today</span>
            <span className={`${styles.statChipVal} ${styles.statChipValHealth}`}>{habitsDoneCount} / {HABIT_OPTIONS.length}</span>
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
            <span className={`${styles.statChipVal} ${styles.statChipValMind}`}>{getMoodLabel(moodRating)}</span>
          </div>
        </div>
      </div>
    ),
    portfolioCard: (
      <ErrorBoundary fallback={null}>
        <PortfolioWidget user={user} data={data} s={s} privacyMode={privacyMode} />
      </ErrorBoundary>
    ),
    wealthCard: (
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
            <span className={`${styles.metricVal} ${styles.metricValWealth}`}>{fmt(wealthInfo.netWorth)}</span>
          </div>
          <div className={styles.subMetricsGrid}>
            <div className={styles.subMetric}>
              <span className={styles.subMetricLabel}>Cash Assets</span>
              <span className={styles.subMetricVal}>{fmt(wealthInfo.totalCash)}</span>
            </div>
            <div className={styles.subMetric}>
              <span className={styles.subMetricLabel}>Credit Debt</span>
              <span className={`${styles.subMetricVal} ${styles.subMetricValRed}`}>{fmt(wealthInfo.totalCCDebt)}</span>
            </div>
          </div>
          <div className={styles.trendBlock}>
            <div className={styles.trendHeader}>
              <span className={styles.trendTitle}>30-Day Cash Trend</span>
              {!privacyMode && (
                <span className={`${styles.trendBadge} ${wealthInfo.percentChange >= 0 ? styles.trendUp : styles.trendDown}`}>
                  {wealthInfo.percentChange >= 0 ? `▲ +${wealthInfo.percentChange}%` : `▼ ${wealthInfo.percentChange}%`}
                </span>
              )}
            </div>
            {!privacyMode ? (
              <div className={styles.trendChartWrap}>
                <svg className={styles.trendSvg} viewBox="0 0 200 40" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="cashTrendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={wealthInfo.areaPath} fill="url(#cashTrendGrad)" />
                  <path d={wealthInfo.svgPath} fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            ) : (
              <div className={styles.trendPrivacyPlaceholder}>••••••••••••••••••••</div>
            )}
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
                <span className={`${styles.nextBillAmount} ${styles.nextBillAmountRed}`}>{fmt(wealthInfo.nextBill.amount || 0)}</span>
              </div>
            ) : (
              <p className={styles.emptyText}>All bills are paid! Beautiful.</p>
            )}
          </div>
        </div>
        <button type="button" className={`${styles.spaceChip} ${styles.spaceChipWealth}`} onClick={() => onNavigate('takda', 'calendar')}>
          Open Takda <span className={styles.spaceChipArrow} aria-hidden="true">→</span>
        </button>
      </section>
    ),
    healthCard: (
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
            <span className={`${styles.metricVal} ${styles.metricValHealth}`}>{habitsDoneCount} / {HABIT_OPTIONS.length}</span>
          </div>
          <div className={styles.habitsGrid}>
            {HABIT_OPTIONS.map(opt => {
              const isDone = Boolean(todayHabit[opt.key])
              return (
                <button key={opt.key} type="button" className={`${styles.habitPill} ${isDone ? styles.habitPillDone : ''}`} onClick={() => handleToggleHabit(opt.key, isDone)}>
                  <span className={styles.habitDot} aria-hidden="true">{isDone ? '✓' : '○'}</span>
                  <span className={styles.habitLabel}>{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>
        <button type="button" className={`${styles.spaceChip} ${styles.spaceChipHealth}`} onClick={() => onNavigate('lakas', 'workout')}>
          Open Lakas <span className={styles.spaceChipArrow} aria-hidden="true">→</span>
        </button>
      </section>
    ),
    mindCard: (
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
            <input type="range" min="1" max="5" step="1" value={moodRating} onChange={(e) => setMoodRating(Number(e.target.value))} className={styles.moodSlider} />
          </div>
          <div className={styles.widgetDivider} />
          <div className={styles.journalLogBlock}>
            <h3 className={styles.extraTitle}>Quick Reflection</h3>
            <textarea className={styles.quickJournalInput} placeholder="How was today in one sentence?" value={journalText} onChange={(e) => setJournalText(e.target.value)} rows={2} />
            <button type="button" className={styles.journalSubmitBtn} onClick={handleQuickJournal} disabled={!journalText.trim()}>Log Reflection</button>
          </div>
        </div>
        <button type="button" className={`${styles.spaceChip} ${styles.spaceChipMind}`} onClick={() => onNavigate('tala', 'journal')}>
          Open Tala <span className={styles.spaceChipArrow} aria-hidden="true">→</span>
        </button>
      </section>
    ),
    pulseFeed: (
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
          )) : <p className={styles.emptyText}>No recent activity.</p>}
        </div>
      </section>
    )
  }

  return (
    <div className={`${styles.container} ${isEditing ? styles.isEditingContainer : ''}`}>

      {/* ── HEADER ─────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.greetingGroup}>
          <h1 className={styles.title}>{greeting}</h1>
          <p className={styles.subtitle}>Your life control center — all in one view.</p>
          <div className={styles.dailyFocusWrap}>
            <span className={styles.dailyFocusIcon} aria-hidden="true">🎯</span>
            <input 
              type="text" 
              className={styles.dailyFocusInput} 
              placeholder="Set your #1 priority for today..."
              value={dailyFocus}
              onChange={(e) => setDailyFocus(e.target.value)}
              onBlur={handleSaveFocus}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.target.blur() } }}
              aria-label="Daily focus"
            />
          </div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.streakBadge} title="Combined wealth, health, and mind consistency streak">
            <span className={styles.streakEmoji}>🔥</span>
            <div className={styles.streakText}>
              <span className={styles.streakVal}>{streak} day{streak !== 1 ? 's' : ''}</span>
              <span className={styles.streakLabel}>Buhay Rhythm</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── WIDGET BOARD ─────────────────────── */}
      <div className={styles.widgetBoard}>
        {(layout || []).map((widgetId, idx) => (
          <div 
            key={widgetId} 
            className={`${styles.widgetWrapper} ${styles['widget_' + widgetId]} ${isEditing ? styles.widgetEditing : ''}`}
          >
            {isEditing && (
              <div className={styles.widgetEditBar}>
                <span className={styles.widgetEditLabel}>
                  <span className={styles.widgetEditIcon}>{WIDGET_ICONS[widgetId] || '📦'}</span>
                  {WIDGET_TITLES[widgetId]}
                </span>
                <div className={styles.widgetEditActions}>
                  <button
                    type="button"
                    className={styles.moveBtn}
                    onClick={() => moveWidget(widgetId, 'up')}
                    disabled={idx === 0}
                    aria-label={`Move ${WIDGET_TITLES[widgetId]} up`}
                  >▲</button>
                  <button
                    type="button"
                    className={styles.moveBtn}
                    onClick={() => moveWidget(widgetId, 'down')}
                    disabled={idx === layout.length - 1}
                    aria-label={`Move ${WIDGET_TITLES[widgetId]} down`}
                  >▼</button>
                  <button 
                    type="button"
                    className={styles.removeWidgetBtn} 
                    onClick={() => removeWidget(widgetId)}
                    aria-label={`Remove ${WIDGET_TITLES[widgetId]}`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
            {widgets[widgetId]}
          </div>
        ))}
      </div>

      {/* ── FLOATING EDIT TOOLBAR ───────────── */}
      {isEditing && (
        <div className={styles.editFloatingPillWrap}>
          <button 
            type="button" 
            className={styles.floatingAddPill} 
            onClick={() => setShowLibrary(true)}
          >
            <span aria-hidden="true" style={{ fontSize: '15px' }}>➕</span> Add Widget
          </button>
          <button 
            type="button" 
            className={styles.floatingDonePill} 
            onClick={toggleEditMode}
          >
            ✓ Done
          </button>
        </div>
      )}

      {/* ── WIDGET LIBRARY MODAL SHEET ───────────── */}
      {isEditing && showLibrary && (
        <div className={styles.modalBackdrop} onClick={() => setShowLibrary(false)}>
          <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>Widget Library</h3>
                <p className={styles.modalSubtitle}>Tap to add or remove widgets on your dashboard.</p>
              </div>
              <button 
                type="button" 
                className={styles.modalCloseBtn} 
                onClick={() => setShowLibrary(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className={styles.modalList}>
              {Object.keys(WIDGET_TITLES).map(id => {
                const isAdded = (layout || []).includes(id)
                return (
                  <button 
                    key={id} 
                    type="button"
                    className={`${styles.modalItem} ${isAdded ? styles.modalItemActive : ''}`} 
                    onClick={() => toggleWidget(id)}
                    title={isAdded ? `Remove ${WIDGET_TITLES[id]}` : `Add ${WIDGET_TITLES[id]}`}
                  >
                    <div className={styles.modalItemInfo}>
                      <span className={styles.modalItemTitle}>{WIDGET_TITLES[id]}</span>
                    </div>
                    {isAdded ? (
                      <span className={styles.modalItemAdded}>✓ Added</span>
                    ) : (
                      <span className={styles.modalItemAdd}>+ Add</span>
                    )}
                  </button>
                )
              })}
            </div>
            <div className={styles.modalFooter}>
              <button 
                type="button" 
                className={styles.modalDoneBtn} 
                onClick={() => setShowLibrary(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  )
}

// cache bust HMR
