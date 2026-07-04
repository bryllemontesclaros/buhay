function normalizeDate(value) {
  if (!value) return ''
  if (typeof value === 'string') {
    const trimmed = value.trim()
    const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (iso) {
      const [, year, month, day] = iso
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function today() {
  // Let's mock today as July 3, 2026
  return "2026-07-03";
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getAccountSignedBalance(account = {}) {
  const value = Number(account?.balance) || 0
  if (String(account?.type || '').toLowerCase() === 'credit card') {
    return -Math.abs(value)
  }
  return value
}

function getCurrentBalance(accounts = []) {
  return accounts.reduce((sum, account) => sum + getAccountSignedBalance(account), 0)
}

function toLedgerEntry(tx = {}, sign = 1) {
  const amount = Number(tx?.amount) || 0
  if (!amount) return null
  const date = normalizeDate(tx?.date)
  if (!date) return null
  return {
    _id: tx._id,
    date,
    amount,
    signedAmount: amount * sign,
    createdAt: tx.createdAt || 0,
  }
}

function getActualLedger(income = [], expenses = []) {
  return [
    ...income.filter(tx => String(tx?.paymentStatus || 'paid').toLowerCase() !== 'unpaid').map(tx => toLedgerEntry(tx, 1)),
    ...expenses.filter(tx => String(tx?.paymentStatus || 'paid').toLowerCase() !== 'unpaid').map(tx => toLedgerEntry(tx, -1)),
  ]
    .filter(Boolean)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return (a.createdAt || 0) - (b.createdAt || 0)
    })
}

function getBalanceAtDate(accounts = [], income = [], expenses = [], targetDate, anchorDate = today()) {
  const currentBalance = getCurrentBalance(accounts)
  const target = normalizeDate(targetDate)
  const anchor = normalizeDate(anchorDate)

  if (!target || !anchor || target === anchor) return currentBalance

  const actualLedger = getActualLedger(income, expenses)

  if (target < anchor) {
    const deltaAfterTarget = actualLedger
      .filter(entry => entry.date > target && entry.date <= anchor)
      .reduce((sum, entry) => sum + entry.signedAmount, 0)

    return currentBalance - deltaAfterTarget
  }

  // target > anchor
  const projectedLedger = []; // empty for mock
  const deltaUntilTarget = [...actualLedger, ...projectedLedger]
    .filter(entry => entry.date > anchor && entry.date <= target)
    .reduce((sum, entry) => sum + entry.signedAmount, 0)

  return currentBalance + deltaUntilTarget
}

function getBalanceAtDateWithOverrides(accounts = [], income = [], expenses = [], targetDate, balanceOverrides = {}) {
  const target = normalizeDate(targetDate)
  if (!target) return getCurrentBalance(accounts)

  const sortedOverrideDates = Object.keys(balanceOverrides)
    .filter(d => d <= target)
    .sort((a, b) => b.localeCompare(a))

  const closestOverrideDate = sortedOverrideDates[0]
  if (closestOverrideDate) {
    const overrideVal = Number(balanceOverrides[closestOverrideDate])
    if (Number.isFinite(overrideVal)) {
      const actualLedger = getActualLedger(income, expenses)
      const projectedLedger = [];
      
      const deltaUntilTarget = [...actualLedger, ...projectedLedger]
        .filter(entry => entry.date > closestOverrideDate && entry.date <= target)
        .reduce((sum, entry) => sum + entry.signedAmount, 0)
      
      return overrideVal + deltaUntilTarget
    }
  }

  return getBalanceAtDate(accounts, income, expenses, target)
}

function getMonthStartBalance(accounts = [], income = [], expenses = [], year, month, balanceOverrides = {}) {
  const targetAnchorDate = toDateKey(new Date(year, month, 0))
  return getBalanceAtDateWithOverrides(accounts, income, expenses, targetAnchorDate, balanceOverrides)
}

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

function buildForecast(allIncome, allExpenses, year, month, startingBalance = 0) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const ym = `${year}-${String(month + 1).padStart(2, '0')}`

  const dayMap = {}
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${ym}-${String(d).padStart(2, '0')}`
    dayMap[ds] = { income: 0, expense: 0, net: 0, runningBalance: 0, status: 'neutral' }
  }

  allIncome.forEach(t => {
    if (t.date && dayMap[t.date]) {
      dayMap[t.date].income += t.amount || 0
    }
  })

  allExpenses.forEach(t => {
    if (t.date && dayMap[t.date]) {
      dayMap[t.date].expense += t.amount || 0
    }
  })

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

function applyBalanceOverridesToForecast(forecastMap = {}, year, month, balanceOverrides = {}, startingBalance = 0) {
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

// RUN MOCK
const accounts = [{ balance: 20091, type: 'cash' }];
const income = [];
const expenses = [];
const balanceOverrides = {};

const starting = getMonthStartBalance(accounts, income, expenses, 2026, 6, balanceOverrides);
console.log('starting balance on June 30:', starting);

const forecast = buildForecast([], [], 2026, 6, starting);
const finalForecast = applyBalanceOverridesToForecast(forecast, 2026, 6, balanceOverrides, starting);

console.log('Final Forecast for first 10 days of July 2026:');
for (let d = 1; d <= 10; d++) {
  const ds = `2026-07-${String(d).padStart(2, '0')}`;
  console.log(`${ds}:`, finalForecast[ds]);
}
