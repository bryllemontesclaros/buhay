import { getBillPeriodKey, getProjectedBillExpenses, getVirtualBills } from './bills'
import { getProjectedTransactions, getRecurringDates } from './recurrence'
import { normalizeDate, today } from './utils'

export const PROJECTED_LEDGER_STATUS = Object.freeze({
  ACTUAL: 'actual',
  PROJECTED: 'projected',
  UNPAID: 'unpaid',
})

function safeList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function isPaid(tx = {}) {
  return String(tx.paymentStatus || 'paid').toLowerCase() !== 'unpaid'
}

function isDateInRange(date, startDate, endDate) {
  const normalized = normalizeDate(date)
  return Boolean(normalized && normalized >= startDate && normalized <= endDate)
}

function monthKeysBetween(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  const months = []

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return months

  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const last = new Date(end.getFullYear(), end.getMonth(), 1)
  while (cursor <= last) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return months
}

function dateKeysBetween(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  const dates = []

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return dates

  const cursor = new Date(start)
  while (cursor <= end) {
    dates.push(normalizeDate(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

function getAccountType(accountLookup, accountId) {
  return accountLookup.get(accountId)?.type || ''
}

function isLiquidAccount(accountLookup, accountId) {
  if (!accountId) return true
  return ['Cash', 'Bank', 'E-wallet'].includes(getAccountType(accountLookup, accountId))
}

function getEntryImpact(tx, type, accountLookup) {
  const amount = Math.abs(Number(tx.amount) || 0)
  if (!amount) return { cashImpact: 0, debtImpact: 0 }

  if (type === 'transfer') {
    const outgoing = isLiquidAccount(accountLookup, tx.fromAccountId) ? -amount : 0
    const incoming = isLiquidAccount(accountLookup, tx.toAccountId) ? amount : 0
    return { cashImpact: outgoing + incoming, debtImpact: 0 }
  }

  const accountType = getAccountType(accountLookup, tx.accountId)
  if (accountType === 'Credit Card') {
    if (type === 'income' || tx.isDebtPayment || tx.debtId || tx.source === 'bill-payment') {
      return { cashImpact: -amount, debtImpact: -amount }
    }
    return { cashImpact: 0, debtImpact: amount }
  }

  return {
    cashImpact: type === 'income' ? amount : -amount,
    debtImpact: 0,
  }
}

function getScheduleIdentity(tx, date) {
  const sourceId = tx._sourceId || tx.sourceScheduleId || tx.recurrenceSourceId || tx._id
  return sourceId ? `schedule:${sourceId}:${date}` : ''
}

function getBillIdentity(bill, date) {
  if (!bill?._id || !date) return ''
  return `bill:${bill._id}:${getBillPeriodKey(bill, date)}`
}

function normalizeSchedule(schedule = {}) {
  const originalType = schedule.type
  const type = originalType === 'bill' ? 'expense' : originalType
  const date = normalizeDate(schedule.startDate || schedule.date)
  const recur = schedule.recur || schedule.frequency || ''
  if (!date || !recur || !['income', 'expense', 'transfer'].includes(type)) return null

  return {
    ...schedule,
    _id: schedule._id || schedule.id || schedule.sourceScheduleId,
    desc: schedule.desc || schedule.name || '',
    date,
    recur,
    type,
    originalType,
    active: schedule.active !== false && schedule.paused !== true,
  }
}

function makeEntry(tx, type, status, source, accountLookup, extra = {}) {
  const date = normalizeDate(tx.date)
  const impact = status === PROJECTED_LEDGER_STATUS.UNPAID
    ? { cashImpact: 0, debtImpact: 0 }
    : getEntryImpact(tx, type, accountLookup)

  return {
    ...tx,
    _id: tx._id || `${source}:${type}:${date}:${tx.amount || 0}`,
    date,
    type,
    status,
    source,
    isActual: status === PROJECTED_LEDGER_STATUS.ACTUAL,
    isProjected: status === PROJECTED_LEDGER_STATUS.PROJECTED,
    isUnpaid: status === PROJECTED_LEDGER_STATUS.UNPAID,
    cashImpact: impact.cashImpact,
    debtImpact: impact.debtImpact,
    ...extra,
  }
}

function addIfInRange(entries, entry, startDate, endDate) {
  if (entry?.date && isDateInRange(entry.date, startDate, endDate)) entries.push(entry)
}

/**
 * Build a read-only actual and projected ledger for a date range.
 *
 * This function does not write to Firestore and does not mutate input records.
 * Existing records are adapted in memory so current users can be compared with
 * the future schedule model before any migration or screen switch happens.
 */
export function getProjectedLedger({
  data = {},
  startDate,
  endDate,
  anchorDate = today(),
  startingBalance,
} = {}) {
  const normalizedStart = normalizeDate(startDate || anchorDate)
  const normalizedEnd = normalizeDate(endDate || normalizedStart)
  const normalizedAnchor = normalizeDate(anchorDate) || today()
  if (!normalizedStart || !normalizedEnd || normalizedStart > normalizedEnd) {
    return { startDate: normalizedStart, endDate: normalizedEnd, anchorDate: normalizedAnchor, entries: [], daily: {}, summary: {} }
  }

  const accounts = safeList(data.accounts)
  const income = safeList(data.income)
  const expenses = safeList(data.expenses)
  const transfers = safeList(data.transfers)
  const persistedBills = safeList(data.bills)
  const accountLookup = new Map(accounts.map(account => [account._id, account]))
  const entries = []
  const actualIdentitySet = new Set()
  const projectedIdentitySet = new Set()

  const addActual = (tx, type) => {
    const date = normalizeDate(tx.date)
    if (!date || !isDateInRange(date, normalizedStart, normalizedEnd)) return
    const identity = tx.billId && tx.billPeriodKey
      ? `bill:${tx.billId}:${tx.billPeriodKey}`
      : getScheduleIdentity(tx, normalizeDate(tx.recurrenceOccurrenceKey || date))
    if (identity) actualIdentitySet.add(identity)
    entries.push(makeEntry({ ...tx, date }, type, isPaid(tx) ? PROJECTED_LEDGER_STATUS.ACTUAL : PROJECTED_LEDGER_STATUS.UNPAID, 'actual', accountLookup, {
      occurrenceIdentity: identity,
    }))
  }

  income.forEach(tx => addActual(tx, 'income'))
  expenses.forEach(tx => addActual(tx, 'expense'))
  transfers.forEach(tx => addActual(tx, 'transfer'))

  const months = monthKeysBetween(normalizedStart, normalizedEnd)
  const allBills = [...persistedBills, ...getVirtualBills({ ...data, bills: persistedBills })]
  const billById = new Map(allBills.map(bill => [bill._id, bill]))

  months.forEach(({ year, month }) => {
    const recurring = getProjectedTransactions(income, expenses, year, month)
    recurring.forEach(tx => {
      if (tx.type === 'expense' && String(tx.cat || '').toLowerCase() === 'bills') return
      const date = normalizeDate(tx.date)
      const identity = getScheduleIdentity(tx, date)
      if (!date || !identity || actualIdentitySet.has(identity) || projectedIdentitySet.has(identity)) return
      projectedIdentitySet.add(identity)
      addIfInRange(entries, makeEntry({ ...tx, date }, tx.type, PROJECTED_LEDGER_STATUS.PROJECTED, 'recurring', accountLookup, {
        occurrenceIdentity: identity,
      }), normalizedStart, normalizedEnd)
    })

    const projectedBills = getProjectedBillExpenses(allBills, year, month)
    projectedBills.forEach(tx => {
      const bill = billById.get(tx._sourceId)
      const date = normalizeDate(tx.date)
      const identity = getBillIdentity(bill, date) || `bill:${tx._sourceId}:${date}`
      if (!date || actualIdentitySet.has(identity) || projectedIdentitySet.has(identity)) return
      projectedIdentitySet.add(identity)
      addIfInRange(entries, makeEntry({ ...tx, date }, 'expense', PROJECTED_LEDGER_STATUS.PROJECTED, 'bill', accountLookup, {
        occurrenceIdentity: identity,
        _autoPaidBill: true,
      }), normalizedStart, normalizedEnd)
    })
  })

  safeList(data.schedules)
    .map(normalizeSchedule)
    .filter(schedule => schedule?.active)
    .forEach(schedule => {
      months.forEach(({ year, month }) => {
        getRecurringDates(schedule, year, month).forEach(date => {
          const identity = getScheduleIdentity(schedule, date)
          if (!identity || actualIdentitySet.has(identity) || projectedIdentitySet.has(identity)) return
          projectedIdentitySet.add(identity)
          addIfInRange(entries, makeEntry({ ...schedule, date }, schedule.type, PROJECTED_LEDGER_STATUS.PROJECTED, 'schedule', accountLookup, {
            occurrenceIdentity: identity,
            _autoPaidBill: schedule.originalType === 'bill',
          }), normalizedStart, normalizedEnd)
        })
      })
    })

  const dates = dateKeysBetween(normalizedStart, normalizedEnd)
  const defaultStartingBalance = accounts
    .filter(account => ['Cash', 'Bank', 'E-wallet'].includes(account.type))
    .reduce((sum, account) => sum + (Number(account.balance) || 0), 0)
  let runningBalance = Number.isFinite(Number(startingBalance)) ? Number(startingBalance) : defaultStartingBalance
  const daily = {}

  dates.forEach(date => {
    const dayEntries = entries.filter(entry => entry.date === date)
    const openingBalance = runningBalance
    const cashIncome = dayEntries.filter(entry => entry.type === 'income').reduce((sum, entry) => sum + Math.max(0, entry.cashImpact), 0)
    const cashExpenses = dayEntries.filter(entry => entry.type === 'expense').reduce((sum, entry) => sum + Math.max(0, -entry.cashImpact), 0)
    const transfersIn = dayEntries.filter(entry => entry.type === 'transfer').reduce((sum, entry) => sum + Math.max(0, entry.cashImpact), 0)
    const transfersOut = dayEntries.filter(entry => entry.type === 'transfer').reduce((sum, entry) => sum + Math.max(0, -entry.cashImpact), 0)
    const netCashflow = cashIncome - cashExpenses + transfersIn - transfersOut
    runningBalance += netCashflow
    daily[date] = {
      date,
      openingBalance,
      actualBalance: date === normalizedAnchor ? openingBalance : null,
      projectedBalance: runningBalance,
      closingBalance: runningBalance,
      income: cashIncome,
      expenses: cashExpenses,
      transfersIn,
      transfersOut,
      netCashflow,
      items: dayEntries,
    }
  })

  const projectedEntries = entries.filter(entry => entry.status === PROJECTED_LEDGER_STATUS.PROJECTED)
  const actualEntries = entries.filter(entry => entry.status === PROJECTED_LEDGER_STATUS.ACTUAL)
  const unpaidEntries = entries.filter(entry => entry.status === PROJECTED_LEDGER_STATUS.UNPAID)
  return {
    startDate: normalizedStart,
    endDate: normalizedEnd,
    anchorDate: normalizedAnchor,
    entries: entries.sort((a, b) => `${a.date}:${a._id}`.localeCompare(`${b.date}:${b._id}`)),
    daily,
    summary: {
      actualCount: actualEntries.length,
      projectedCount: projectedEntries.length,
      unpaidCount: unpaidEntries.length,
      openingBalance: daily[normalizedStart]?.openingBalance ?? runningBalance,
      closingBalance: daily[normalizedEnd]?.closingBalance ?? runningBalance,
      projectedNetCashflow: projectedEntries.reduce((sum, entry) => sum + (entry.cashImpact || 0), 0),
    },
  }
}

export function getProjectedLedgerForMonth(data = {}, year, month, options = {}) {
  const startDate = `${year}-${String(Number(month) + 1).padStart(2, '0')}-01`
  const lastDay = new Date(Number(year), Number(month) + 1, 0).getDate()
  const endDate = `${year}-${String(Number(month) + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return getProjectedLedger({ ...options, data, startDate, endDate })
}
