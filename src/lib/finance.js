import { applyBalanceOverridesToForecast, buildForecast, getEndOfMonthBalance } from './forecast'
import { getProjectedTransactions } from './recurrence'
import { getMonthKey, normalizeDate, toMonthKey, today } from './utils'

export function isTransactionPaid(tx = {}) {
  return String(tx?.paymentStatus || 'paid').toLowerCase() !== 'unpaid'
}

export function getPaidTransactions(list = []) {
  return list.filter(isTransactionPaid)
}

export const TAKDA_TRANSACTION_STATUS = Object.freeze({
  FORECAST: 'forecast',
  PAID: 'paid',
  UNPAID: 'unpaid',
})

export const TAKDA_BALANCE_IMPACT = Object.freeze({
  NONE: 'none',
  IN_ACCOUNT: 'in-account',
  DUE_TO_SYNC: 'due-to-sync',
  APPLIES_ON_DATE: 'applies-on-date',
  LINKED: 'linked',
  REFERENCE_ONLY: 'reference-only',
  LEDGER_ONLY: 'ledger-only',
})

export function getTransactionBalanceState(tx = {}, referenceDate = today()) {
  const paid = isTransactionPaid(tx)
  const linked = Boolean(tx?.accountBalanceLinked && tx?.accountId)
  const txDate = normalizeDate(tx?.date)
  const anchorDate = normalizeDate(referenceDate)
  const due = Boolean(paid && linked && txDate && anchorDate && txDate <= anchorDate)
  const willApplyLater = Boolean(paid && linked && txDate && anchorDate && txDate > anchorDate)
  const applied = Boolean(tx?.accountBalanceApplied)
  const pendingApply = Boolean(due && !applied)

  return {
    paid,
    linked,
    applied,
    pendingApply,
    willApplyLater,
    txDate,
  }
}

export function getTakdaTransactionLifecycle(tx = {}, referenceDate = today()) {
  const projected = Boolean(tx?._projected)
  const paid = isTransactionPaid(tx)
  const balanceState = projected ? null : getTransactionBalanceState(tx, referenceDate)

  let balanceImpactKey = TAKDA_BALANCE_IMPACT.NONE
  let balanceImpactLabel = ''

  if (!projected) {
    if (!balanceState?.paid) {
      balanceImpactKey = TAKDA_BALANCE_IMPACT.NONE
      balanceImpactLabel = 'No balance impact'
    } else if (balanceState.linked) {
      if (balanceState.applied) {
        balanceImpactKey = TAKDA_BALANCE_IMPACT.IN_ACCOUNT
        balanceImpactLabel = 'In account'
      } else if (balanceState.pendingApply) {
        balanceImpactKey = TAKDA_BALANCE_IMPACT.DUE_TO_SYNC
        balanceImpactLabel = 'Due to sync'
      } else if (balanceState.willApplyLater) {
        balanceImpactKey = TAKDA_BALANCE_IMPACT.APPLIES_ON_DATE
        balanceImpactLabel = 'Applies on date'
      } else {
        balanceImpactKey = TAKDA_BALANCE_IMPACT.LINKED
        balanceImpactLabel = 'Linked'
      }
    } else if (tx?.accountId) {
      balanceImpactKey = TAKDA_BALANCE_IMPACT.REFERENCE_ONLY
      balanceImpactLabel = 'Ref only'
    } else {
      balanceImpactKey = TAKDA_BALANCE_IMPACT.LEDGER_ONLY
      balanceImpactLabel = 'Ledger only'
    }
  }

  return {
    projected,
    paid,
    statusKey: projected
      ? TAKDA_TRANSACTION_STATUS.FORECAST
      : (paid ? TAKDA_TRANSACTION_STATUS.PAID : TAKDA_TRANSACTION_STATUS.UNPAID),
    statusLabel: projected ? 'Forecast' : (paid ? 'Paid' : 'Unpaid'),
    balanceState,
    balanceImpactKey,
    balanceImpactLabel,
  }
}

function toLedgerEntry(tx, sign, anchorDateStr) {
  const date = normalizeDate(tx?.date)
  if (!date || !isTransactionPaid(tx)) return null

  // Fix: For transactions on or before the anchor date (the past/today), 
  // only include them in balance calculations if they were actually applied to an account.
  // Otherwise, they never affected the current account balance, so "undoing" them inflates past balances.
  if (anchorDateStr && date <= anchorDateStr && !tx.accountBalanceApplied) {
    return null
  }

  return {
    ...tx,
    date,
    signedAmount: sign * Math.abs(Number(tx?.amount) || 0),
  }
}

