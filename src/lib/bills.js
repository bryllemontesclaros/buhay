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
  const freq = bill.freq || 'monthly'
  const due = Number(bill.due) || 1

  if (freq === 'weekly' || freq === 'bi-weekly') {
    const currentDow = base.getDay()
    const diff = due - currentDow
    const targetDate = new Date(base.getTime() + diff * 86400000)
    return normalizeDate(targetDate)
  }

  if (freq === 'yearly') {
    const targetMonth = Number(bill.dueMonth) || 0
    const d = clampDueDay(base.getFullYear(), targetMonth, due)
    return normalizeDate(`${base.getFullYear()}-${targetMonth + 1}-${d}`)
  }

  const d = clampDueDay(base.getFullYear(), base.getMonth(), due)
  return normalizeDate(`${base.getFullYear()}-${base.getMonth() + 1}-${d}`)
}

export function getBillOccurrencesForMonth(bill = {}, year, month) {
  const freq = bill.freq || 'monthly'
  const due = Number(bill.due) || 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const dates = []

  if (freq === 'weekly') {
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month, d)
      if (dt.getDay() === due) {
        dates.push(normalizeDate(dt))
      }
    }
  } else if (freq === 'bi-weekly') {
    let matchCount = 0
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month, d)
      if (dt.getDay() === due) {
        matchCount++
        if (matchCount % 2 === 1) {
          dates.push(normalizeDate(dt))
        }
      }
    }
  } else if (freq === 'yearly') {
    const targetMonth = Number(bill.dueMonth) || 0
    if (month === targetMonth) {
      const d = clampDueDay(year, month, due)
      dates.push(normalizeDate(new Date(year, month, d)))
    }
  } else {
    const d = clampDueDay(year, month, due)
    dates.push(normalizeDate(new Date(year, month, d)))
  }

  return dates
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

export function getVirtualBills(data = {}) {
  const debts = Array.isArray(data.debts) ? data.debts : []
  const accounts = Array.isArray(data.accounts) ? data.accounts : []
  const bills = Array.isArray(data.bills) ? data.bills : []
  const expenses = Array.isArray(data.expenses) ? data.expenses : []
  
  // Find accounts and names already explicitly linked to a bill
  const explicitBillAccountIds = new Set(bills.map(b => b.accountId).filter(Boolean))
  const explicitBillNames = new Set(bills.map(b => (b.name || '').trim().toLowerCase()).filter(Boolean))
  
  const virtualBills = []

  // 1. Convert Debts into Virtual Bills
  debts.forEach(debt => {
    if (!debt) return
    if (debt.accountId && explicitBillAccountIds.has(debt.accountId)) return
    if (explicitBillNames.has((debt.name || '').trim().toLowerCase())) return
    
    let balance = Number(debt.balance) || 0
    if (debt.accountId) {
      const acc = accounts.find(a => a._id === debt.accountId)
      if (acc) {
        balance = Math.abs(Number(acc.balance) || 0)
      }
    }
    
    if (balance <= 0) return

    let dueDay = 15
    if (debt.dueDate) {
      const parsed = parseInt(String(debt.dueDate).slice(-2), 10)
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 31) {
        dueDay = parsed
      }
    } else if (debt.statementDate) {
      const parsed = parseInt(String(debt.statementDate).slice(-2), 10)
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 31) {
        dueDay = parsed
      }
    }

    const paymentAmount = Number(debt.minPayment) > 0 ? Number(debt.minPayment) : balance

    virtualBills.push({
      _id: `virtual-debt-${debt._id}`,
      name: `${debt.name} (${debt.type || 'Debt'})`,
      amount: paymentAmount,
      due: dueDay,
      freq: 'monthly',
      cat: 'Bills',
      subcat: debt.type === 'Credit Card' ? 'Credit Card' : 'Debt',
      accountId: debt.accountId || '',
      isVirtual: true,
      originalDebtId: debt._id,
      paidPeriods: {},
    })
  })

  // 2. Convert Credit Card Accounts into Virtual Bills
  accounts.forEach(acc => {
    if (!acc || acc.type !== 'Credit Card') return
    if (explicitBillAccountIds.has(acc._id)) return
    const accNameLower = (acc.name || '').trim().toLowerCase()
    if (explicitBillNames.has(accNameLower)) return
    if (debts.some(d => d && d.accountId === acc._id)) return

    const balance = Math.abs(Number(acc.balance) || 0)
    if (balance <= 0) return

    let dueDay = 15
    if (acc.dueDate) {
      const parsed = parseInt(String(acc.dueDate).slice(-2), 10)
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 31) dueDay = parsed
    } else if (acc.statementDate) {
      const parsed = parseInt(String(acc.statementDate).slice(-2), 10)
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 31) dueDay = parsed
    }

    virtualBills.push({
      _id: `virtual-acc-${acc._id}`,
      name: `${acc.name} (Credit Card)`,
      amount: balance,
      due: dueDay,
      freq: 'monthly',
      cat: 'Bills',
      subcat: 'Credit Card',
      accountId: acc._id,
      isVirtual: true,
      paidPeriods: {},
    })
  })

  // 3. Convert Recurring Expenses into Virtual Bills
  const chains = {}
  expenses.forEach(tx => {
    if (!tx || !tx.recur) return
    const chainId = tx.recurrenceSourceId || tx._id
    if (!chains[chainId]) chains[chainId] = []
    chains[chainId].push(tx)
  })

  Object.values(chains).forEach(chain => {
    chain.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    const latest = chain[0]
    if (!latest || !latest.recur) return
    if (latest.cat !== 'Bills') return

    const txNameLower = (latest.desc || latest.subcat || 'Recurring Bill').trim().toLowerCase()
    if (explicitBillNames.has(txNameLower)) return

    let dueDay = 15
    if (latest.date) {
      const day = parseInt(String(latest.date).slice(-2), 10)
      if (Number.isFinite(day) && day >= 1 && day <= 31) dueDay = day
    }

    virtualBills.push({
      _id: `virtual-tx-${latest._id}`,
      name: latest.desc || latest.subcat || 'Recurring Bill',
      amount: Number(latest.amount) || 0,
      due: dueDay,
      freq: latest.recur || 'monthly',
      cat: 'Bills',
      subcat: latest.subcat || 'Utilities',
      accountId: latest.accountId || '',
      isVirtual: true,
      paidPeriods: {},
    })
  })

  return virtualBills
}
