import { getCurrencySymbol, getMonthKey, maskMoney, today as todayKey, toMonthKey } from './utils'
import { getBillPeriodInfo } from './bills'

// Notification engine — generates in-app alerts based on user data

export const DEFAULT_NOTIFICATION_PREFS = {
  budget: true,
  bills: true,
  goals: true,
  spending: true,
}

export function getNotificationPrefs(profile = {}) {
  return {
    ...DEFAULT_NOTIFICATION_PREFS,
    ...(profile?.notificationPrefs || {}),
  }
}

export function getAlerts(data, profile, privacyMode = false) {
  const alerts = []
  const now = new Date()
  const ym = toMonthKey(now.getFullYear(), now.getMonth())
  const prefs = getNotificationPrefs(profile)
  const symbol = getCurrencySymbol(profile?.currency || 'PHP')

  // 1. Budget overspending alerts
  const spending = {}
  data.expenses.filter(t => getMonthKey(t.date) === ym).forEach(t => {
    spending[t.cat] = (spending[t.cat] || 0) + (t.amount || 0)
  })

  if (prefs.budget) {
    data.budgets.forEach(b => {
      const spent = spending[b.cat] || 0
      const pct = spent / b.limit
      if (pct >= 1) {
        alerts.push({
          id: `budget-over-${b.cat}`,
          type: 'danger',
          icon: '⚠',
          title: `Over budget — ${b.cat}`,
          body: `You've exceeded your ${b.cat} budget by ${formatOver(spent - b.limit, privacyMode, symbol)}.`,
          priority: 1,
        })
      } else if (pct >= 0.8) {
        alerts.push({
          id: `budget-warn-${b.cat}`,
          type: 'warning',
          icon: '⚡',
          title: `Budget warning — ${b.cat}`,
          body: `${Math.round(pct * 100)}% of your ${b.cat} budget used. ${formatOver(b.limit - spent, privacyMode, symbol)} remaining.`,
          priority: 2,
        })
      }
    })
  }

  // 2. Bills due soon (within next 3 days or overdue this month)
  if (prefs.bills) {
    data.bills.forEach(b => {
      const period = getBillPeriodInfo(b, now)
      if (period.paid) return
      if (period.daysUntil < 0) {
        alerts.push({
          id: `bill-overdue-${b._id}-${period.key}`,
          type: 'danger',
          icon: '📄',
          title: `Bill overdue — ${b.name}`,
          body: `${b.name} was due on day ${b.due}. Mark it paid when settled.`,
          action: { type: 'payBill', label: 'Mark paid', page: 'bills', billId: b._id },
          priority: 1,
        })
      } else if (period.daysUntil <= 3) {
        alerts.push({
          id: `bill-due-${b._id}-${period.key}`,
          type: 'warning',
          icon: '📄',
          title: `Bill due in ${period.daysUntil === 0 ? 'today' : period.daysUntil + ' day' + (period.daysUntil > 1 ? 's' : '')} — ${b.name}`,
          body: `${b.name} payment of ${privacyMode ? maskMoney(symbol) : formatOver(b.amount || 0, false, symbol)} is due ${period.daysUntil === 0 ? 'today' : `in ${period.daysUntil} days`}.`,
          action: { type: 'payBill', label: 'Mark paid', page: 'bills', billId: b._id },
          priority: 2,
        })
      }
    })
  }

  // 3. Savings goals near completion
  if (prefs.goals) {
    data.goals.forEach(g => {
      const pct = (g.current || 0) / (g.target || 1)
      if (pct >= 1) {
        alerts.push({
          id: `goal-done-${g._id}`,
          type: 'success',
          icon: '🎯',
          title: `Goal reached — ${g.name}`,
          body: `Congrats! You've reached your ${g.name} savings goal.`,
          priority: 3,
        })
      } else if (pct >= 0.9) {
        alerts.push({
          id: `goal-near-${g._id}`,
          type: 'info',
          icon: '🎯',
          title: `Almost there — ${g.name}`,
          body: `You're ${Math.round(pct * 100)}% of the way to your ${g.name} goal. Keep it up!`,
          priority: 3,
        })
      }
    })
  }

  // 4. High spending day (today > 20% of monthly budget)
  const totalBudget = data.budgets.reduce((s, b) => s + (b.limit || 0), 0)
  const todayStr = todayKey()
  const todaySpend = data.expenses.filter(t => t.date === todayStr).reduce((s, t) => s + (t.amount || 0), 0)
  if (prefs.spending && totalBudget > 0 && todaySpend > totalBudget * 0.2) {
    alerts.push({
      id: 'high-spend-today',
      type: 'warning',
      icon: '💸',
      title: 'High spending today',
      body: `You've spent ${privacyMode ? maskMoney(symbol) : formatOver(todaySpend, false, symbol)} today — over 20% of your monthly budget in one day.`,
      priority: 2,
    })
  }

  return alerts.sort((a, b) => a.priority - b.priority)
}