export function getAccountSignedBalance(account = {}) {
  // Takda stores credit card balances as negative values in the accounts collection.
  // So the signed balance is just the raw balance itself.
  return Number(account?.balance) || 0
}

export function getLiquidBalance(accounts = []) {
  const safeAccounts = Array.isArray(accounts) ? accounts.filter(Boolean) : []
  return safeAccounts
    .filter(account => account && ['Cash', 'Bank', 'E-wallet'].includes(account.type))
    .reduce((sum, account) => sum + (Number(account?.balance) || 0), 0)
}

export function getProjectedCcCharges(accounts = [], income = [], expenses = [], targetDate = null) {
  if (!targetDate) return 0
  const anchorKey = today()
  const targetKey = normalizeDate(targetDate)
  if (!anchorKey || !targetKey || targetKey <= anchorKey) return 0

  const safeAccounts = Array.isArray(accounts) ? accounts.filter(Boolean) : []
  const creditCardAccountIds = new Set(
    safeAccounts.filter(a => a && a.type === 'Credit Card').map(a => a._id).filter(Boolean)
  )

  if (creditCardAccountIds.size === 0) return 0

  const safeIncome = Array.isArray(income) ? income.filter(Boolean) : []
  const safeExpenses = Array.isArray(expenses) ? expenses.filter(Boolean) : []

  const projectedLedger = getProjectedLedgerBetweenDates(safeAccounts, [], safeIncome, safeExpenses, anchorKey, targetKey)
  const seenKeys = new Set()
  let netCcCharges = 0

  projectedLedger.forEach(entry => {
    if (entry && entry.accountId && creditCardAccountIds.has(entry.accountId)) {
      const key = entry._id || `${entry.type}:${entry.date}:${entry.amount}`
      if (!seenKeys.has(key)) {
        seenKeys.add(key)
        const amt = Number(entry.amount) || 0
        if (entry.type === 'expense' || entry.signedAmount < 0) {
          netCcCharges += Math.abs(amt)
        } else if (entry.type === 'income' || entry.signedAmount > 0) {
          netCcCharges -= Math.abs(amt)
        }
      }
    }
  })

  return Math.max(0, netCcCharges)
}

export function getTakdaTotalDebts(accounts = [], debts = [], targetDate = null, income = [], expenses = []) {
  const safeAccounts = Array.isArray(accounts) ? accounts.filter(Boolean) : []
  const safeDebts = Array.isArray(debts) ? debts.filter(Boolean) : []
  const targetKey = targetDate ? normalizeDate(targetDate) : null

  // 1) All standalone debts (personal loans, mortgages, car loans, etc.)
  const standaloneDebtSum = safeDebts
    .filter(d => {
      if (!d || d.type === 'Credit Card') return false
      if (targetKey && d.startDate) {
        const startKey = normalizeDate(d.startDate)
        if (startKey && startKey > targetKey) return false
      }
      return true
    })
    .reduce((sum, d) => sum + Math.abs(Number(d?.balance) || 0), 0)

  // 2) Credit card accounts
  const creditCardAccountSum = safeAccounts
    .filter(acc => acc && acc.type === 'Credit Card')
    .reduce((sum, acc) => sum + Math.abs(Number(acc?.balance) || 0), 0)

  // 3) Unlinked credit card entries
  const accountIds = new Set(safeAccounts.map(a => a?._id).filter(Boolean))
  const unlinkedCcDebts = safeDebts
    .filter(d => {
      if (!d || d.type !== 'Credit Card') return false
      if (d.accountId && accountIds.has(d.accountId)) return false
      if (targetKey && d.startDate) {
        const startKey = normalizeDate(d.startDate)
        if (startKey && startKey > targetKey) return false
      }
      return true
    })
    .reduce((sum, d) => sum + Math.abs(Number(d?.balance) || 0), 0)

  // 4) Projected Credit Card Charges for future dates
  const futureCcCharges = getProjectedCcCharges(accounts, income, expenses, targetDate)

  return standaloneDebtSum + creditCardAccountSum + unlinkedCcDebts + futureCcCharges
}

