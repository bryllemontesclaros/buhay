import { getCurrencySymbol, getMonthKey, maskMoney, today as todayKey, toMonthKey } from './utils'
import { getBillPeriodInfo, getVirtualBills } from './bills'
import { getAccountSignedBalance } from './finance'

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

  if (prefs.bills) {
    const virtualBills = getVirtualBills(data)
    const allBills = [...data.bills, ...virtualBills]
    allBills.forEach(b => {
      const period = getBillPeriodInfo(b, now)
      if (period.paid) return
      
      const action = b.isVirtual
        ? { type: 'payDebt', label: 'Pay now', page: 'debts', debtId: b.originalDebtId }
        : { type: 'payBill', label: 'Mark paid', page: 'bills', billId: b._id }
        
      if (period.daysUntil < 0) {
        alerts.push({
          id: `bill-overdue-${b._id}-${period.key}`,
          type: 'danger',
          icon: '📄',
          title: `${b.isVirtual ? 'Debt' : 'Bill'} overdue — ${b.name}`,
          body: `${b.name} was due on day ${b.due}. Mark it paid when settled.`,
          action,
          priority: 1,
        })
      } else if (period.daysUntil <= 3) {
        alerts.push({
          id: `bill-due-${b._id}-${period.key}`,
          type: 'warning',
          icon: '📄',
          title: `${b.isVirtual ? 'Debt' : 'Bill'} due in ${period.daysUntil === 0 ? 'today' : period.daysUntil + ' day' + (period.daysUntil > 1 ? 's' : '')} — ${b.name}`,
          body: `${b.name} payment of ${privacyMode ? maskMoney(symbol) : formatOver(b.amount || 0, false, symbol)} is due ${period.daysUntil === 0 ? 'today' : `in ${period.daysUntil} days`}.`,
          action,
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

  // 5. Credit card utilization alerts
  const accountsList = data.accounts || []
  accountsList.filter(a => a.type === 'Credit Card' && (Number(a.creditLimit) || 0) > 0).forEach(a => {
    const signedBalance = Math.abs(getAccountSignedBalance(a))
    const limit = Number(a.creditLimit) || 0
    const pct = signedBalance / limit
    if (pct >= 0.9) {
      alerts.push({
        id: `credit-utilization-critical-${a._id}`,
        type: 'danger',
        icon: '💳',
        title: `Max utilization warning — ${a.name}`,
        body: `${a.name} is at ${Math.round(pct * 100)}% utilization. Only ${formatOver(limit - signedBalance, privacyMode, symbol)} available credit remains.`,
        priority: 1,
      })
    }
  })

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

export function getSpaceAlerts(space, data, profile, privacyMode = false) {
  return getAlerts(data, profile, privacyMode)
}
