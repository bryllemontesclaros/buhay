import { formatDisplayDate, getMonthKey, normalizeDate, today } from './utils'

function toLocalDate(value = new Date()) {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate())
  const normalized = normalizeDate(value)
  return normalized ? new Date(`${normalized}T00:00:00`) : new Date()
}

function clampDueDay(year, monthIndex, dueDay) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  return Math.min(Math.max(Number(dueDay) || 1, 1), lastDay)
}

export function getBillDueDate(bill = {}, referenceDate = new Date()) {
  const base = toLocalDate(referenceDate)
  const dueDay = clampDueDay(base.getFullYear(), base.getMonth(), bill.due)
  return normalizeDate(`${base.getFullYear()}-${base.getMonth() + 1}-${dueDay}`)
}

export function getBillPeriodKey(bill = {}, referenceDate = new Date()) {
  return `${bill.freq || 'monthly'}_${getBillDueDate(bill, referenceDate)}`
}

export function getBillPaidPeriods(bill = {}) {
  return bill?.paidPeriods && typeof bill.paidPeriods === 'object' ? bill.paidPeriods : {}
}

export function getBillPeriodPayment(bill = {}, referenceDate = new Date()) {
  const key = getBillPeriodKey(bill, referenceDate)
  const periods = getBillPaidPeriods(bill)
  if (periods[key]) return { key, payment: periods[key] }

  const hasPeriodRecords = Object.keys(periods).length > 0
  if (hasPeriodRecords || !bill?.paid || !bill?.paidAt) return { key, payment: null }

  const dueDate = getBillDueDate(bill, referenceDate)
  const paidMonth = getMonthKey(new Date(Number(bill.paidAt)))
  if (paidMonth !== getMonthKey(dueDate)) return { key, payment: null }

  return {
    key,
    payment: {
      paidAt: bill.paidAt,
      amount: Number(bill.amount) || 0,
      date: normalizeDate(new Date(Number(bill.paidAt))) || today(),
      accountId: bill.accountId || '',
      legacy: true,
    },
  }
}

export function isBillPaidForPeriod(bill = {}, referenceDate = new Date()) {
  return Boolean(getBillPeriodPayment(bill, referenceDate).payment)
}

export function getBillPeriodInfo(bill = {}, referenceDate = new Date()) {
  const dueDate = getBillDueDate(bill, referenceDate)
  const key = getBillPeriodKey(bill, referenceDate)
  const paid = isBillPaidForPeriod(bill, referenceDate)
  const now = toLocalDate(referenceDate)
  const due = toLocalDate(dueDate)
  const daysUntil = Math.round((due.getTime() - now.getTime()) / 86400000)

  let status = 'upcoming'
  let label = `Due ${formatDisplayDate(dueDate)}`
  if (paid) {
    status = 'paid'
    label = 'Paid this period'
  } else if (daysUntil < 0) {
    status = 'overdue'
    label = `${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'} overdue`
  } else if (daysUntil === 0) {
    status = 'due'
    label = 'Due today'
  } else if (daysUntil <= 3) {
    status = 'soon'
    label = `Due in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`
  }

  return { key, dueDate, daysUntil, paid, status, label }
}

export function getBillPaidPeriodEntries(bill = {}) {
  const periods = getBillPaidPeriods(bill)
  return Object.entries(periods)
    .filter(([, payment]) => payment && typeof payment === 'object')
    .map(([periodKey, payment]) => ({
      ...bill,
      periodKey,
      paidAt: Number(payment.paidAt || bill.paidAt || 0),
      amount: Number(payment.amount || bill.amount || 0),
      date: normalizeDate(payment.date) || (payment.paidAt ? normalizeDate(new Date(Number(payment.paidAt))) : ''),
      accountId: payment.accountId || bill.accountId || '',
      expenseId: payment.expenseId || '',
      dueDate: payment.dueDate || '',
    }))
}