export function getTakdaTotalSavings(savings = []) {
  const safeSavings = Array.isArray(savings) ? savings.filter(Boolean) : []
  return safeSavings.reduce((sum, s) => sum + (Number(s?.balance) || 0), 0)
}

export function getTakdaTotalAssets(accounts = [], holdings = [], livePrices = null) {
  const safeAccounts = Array.isArray(accounts) ? accounts.filter(Boolean) : []
  const accountsSum = safeAccounts
    .filter(acc => acc?.type !== 'Credit Card')
    .reduce((sum, acc) => sum + Math.max(0, Number(acc?.balance) || 0), 0)

  const safeHoldings = Array.isArray(holdings) ? holdings.filter(Boolean) : []
  let prices = livePrices
  if (!prices && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('buhay_crypto_prices_v6')
      if (raw) prices = JSON.parse(raw)?.data
    } catch {
      // ignore
    }
  }
  prices = prices || {}

  const holdingsSum = safeHoldings.reduce((sum, h) => {
    const qty = parseFloat(h?.quantity ?? h?.shares ?? 0) || 0
    const quote = prices[h?.coinId] || prices[h?.symbol?.toUpperCase()] || prices[h?.symbol?.toLowerCase()] || {}
    const livePrice = parseFloat(quote?.php) || parseFloat(h?.currentPrice ?? h?.livePrice ?? h?.buyPrice ?? h?.price ?? 0) || 0
    return sum + (qty * livePrice)
  }, 0)

  return accountsSum + holdingsSum
}

export function getTakdaNetWorth(accounts = [], debts = [], savings = [], holdings = [], targetDate = null) {
  return getTakdaTotalAssets(accounts, holdings) + getTakdaTotalSavings(savings) - getTakdaTotalDebts(accounts, debts, targetDate)
}

export function getCurrentBalance(accounts = [], debts = []) {
  const safeAccounts = Array.isArray(accounts) ? accounts.filter(Boolean) : []
  const safeDebts = Array.isArray(debts) ? debts.filter(Boolean) : []
  const accountIds = new Set(safeAccounts.map(a => a?._id).filter(Boolean))
  const unlinkedDebts = safeDebts.filter(d => !d?.accountId || !accountIds.has(d.accountId))
  const totalDebt = unlinkedDebts.reduce((sum, d) => sum + Math.abs(Number(d?.balance) || 0), 0)
  
  const accountsBalance = safeAccounts.reduce((sum, account) => sum + (Number(account?.balance) || 0), 0)
  return accountsBalance - totalDebt
}

export function getAccountBalanceDelta(account = {}, txType, amount = 0) {
  const normalizedAmount = Math.abs(Number(amount) || 0)
  if (!normalizedAmount) return 0

  if (txType === 'income') {
    return normalizedAmount
  }
  return -normalizedAmount
}

export function isLinkedTransaction(tx = {}) {
  return Boolean(tx?.accountBalanceLinked && tx?.accountId)
}

export function shouldAffectCurrentAccountBalance(tx = {}, referenceDate = today()) {
  if (!isTransactionPaid(tx)) return false
  if (!isLinkedTransaction(tx)) return false
  const txDate = normalizeDate(tx?.date)
  const anchorDate = normalizeDate(referenceDate)
  if (!txDate || !anchorDate) return false
  return txDate <= anchorDate
}

export function getActualLedger(accounts = [], transfers = [], income = [], expenses = [], anchorDateStr = null) {
  const safeAccounts = Array.isArray(accounts) ? accounts.filter(Boolean) : []
  const safeTransfers = Array.isArray(transfers) ? transfers.filter(Boolean) : []
  const safeIncome = Array.isArray(income) ? income.filter(Boolean) : []
  const safeExpenses = Array.isArray(expenses) ? expenses.filter(Boolean) : []

  const accountLookup = new Map(safeAccounts.map(a => [a?._id, a]))
  
  function isLiquid(accountId) {
    if (!accountId) return true // Unlinked = cashflow
    const account = accountLookup.get(accountId)
    if (!account) return true
    return ['Cash', 'Bank', 'E-wallet'].includes(account.type)
  }

  const incomeEntries = safeIncome
    .filter(tx => tx && isLiquid(tx.accountId))
    .map(tx => toLedgerEntry(tx, 1, anchorDateStr))
    
  const expenseEntries = safeExpenses
    .filter(tx => tx && isLiquid(tx.accountId))
    .map(tx => toLedgerEntry(tx, -1, anchorDateStr))
    
  const transferEntries = safeTransfers.map(tx => {
    if (!tx) return null
    const fromLiquid = isLiquid(tx.fromAccountId)
    const toLiquid = isLiquid(tx.toAccountId)
    
    if (fromLiquid && toLiquid) return null
    if (!fromLiquid && !toLiquid) return null
    
    let sign = 0
    if (fromLiquid && !toLiquid) sign = -1
    if (!fromLiquid && toLiquid) sign = 1
    
    return toLedgerEntry({ ...tx, accountBalanceApplied: true }, sign, anchorDateStr)
  })

  return [
    ...incomeEntries,
    ...expenseEntries,
    ...transferEntries
  ]
    .filter(Boolean)
    .sort((a, b) => {
      if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '')
      return (a.createdAt || 0) - (b.createdAt || 0)
    })
}

