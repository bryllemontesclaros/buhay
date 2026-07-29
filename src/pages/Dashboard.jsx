import { useState, useMemo, useEffect } from 'react'
import { fsAdd, fsUpdate, fsSetProfile, fsSavePortfolioHolding, fsDeletePortfolioHolding } from '../lib/firestore'
import { notifyApp } from '../lib/appFeedback'
import { today, formatDisplayDate, fmt } from '../lib/utils'
import { getBalanceAtDate } from '../lib/finance'
import { HABIT_OPTIONS, dateDaysAgo } from '../lib/lakasHelpers'
import { generateDashboardInsight } from '../lib/insights'
import { getPortfolioSummary, PORTFOLIO_ASSET_TYPES } from '../lib/portfolio'
import styles from './Dashboard.module.css'

// Default layout if user has no saved layout
const DEFAULT_LAYOUT = ['insightBanner', 'statStrip', 'wealthCard', 'portfolioWidget', 'healthCard', 'mindCard', 'pulseFeed']

const WIDGET_TITLES = {
  insightBanner: 'Smart Insight',
  statStrip: 'Key Stats Strip',
  wealthCard: 'Takda Wealth Card',
  portfolioWidget: 'Investment Portfolio',
  healthCard: 'Lakas Health Card',
  mindCard: 'Tala Mind Card',
  pulseFeed: 'The Pulse Feed',
}