function formatOver(n, hidden = false, symbol = '₱') {
  if (hidden) return maskMoney(symbol)
  return symbol + Math.abs(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Browser push notification request
export async function requestPushPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

// Send browser push notification
export function sendPushNotification(title, body, icon = '/favicon.svg') {
  if (Notification.permission !== 'granted') return
  new Notification(title, { body, icon })
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function numOrZero(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function daysAgoStr(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysUntil(dateStr) {
  return Math.ceil((new Date(`${dateStr}T00:00:00`) - new Date()) / (1000 * 60 * 60 * 24))
}

// ─── Lakas alert engine ───────────────────────────────────────────────────────

export function getLakasAlerts(data, _profile, _privacyMode = false) {
  const alerts = []
  const workouts = data.lakasWorkouts || []
  const goals = data.lakasGoals || []
  const now = todayKey()
  const yesterday = daysAgoStr(1)
  const sevenDaysAgo = daysAgoStr(7)

  const workoutDates = new Set(workouts.map(w => w.date))

  // Measure consecutive streak ending yesterday or today
  let streak = 0
  for (let i = 0; i <= 14; i++) {
    if (workoutDates.has(daysAgoStr(i))) streak++
    else if (i > 0) break // gap found — stop
  }

  const hadToday = workoutDates.has(now)
  const hadYesterday = workoutDates.has(yesterday)

  // 1. Streak at risk: worked out yesterday but not today
  if (!hadToday && hadYesterday && streak >= 2) {
    alerts.push({
      id: 'lakas-streak-risk',
      type: 'warning',
      icon: '⚡',
      title: 'Streak at risk',
      body: `You've got a ${streak}-day streak. Log a workout today to keep it going.`,
      action: { type: 'navigate', label: 'Log workout', page: 'today' },
      priority: 2,
    })
  }

  // 2. Streak broken: had ≥3-day streak, no workout for 2+ days
  const recentStreak = (() => {
    let s = 0
    for (let i = 1; i <= 14; i++) {
      if (workoutDates.has(daysAgoStr(i))) s++
      else break
    }
    return s
  })()
  if (!hadToday && !hadYesterday && recentStreak >= 3) {
    alerts.push({
      id: 'lakas-streak-broken',
      type: 'danger',
      icon: '🔥',
      title: 'Workout streak broken',
      body: `You had a ${recentStreak}-day streak. Log a session today to start a new one.`,
      action: { type: 'navigate', label: 'Log workout', page: 'today' },
      priority: 1,
    })
  }

  // 3. No workout at all this week
  const thisWeekWorkouts = workouts.filter(w => w.date >= sevenDaysAgo)
  if (thisWeekWorkouts.length === 0) {
    alerts.push({
      id: 'lakas-no-workout-week',
      type: 'danger',
      icon: '💪',
      title: 'No workouts this week',
      body: 'You haven\'t logged a session in 7 days. Even a short workout counts.',
      action: { type: 'navigate', label: 'Start workout', page: 'today' },
      priority: 1,
    })
  }

  // 4. Fitness goal deadline within 7 days
  goals.filter(g => numOrZero(g.progress) < 100 && g.targetDate).forEach(g => {
    const left = daysUntil(g.targetDate)
    if (left >= 0 && left <= 7) {
      alerts.push({
        id: `lakas-goal-deadline-${g._id}`,
        type: 'warning',
        icon: '🎯',
        title: `Goal deadline — ${g.name || 'Fitness goal'}`,
        body: `${left === 0 ? 'Due today' : `${left} day${left > 1 ? 's' : ''} left`} to reach "${g.name || 'your goal'}".`,
        action: { type: 'navigate', label: 'View goals', page: 'goals' },
        priority: 2,
      })
    }
  })

  return alerts.sort((a, b) => a.priority - b.priority)
}

// ─── Tala alert engine ────────────────────────────────────────────────────────

export function getTalaAlerts(data, _profile, privacyMode = false) {
  const alerts = []
  const checkins = data.talaCheckins || []
  const moods = data.talaMoods || []
  const tasks = data.talaTasks || []
  const goals = data.talaGoals || []
  const now = todayKey()

  // 1. No check-in today
  const todayCheckin = checkins.find(c => c.date === now)
  if (!todayCheckin) {
    alerts.push({
      id: 'tala-no-checkin-today',
      type: 'info',
      icon: '🌤️',
      title: 'No check-in yet today',
      body: 'A 30-second check-in helps you notice your day without overthinking it.',
      action: { type: 'navigate', label: 'Check in now', page: 'track' },
      priority: 3,
    })
  }

  // 2. Overdue tasks
  const overdue = tasks.filter(t => !t.done && t.dueDate && t.dueDate < now)
  if (overdue.length >= 3) {
    alerts.push({
      id: 'tala-many-overdue-tasks',
      type: 'danger',
      icon: '📋',
      title: `${overdue.length} overdue tasks`,
      body: 'Several tasks are past due. Choose one to clear, shrink, or reschedule.',
      action: { type: 'navigate', label: 'View tasks', page: 'focus' },
      priority: 1,
    })
  } else if (overdue.length === 1 || overdue.length === 2) {
    alerts.push({
      id: `tala-overdue-task-${overdue[0]._id}`,
      type: 'warning',
      icon: '📋',
      title: `Overdue — ${overdue[0].title || 'Task'}`,
      body: `"${overdue[0].title || 'A task'}" is past its due date. Mark it done or reschedule.`,
      action: { type: 'navigate', label: 'View tasks', page: 'focus' },
      priority: 2,
    })
  }

  // 3. Low mood pattern (last 3 logged moods are Low or Heavy)
  if (!privacyMode) {
    const sorted = [...moods].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    const last3 = sorted.slice(0, 3)
    if (last3.length === 3 && last3.every(m => ['Low', 'Heavy'].includes(m.mood))) {
      alerts.push({
        id: 'tala-low-mood-pattern',
        type: 'danger',
        icon: '🌧️',
        title: 'Low mood pattern noticed',
        body: 'Your last 3 logged moods have been Low or Heavy. A short journal entry or calm plan may help.',
        action: { type: 'navigate', label: 'Open journal', page: 'journal' },
        priority: 1,
      })
    }
  }

  // 4. Personal goal deadline within 7 days
  goals.filter(g => numOrZero(g.progress) < 100 && g.targetDate).forEach(g => {
    const left = daysUntil(g.targetDate)
    if (left >= 0 && left <= 7) {
      alerts.push({
        id: `tala-goal-deadline-${g._id}`,
        type: 'warning',
        icon: '🎯',
        title: `Goal deadline — ${g.name || 'Personal goal'}`,
        body: `${left === 0 ? 'Due today' : `${left} day${left > 1 ? 's' : ''} left`} on "${g.name || 'your goal'}".`,
        action: { type: 'navigate', label: 'View goals', page: 'focus' },
        priority: 2,
      })
    }
  })

  return alerts.sort((a, b) => a.priority - b.priority)
}

// ─── Space router ─────────────────────────────────────────────────────────────

export function getSpaceAlerts(space, data, profile, privacyMode = false) {
  if (space === 'lakas') return getLakasAlerts(data, profile, privacyMode)
  if (space === 'tala') return getTalaAlerts(data, profile, privacyMode)
  return getAlerts(data, profile, privacyMode)
}