export function getMonthTransactions(list = [], year, month) {
  return list.filter(tx => getMonthKey(tx?.date) === toMonthKey(year, month))
}

export function getMonthTotal(list = [], year, month) {
  return getPaidTransactions(getMonthTransactions(list, year, month)).reduce((sum, tx) => sum + (Number(tx?.amount) || 0), 0)
}

function normalizeMonthStartBalances(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}

  return Object.entries(raw).reduce((acc, [monthKey, value]) => {
    if (!/^\d{4}-\d{2}$/.test(monthKey)) return acc
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) return acc
    acc[monthKey] = numericValue
    return acc
  }, {})
}

function normalizeDailyBalanceOverrides(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}

  return Object.entries(raw).reduce((acc, [dateKey, value]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return acc
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) return acc
    acc[dateKey] = numericValue
    return acc
  }, {})
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getMonthCursor(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function toProjectedLedgerEntry(tx, sign) {
  const date = normalizeDate(tx?.date)
  if (!date) return null
  return {
    ...tx,
    date,
    signedAmount: sign * Math.abs(Number(tx?.amount) || 0),
  }
}

function getProjectedLedgerBetweenDates(accounts = [], transfers = [], income = [], expenses = [], anchorDate, targetDate) {
  const anchor = normalizeDate(anchorDate)
  const target = normalizeDate(targetDate)

  if (!anchor || !target || target <= anchor) return []

  const safeAccounts = Array.isArray(accounts) ? accounts.filter(Boolean) : []
  const accountLookup = new Map(safeAccounts.map(a => [a?._id, a]))
  function isLiquid(accountId) {
    if (!accountId) return true
    const account = accountLookup.get(accountId)
    if (!account) return true
    return ['Cash', 'Bank', 'E-wallet'].includes(account.type)
  }

  const cursor = getMonthCursor(new Date(`${anchor}T00:00:00`))
  const end = getMonthCursor(new Date(`${target}T00:00:00`))
  const entries = []
  const seen = new Set()

  const safeIncome = Array.isArray(income) ? income.filter(Boolean) : []
  const safeExpenses = Array.isArray(expenses) ? expenses.filter(Boolean) : []
  const safeTransfers = Array.isArray(transfers) ? transfers.filter(Boolean) : []

  // 1) Include all single/scheduled future transactions in income and expenses between anchor and target
  safeIncome.forEach(tx => {
    const d = normalizeDate(tx?.date)
    if (d && d > anchor && d <= target && isLiquid(tx.accountId)) {
      const key = tx._id || `inc:${d}:${tx.amount}:${tx.title || tx.desc || ''}`
      if (!seen.has(key)) {
        seen.add(key)
        const entry = toProjectedLedgerEntry(tx, 1)
        if (entry) entries.push(entry)
      }
    }
  })

  safeExpenses.forEach(tx => {
    const d = normalizeDate(tx?.date)
    if (d && d > anchor && d <= target && isLiquid(tx.accountId)) {
      const key = tx._id || `exp:${d}:${tx.amount}:${tx.title || tx.desc || ''}`
      if (!seen.has(key)) {
        seen.add(key)
        const entry = toProjectedLedgerEntry(tx, -1)
        if (entry) entries.push(entry)
      }
    }
  })

  safeTransfers.forEach(tx => {
    const d = normalizeDate(tx?.date)
    if (!d || d <= anchor || d > target) return
    const fromLiquid = isLiquid(tx.fromAccountId)
    const toLiquid = isLiquid(tx.toAccountId)
    if (fromLiquid === toLiquid) return
    const sign = fromLiquid ? -1 : 1
    const key = tx._id || `trsf:${d}:${tx.amount}:${tx.fromAccountId}->${tx.toAccountId}`
    if (!seen.has(key)) {
      seen.add(key)
      const entry = toProjectedLedgerEntry(tx, sign)
      if (entry) entries.push(entry)
    }
  })

  // 2) Include projected recurring transactions
  while (cursor <= end) {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const projected = getProjectedTransactions(income, expenses, year, month)

    projected.forEach(tx => {
      const date = normalizeDate(tx?.date)
      if (!date || date <= anchor || date > target) return
      if (!isLiquid(tx.accountId)) return

      const key = tx._id || `${tx.type}:${tx._sourceId || tx.desc}:${date}`
      if (seen.has(key)) return
      seen.add(key)

      const entry = toProjectedLedgerEntry(tx, tx.type === 'income' ? 1 : -1)
      if (entry) entries.push(entry)
    })

    cursor.setMonth(cursor.getMonth() + 1)
  }

  return entries
    .filter(Boolean)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return (a.createdAt || 0) - (b.createdAt || 0)
    })
}