export default function Dashboard({ user, data, profile, onNavigate, privacyMode = false, s = '₱', exchangeRates = null, assetPrices = null }) {
  const [journalText, setJournalText] = useState('')
  const [moodRating, setMoodRating] = useState(3)
  const [isEditing, setIsEditing] = useState(false)
  const [layout, setLayout] = useState(profile?.dashboardLayout || DEFAULT_LAYOUT)

  // Portfolio Widget Modal States
  const [showPortfolioModal, setShowPortfolioModal] = useState(false)
  const [editingHolding, setEditingHolding] = useState(null)
  const [portfolioForm, setPortfolioForm] = useState({
    name: '',
    symbol: '',
    assetType: 'stock',
    quantity: '',
    averageBuyPrice: '',
    currentPrice: '',
    currency: 'PHP',
  })
  const [showAllHoldingsModal, setShowAllHoldingsModal] = useState(false)
  const [portfolioFilter, setPortfolioFilter] = useState('all')
  const [isSavingHolding, setIsSavingHolding] = useState(false)

  useEffect(() => {
    if (profile?.dashboardLayout) {
      setLayout(profile.dashboardLayout)
    }
  }, [profile?.dashboardLayout])
  
  const todayStr = today()

  // Calculate Portfolio Summary (Holdings, Market Value, Gain/Loss)
  const portfolioSummary = useMemo(() => {
    const holdingsWithLivePrices = (data.portfolioHoldings || []).map(h => {
      if (assetPrices && assetPrices[h.symbol]) {
        return { ...h, currentPrice: assetPrices[h.symbol], isLivePrice: true }
      }
      return h
    })
    return getPortfolioSummary(holdingsWithLivePrices, exchangeRates)
  }, [data.portfolioHoldings, exchangeRates, assetPrices])

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
    const portfolioMarketValue = portfolioSummary.marketValue || 0
    const netWorth = totalCash + portfolioMarketValue - totalCCDebt

    const upcomingBills = (data.bills || [])
      .filter(b => !b.isPaid && b.dueDate >= todayStr)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

    return { netWorth, totalCash, totalCCDebt, portfolioMarketValue, nextBill: upcomingBills[0] }
  }, [data.accounts, data.bills, todayStr, portfolioSummary])

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

  const toggleEditMode = () => {
    setIsEditing(!isEditing)
  }

  const removeWidget = (id) => {
    const newLayout = layout.filter(w => w !== id)
    saveLayout(newLayout)
  }

  const addWidget = (id) => {
    if (!layout.includes(id)) {
      const newLayout = [...layout, id]
      saveLayout(newLayout)
    }
  }

  const openAddPortfolioHolding = () => {
    setEditingHolding(null)
    setPortfolioForm({
      name: '',
      symbol: '',
      assetType: 'stock',
      quantity: '',
      averageBuyPrice: '',
      currentPrice: '',
      currency: profile?.currency || 'PHP',
    })
    setShowPortfolioModal(true)
  }

  const openEditPortfolioHolding = (holding) => {
    setEditingHolding(holding)
    setPortfolioForm({
      name: holding.name || '',
      symbol: holding.symbol || '',
      assetType: holding.assetType || 'stock',
      quantity: String(holding.quantity ?? ''),
      averageBuyPrice: String(holding.averageBuyPrice ?? ''),
      currentPrice: String(holding.currentPrice ?? ''),
      currency: holding.currency || profile?.currency || 'PHP',
    })
    setShowPortfolioModal(true)
  }

  const closePortfolioModal = () => {
    setShowPortfolioModal(false)
    setEditingHolding(null)
  }

  const handleSavePortfolioHolding = async (e) => {
    if (e) e.preventDefault()
    if (!user?.uid) return
    const name = portfolioForm.name.trim()
    const symbol = portfolioForm.symbol.trim().toUpperCase()
    const quantity = parseFloat(portfolioForm.quantity)
    const currentPrice = parseFloat(portfolioForm.currentPrice)
    const averageBuyPrice = parseFloat(portfolioForm.averageBuyPrice) || currentPrice || 0

    if (!name && !symbol) {
      notifyApp({ title: 'Holding needs a name', message: 'Enter a name or ticker symbol for this asset.', tone: 'warning' })
      return
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      notifyApp({ title: 'Invalid quantity', message: 'Quantity must be greater than zero.', tone: 'warning' })
      return
    }
    if (!Number.isFinite(currentPrice) || currentPrice < 0) {
      notifyApp({ title: 'Invalid price', message: 'Current price cannot be negative.', tone: 'warning' })
      return
    }

    setIsSavingHolding(true)
    try {
      await fsSavePortfolioHolding(user.uid, {
        ...(editingHolding ? { _id: editingHolding._id } : {}),
        name: name || symbol,
        symbol: symbol || name,
        assetType: portfolioForm.assetType,
        quantity,
        averageBuyPrice,
        currentPrice,
        currency: portfolioForm.currency,
      })
      notifyApp({
        title: editingHolding ? 'Holding updated' : 'Asset added',
        message: `${name || symbol} saved to your investment portfolio.`,
        tone: 'success',
      })
      closePortfolioModal()
    } catch (err) {
      console.error('Failed to save portfolio holding', err)
      notifyApp({ title: 'Error saving asset', message: 'Check your network connection and try again.', tone: 'error' })
    } finally {
      setIsSavingHolding(false)
    }
  }

  const handleDeletePortfolioHolding = async (holding) => {
    if (!user?.uid || !holding?._id) return
    try {
      await fsDeletePortfolioHolding(user.uid, holding._id)
      notifyApp({ title: 'Asset removed', message: `${holding.name || holding.symbol} removed from portfolio.`, tone: 'success' })
      if (editingHolding?._id === holding._id) closePortfolioModal()
    } catch (err) {
      console.error('Failed to delete holding', err)
      notifyApp({ title: 'Delete failed', message: 'Could not remove holding.', tone: 'error' })
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
    portfolioWidget: (
      <section className={`${styles.card} ${styles.portfolioCard}`} aria-label="Investment Portfolio">
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleBlock}>
            <span className={styles.cardEmoji} aria-hidden="true">📈</span>
            <h2 className={styles.cardTitle}>Portfolio</h2>
          </div>
          <span className={styles.cardTag}>Takda</span>
        </div>
        <div className={styles.bentoBody}>
          <div className={styles.metricBlock}>
            <span className={styles.metricLabel}>Total Value</span>
            <span className={`${styles.metricVal} ${styles.metricValWealth}`}>{fmt(portfolioSummary.marketValue || 0)}</span>
          </div>
          <div className={styles.subMetricsGrid}>
            <div className={styles.subMetric}>
              <span className={styles.subMetricLabel}>Total Gain/Loss</span>
              <span className={`${styles.subMetricVal} ${(portfolioSummary.totalProfit || 0) >= 0 ? styles.subMetricValGreen : styles.subMetricValRed}`}>
                {(portfolioSummary.totalProfit || 0) >= 0 ? '+' : ''}{fmt(portfolioSummary.totalProfit || 0)}
              </span>
            </div>
            <div className={styles.subMetric}>
              <span className={styles.subMetricLabel}>Invested</span>
              <span className={styles.subMetricVal}>{fmt(portfolioSummary.totalInvested || 0)}</span>
            </div>
          </div>
          <div className={styles.widgetDivider} />
          
          <div className={styles.portfolioHoldings}>
            <div className={styles.holdingsHeader}>
              <h3 className={styles.extraTitle}>Top Assets</h3>
              <button className={styles.textBtn} onClick={() => setShowAllHoldingsModal(true)}>View All</button>
            </div>
            {data.portfolioHoldings && data.portfolioHoldings.length > 0 ? (
              <div className={styles.holdingsList}>
                {data.portfolioHoldings.slice(0, 4).map(asset => {
                  const currentPrice = assetPrices?.[asset.symbol] || asset.currentPrice || exchangeRates?.[asset.symbol] || 0
                  const assetValue = asset.quantity * currentPrice
                  return (
                    <div key={asset._id} className={styles.holdingItem} onClick={() => openAddPortfolioHolding(asset)}>
                      <div className={styles.holdingDetails}>
                        <span className={styles.holdingSymbol}>{asset.symbol}</span>
                        <span className={styles.holdingName}>{asset.name}</span>
                      </div>
                      <div className={styles.holdingValues}>
                        <span className={styles.holdingValue}>{fmt(assetValue)}</span>
                        <span className={styles.holdingShares}>
                          {asset.quantity} {asset.assetType === 'crypto' ? 'coins' : 'shares'}
                          {assetPrices?.[asset.symbol] && <span className={styles.livePriceIndicator} title="Live Price"> ⚡</span>}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className={styles.emptyPortfolio}>
                <p className={styles.emptyText}>No assets yet.</p>
              </div>
            )}
            <button className={styles.addAssetBtn} onClick={() => openAddPortfolioHolding()}>
              + Add Asset
            </button>
          </div>
        </div>
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
          <button className={styles.editDashboardBtn} onClick={toggleEditMode}>
            {isEditing ? 'Done' : 'Edit'}
          </button>
        </div>
      </header>

      {/* ── WIDGET BOARD ─────────────────────── */}
      <div className={styles.widgetBoard}>
        {(layout || []).map(widgetId => (
          <div 
            key={widgetId} 
            className={`${styles.widgetWrapper} ${styles['widget_' + widgetId]} ${isEditing ? styles.widgetJiggle : ''}`}
            style={{ animationDelay: `${Math.random() * 0.2}s` }}
          >
            {isEditing && (
              <button 
                className={styles.removeWidgetBtn} 
                onClick={() => removeWidget(widgetId)}
                aria-label={`Remove ${WIDGET_TITLES[widgetId]}`}
              >
                ✕
              </button>
            )}
            {widgets[widgetId]}
          </div>
        ))}
      </div>

      {/* ── WIDGET LIBRARY DRAWER ───────────── */}
      {isEditing && (
        <div className={styles.widgetDrawer}>
          <h3 className={styles.drawerTitle}>Widget Library</h3>
          <p className={styles.drawerSubtitle}>Explore and add widgets to your dashboard.</p>
          <div className={styles.drawerList}>
            {Object.keys(WIDGET_TITLES).map(id => {
              const isAdded = (layout || []).includes(id)
              return (
                <button 
                  key={id} 
                  className={`${styles.drawerItem} ${isAdded ? styles.drawerItemDisabled : ''}`} 
                  onClick={() => addWidget(id)}
                  disabled={isAdded}
                >
                  <span className={styles.drawerItemTitle}>{WIDGET_TITLES[id]}</span>
                  {isAdded ? (
                    <span className={styles.drawerItemAdded}>Added</span>
                  ) : (
                    <span className={styles.drawerItemAdd}>+ Add</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── PORTFOLIO MODALS ────────────────── */}
      {showPortfolioModal && (
        <div className={styles.modalOverlay} onClick={closePortfolioModal}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{editingHolding ? 'Edit Asset' : 'Add Asset'}</h3>
              <button className={styles.closeModalBtn} onClick={closePortfolioModal}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <label className={styles.inputGroup}>
                <span className={styles.inputLabel}>Asset Type</span>
                <select className={styles.inputField} value={pFormType} onChange={e => setPFormType(e.target.value)}>
                  <option value="stock">Stock/ETF</option>
                  <option value="crypto">Cryptocurrency</option>
                  <option value="bond">Bonds/Fixed Income</option>
                  <option value="real_estate">Real Estate / REIT</option>
                  <option value="other">Other Asset</option>
                </select>
              </label>
              <label className={styles.inputGroup}>
                <span className={styles.inputLabel}>Symbol or Ticker</span>
                <input className={styles.inputField} type="text" placeholder="e.g. AAPL, BTC" value={pFormSymbol} onChange={e => setPFormSymbol(e.target.value.toUpperCase())} />
              </label>
              <label className={styles.inputGroup}>
                <span className={styles.inputLabel}>Asset Name</span>
                <input className={styles.inputField} type="text" placeholder="e.g. Apple Inc." value={pFormName} onChange={e => setPFormName(e.target.value)} />
              </label>
              <div className={styles.inputRow}>
                <label className={styles.inputGroup}>
                  <span className={styles.inputLabel}>Shares / Amount</span>
                  <input className={styles.inputField} type="number" step="any" placeholder="0.0" value={pFormShares} onChange={e => setPFormShares(e.target.value)} />
                </label>
                <label className={styles.inputGroup}>
                  <span className={styles.inputLabel}>Avg Price (Buy)</span>
                  <input className={styles.inputField} type="number" step="any" placeholder="0.00" value={pFormAvgPrice} onChange={e => setPFormAvgPrice(e.target.value)} />
                </label>
              </div>
              <label className={styles.inputGroup}>
                <span className={styles.inputLabel}>Current Price (optional)</span>
                <input className={styles.inputField} type="number" step="any" placeholder="Overrides automatic pricing if set" value={pFormCurrentPrice} onChange={e => setPFormCurrentPrice(e.target.value)} />
              </label>
            </div>
            <div className={styles.modalFooter}>
              {editingHolding && (
                <button 
                  className={styles.deleteAssetBtn} 
                  onClick={() => handleDeletePortfolioHolding(editingHolding)}
                >
                  Delete
                </button>
              )}
              <button 
                className={styles.saveAssetBtn} 
                onClick={handleSavePortfolioHolding} 
                disabled={isSavingHolding || !pFormSymbol || !pFormShares}
              >
                {isSavingHolding ? 'Saving...' : 'Save Asset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAllHoldingsModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAllHoldingsModal(false)}>
          <div className={`${styles.modalContent} ${styles.modalContentLarge}`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>All Portfolio Assets</h3>
              <button className={styles.closeModalBtn} onClick={() => setShowAllHoldingsModal(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              {data.portfolioHoldings && data.portfolioHoldings.length > 0 ? (
                <div className={styles.allHoldingsList}>
                  {data.portfolioHoldings.map(asset => {
                    const currentPrice = assetPrices?.[asset.symbol] || asset.currentPrice || exchangeRates?.[asset.symbol] || 0
                    const assetValue = asset.quantity * currentPrice
                    const assetProfit = assetValue - (asset.quantity * asset.averageBuyPrice)
                    return (
                      <div key={asset._id} className={styles.holdingItemFull} onClick={() => openAddPortfolioHolding(asset)}>
                        <div className={styles.holdingDetailsFull}>
                          <span className={styles.holdingSymbolFull}>
                            {asset.symbol}
                            {assetPrices?.[asset.symbol] && <span className={styles.livePriceIndicator} title="Live Price">⚡</span>}
                          </span>
                          <span className={styles.holdingNameFull}>{asset.name}</span>
                          <span className={styles.holdingTypeFull}>{asset.assetType}</span>
                        </div>
                        <div className={styles.holdingValuesFull}>
                          <span className={styles.holdingValueFull}>{fmt(assetValue)}</span>
                          <span className={`${styles.holdingProfitFull} ${assetProfit >= 0 ? styles.subMetricValGreen : styles.subMetricValRed}`}>
                            {assetProfit >= 0 ? '+' : ''}{fmt(assetProfit)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className={styles.emptyText}>No assets yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      
    </div>
  )
}

export default Dashboard
