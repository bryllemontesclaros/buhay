import { today } from './utils'

// Cash Flow Forecasting Engine
// Calculates projected running balance for each day of a month

function getStatusForDay(ds, runningBalance, startingBalance, todayStr) {
  if (ds > todayStr) {
    if (runningBalance < 0) return 'negative'
    if (runningBalance < startingBalance * 0.2) return 'tight'
    return 'positive'
  }

  if (ds === todayStr) {
    if (runningBalance < 0) return 'negative'
    if (runningBalance < 1000) return 'tight'
    return 'positive'
  }

  return 'neutral'
}

/**
 * Build a day-by-day cash flow map for a given month
 * Returns: { 'YYYY-MM-DD': { income, expense, net, runningBalance, status } }
 * status: 'positive' | 'tight' | 'negative'
 */
export function buildForecast(allIncome, allExpenses, year, month, startingBalance = 0) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const ym = `${year}-${String(month + 1).padStart(2, '0')}`

  // Build per-day totals
  const dayMap = {}
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${ym}-${String(d).padStart(2, '0')}`
    dayMap[ds] = { income: 0, expense: 0, net: 0, runningBalance: 0, status: 'neutral' }
  }

  // Sum income per day
  allIncome.forEach(t => {
    if (t.date && dayMap[t.date]) {
      dayMap[t.date].income += t.amount || 0
    }
  })

  // Sum expenses per day
  allExpenses.forEach(t => {
    if (t.date && dayMap[t.date]) {
      dayMap[t.date].expense += t.amount || 0
    }
  })

  // Calculate running balance day by day
  let running = startingBalance
  const todayStr = today()

  Object.keys(dayMap).sort().forEach(ds => {
    const day = dayMap[ds]
    day.net = day.income - day.expense
    running += day.net
    day.runningBalance = running
    day.status = getStatusForDay(ds, running, startingBalance, todayStr)
  })

  return dayMap
}

export function applyBalanceOverridesToForecast(forecastMap = {}, year, month, balanceOverrides = {}, startingBalance = 0) {
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}-`
  const overrideEntries = Object.entries(balanceOverrides)
    .filter(([date, value]) => date.startsWith(monthPrefix) && Number.isFinite(Number(value)))
    .sort(([left], [right]) => left.localeCompare(right))

  if (!overrideEntries.length) return forecastMap

  const sortedDays = Object.keys(forecastMap).sort()
  const nextMap = Object.fromEntries(
    sortedDays.map(date => [date, { ...forecastMap[date] }]),
  )
  const todayStr = today()

  overrideEntries.forEach(([overrideDate, overrideBalance]) => {
    const currentDay = nextMap[overrideDate]
    if (!currentDay) return

    const delta = Number(overrideBalance) - currentDay.runningBalance
    if (!Number.isFinite(delta) || delta === 0) return

    sortedDays.forEach(date => {
      if (date >= overrideDate) nextMap[date].runningBalance += delta
    })
  })

  sortedDays.forEach(date => {
    nextMap[date].status = getStatusForDay(date, nextMap[date].runningBalance, startingBalance, todayStr)
  })

  return nextMap
}

/**
 * Get status color vars for a day
 */
export function getForecastColor(status) {
  switch (status) {
    case 'positive': return { bg: 'rgba(34,216,122,0.08)', border: 'rgba(34,216,122,0.3)', text: 'var(--accent)' }
    case 'tight': return { bg: 'rgba(255,179,71,0.08)', border: 'rgba(255,179,71,0.3)', text: 'var(--amber)' }
    case 'negative': return { bg: 'rgba(255,83,112,0.1)', border: 'rgba(255,83,112,0.35)', text: 'var(--red)' }
    default: return { bg: '', border: '', text: '' }
  }
}

/**
 * Calculate end-of-month projected balance
 */
export function getEndOfMonthBalance(forecastMap) {
  const days = Object.keys(forecastMap).sort()
  if (!days.length) return 0
  return forecastMap[days[days.length - 1]].runningBalance
}

/**
 * Get projected impact of a new transaction
 * Returns: days that would change status
 */
export function getTransactionImpact(forecastMap, date, amount, type, options = {}) {
  const impact = type === 'income' ? amount : -amount
  const stopAtDate = options?.stopAtDate || ''
  const days = Object.keys(forecastMap).sort().filter(d => d >= date && (!stopAtDate || d < stopAtDate))

  let willTurnRed = false
  let willTurnAmber = false

  days.forEach(d => {
    const newBalance = forecastMap[d].runningBalance + impact
    if (newBalance < 0) willTurnRed = true
    else if (newBalance < 1000) willTurnAmber = true
  })

  if (willTurnRed) {
    return {
      level: 'negative',
      msg: type === 'income'
        ? '⚠ This income helps, but your balance still dips negative.'
        : '⚠ This expense may push your balance negative.',
    }
  }
  if (willTurnAmber) {
    return {
      level: 'tight',
      msg: type === 'income'
        ? '⚡ This income helps, but your balance still enters the tight zone.'
        : '⚡ This expense will put your balance in the tight zone.',
    }
  }
  if (type === 'income') return { level: 'positive', msg: '✓ This income improves your projected balance.' }
  return { level: 'ok', msg: '✓ Your balance stays healthy after this.' }
}