function getMonthStartAnchorDate(monthKey) {
  const [yearText, monthText] = String(monthKey).split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  if (!Number.isInteger(year) || !Number.isInteger(month)) return ''
  return toDateKey(new Date(year, month - 1, 0))
}

export function getBalanceOverrides(dailyBalanceOverrides = {}, monthStartBalances = {}) {
  const normalizedDailyOverrides = normalizeDailyBalanceOverrides(dailyBalanceOverrides)
  const legacyOverrides = Object.entries(normalizeMonthStartBalances(monthStartBalances)).reduce((acc, [monthKey, value]) => {
    const anchorDate = getMonthStartAnchorDate(monthKey)
    if (!anchorDate) return acc
    acc[anchorDate] = value
    return acc
  }, {})

  return {
    ...legacyOverrides,
    ...normalizedDailyOverrides,
  }
}

export function getBalanceAtDate(accounts = [], transfers = [], income = [], expenses = [], targetDate, anchorDate = today(), anchorBalance = null) {
  const currentBalance = (anchorBalance !== null && anchorBalance !== undefined && !Number.isNaN(Number(anchorBalance))) 
    ? Number(anchorBalance) 
    : getLiquidBalance(accounts)
  const target = normalizeDate(targetDate)
  const anchor = normalizeDate(anchorDate)

  if (!target || !anchor || target === anchor) return currentBalance || 0

  const actualLedger = getActualLedger(accounts, transfers, income, expenses, anchor)

  if (target < anchor) {
    const deltaAfterTarget = actualLedger
      .filter(entry => entry.date > target && entry.date <= anchor)
      .reduce((sum, entry) => sum + entry.signedAmount, 0)

    return (currentBalance || 0) - deltaAfterTarget
  }

  const projectedLedger = getProjectedLedgerBetweenDates(accounts, transfers, income, expenses, anchor, target)
  const deltaUntilTarget = projectedLedger
    .filter(entry => entry.date > anchor && entry.date <= target)
    .reduce((sum, entry) => sum + entry.signedAmount, 0)

  return (currentBalance || 0) + deltaUntilTarget
}

export function hasDailyBalanceOverride(targetDate, balanceOverrides = {}) {
  const safeOverrides = balanceOverrides || {}
  const target = normalizeDate(targetDate)
  if (!target) return false
  return safeOverrides[target] !== undefined && safeOverrides[target] !== null && Number.isFinite(Number(safeOverrides[target]))
}

export function getBalanceAtDateWithOverrides(accounts = [], transfers = [], income = [], expenses = [], targetDate, balanceOverrides = {}) {
  const safeOverrides = balanceOverrides || {}
  const target = normalizeDate(targetDate)
  if (!target) return getLiquidBalance(accounts)

  if (safeOverrides[target] !== undefined && safeOverrides[target] !== null && Number.isFinite(Number(safeOverrides[target]))) {
    return Number(safeOverrides[target])
  }

  const todayKey = today()
  const overrideEntries = Object.entries(safeOverrides)
    .filter(([date, val]) => val !== null && val !== undefined && Number.isFinite(Number(val)))
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))

  const nearestPastOverride = overrideEntries.find(([date]) => date < target)

  if (nearestPastOverride) {
    const [anchorDate, anchorBalance] = nearestPastOverride
    if (target <= todayKey || anchorDate >= todayKey) {
      return getBalanceAtDate(accounts, transfers, income, expenses, target, anchorDate, anchorBalance)
    }
  }

  return getBalanceAtDate(accounts, transfers, income, expenses, target)
}

