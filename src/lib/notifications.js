import { getMonthKey, maskMoney, today as todayKey, toMonthKey } from './utils'
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
          body: `You've exceeded your ${b.cat} budget by ${formatOver(spent - b.limit, privacyMode)}.`,
          priority: 1,
        })
      } else if (pct >= 0.8) {
        alerts.push({
          id: `budget-warn-${b.cat}`,
          type: 'warning',
          icon: '⚡',
          title: `Budget warning — ${b.cat}`,
          body: `${Math.round(pct * 100)}% of your ${b.cat} budget used. ${formatOver(b.limit - spent, privacyMode)} remaining.`,
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
          body: `${b.name} payment of ${privacyMode ? maskMoney() : formatOver(b.amount || 0, false)} is due ${period.daysUntil === 0 ? 'today' : `in ${period.daysUntil} days`}.`,
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
      body: `You've spent ${privacyMode ? maskMoney() : formatOver(todaySpend, false)} today — over 20% of your monthly budget in one day.`,
      priority: 2,
    })
  }

  return alerts.sort((a, b) => a.priority - b.priority)
}

function formatOver(n, hidden = false) {
  if (hidden) return maskMoney()
  return '₱' + Math.abs(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