export function getMonthStartBalance(accounts = [], transfers = [], income = [], expenses = [], year, month, balanceOverrides = {}) {
  const mKey = toMonthKey(year, month)
  if (balanceOverrides[mKey] !== undefined) {
    return balanceOverrides[mKey]
  }

  const prevMonthDate = new Date(year, month, 0)
  const targetAnchorDate = toDateKey(prevMonthDate)
  return getBalanceAtDateWithOverrides(accounts, transfers, income, expenses, targetAnchorDate, balanceOverrides)
}

export function getMonthForecast(
  accounts = [],
  transfers = [],
  income = [],
  expenses = [],
  projectedIncome = [],
  projectedExpenses = [],
  year,
  month,
  balanceOverrides = {},
) {
  const safeAccounts = Array.isArray(accounts) ? accounts.filter(Boolean) : []
  const startingBalance = getMonthStartBalance(safeAccounts, transfers, income, expenses, year, month, balanceOverrides)

  const accountLookup = new Map(safeAccounts.map(a => [a?._id, a]))
  function isLiquid(accountId) {
    if (!accountId) return true // Unlinked = cashflow
    const account = accountLookup.get(accountId)
    if (!account) return true
    return ['Cash', 'Bank', 'E-wallet'].includes(account.type)
  }

  const todayKey = today()

  const monthIncome = getMonthTransactions(income, year, month)
  const monthExpenses = getMonthTransactions(expenses, year, month)
  const monthTransfers = getMonthTransactions(transfers, year, month)

  // Past dates (< todayKey): Paid entries only for historical accuracy
  // Today & Future dates (>= todayKey): Include all scheduled/unpaid bills & transactions for real runway forecast
  const activeIncome = monthIncome.filter(tx => {
    const d = normalizeDate(tx.date)
    return d >= todayKey || isTransactionPaid(tx)
  })

  const activeExpenses = monthExpenses.filter(tx => {
    const d = normalizeDate(tx.date)
    return d >= todayKey || isTransactionPaid(tx)
  })

  const activeTransfers = monthTransfers.filter(tx => {
    const d = normalizeDate(tx.date)
    return d >= todayKey || isTransactionPaid(tx)
  })

  const allIncomeRaw = [
    ...activeIncome,
    ...getMonthTransactions(projectedIncome, year, month),
  ]
  const allExpensesRaw = [
    ...activeExpenses,
    ...getMonthTransactions(projectedExpenses, year, month),
  ]
  const allTransfersRaw = activeTransfers

  // Map effective Liquid Income (True Cash Additions)
  const effectiveLiquidIncome = [
    ...allIncomeRaw.filter(tx => isLiquid(tx.accountId)),
    ...allTransfersRaw
      .filter(tx => !isLiquid(tx.fromAccountId) && isLiquid(tx.toAccountId))
      .map(tx => ({ ...tx, amount: tx.amount, date: tx.date })),
  ]

  // Map effective Liquid Expenses (True Cash Deductions)
  const effectiveLiquidExpenses = [
    ...allExpensesRaw.filter(tx => isLiquid(tx.accountId)),
    ...allTransfersRaw
      .filter(tx => isLiquid(tx.fromAccountId) && !isLiquid(tx.toAccountId))
      .map(tx => ({ ...tx, amount: tx.amount, date: tx.date })),
  ]

  const baseForecast = buildForecast(effectiveLiquidIncome, effectiveLiquidExpenses, year, month, startingBalance)
  return applyBalanceOverridesToForecast(baseForecast, year, month, balanceOverrides, startingBalance)
}

export function getMonthEndBalanceForView(
  accounts = [],
  transfers = [],
  income = [],
  expenses = [],
  projectedIncome = [],
  projectedExpenses = [],
  year,
  month,
  balanceOverrides = {},
) {
  return getEndOfMonthBalance(
    getMonthForecast(
      accounts,
      transfers,
      income,
      expenses,
      projectedIncome,
      projectedExpenses,
      year,
      month,
      balanceOverrides,
    ),
  )
}
