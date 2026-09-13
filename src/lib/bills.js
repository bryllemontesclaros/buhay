import { formatDisplayDate, getMonthKey, normalizeDate, today } from './utils'
import { getCreditCardCycleDetails, parseDayOfMonth } from './billingCycles'

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
  if (bill.dueDateOverride) {
    return normalizeDate(bill.dueDateOverride)
  }
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
    return normalizeDate(`${base.getFullYear()}-${String(targetMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }

  const d = clampDueDay(base.getFullYear(), base.getMonth(), due)
  return normalizeDate(`${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
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
  if (!bill || typeof bill !== 'object') return {}
  const map = bill.paidPeriods && typeof bill.paidPeriods === 'object' ? { ...bill.paidPeriods } : {}
  // Also collect any flattened dot keys like 'paidPeriods.monthly_2026-08-11'
  Object.keys(bill).forEach(k => {
    if (k.startsWith('paidPeriods.')) {
      const subKey = k.replace('paidPeriods.', '')
      map[subKey] = bill[k]
    }
  })
  if (bill.lastPaidPeriod) {
    map[bill.lastPaidPeriod] = map[bill.lastPaidPeriod] || { paidAt: bill.paidAt || Date.now(), paid: true }
  }
  return map
}

export function getBillPeriodPayment(bill = {}, referenceDate = new Date()) {
  const key = getBillPeriodKey(bill, referenceDate)
  const periods = getBillPaidPeriods(bill)
  if (periods[key]) return { key, payment: periods[key] }

  if (bill?.paid && bill?.lastPaidPeriod === key) {
    return { key, payment: { paidAt: bill.paidAt || Date.now(), paid: true } }
  }

  const dueDate = getBillDueDate(bill, referenceDate)
  const dueMonthKey = getMonthKey(dueDate)

  if (dueMonthKey && periods[dueMonthKey]) {
    return { key, payment: periods[dueMonthKey] }
  }

  const refMonthKey = getMonthKey(referenceDate)
  if (refMonthKey && periods[refMonthKey]) {
    return { key, payment: periods[refMonthKey] }
  }

  const matchedEntry = Object.entries(periods).find(([pKey, pVal]) => {
    if (!pVal) return false
    if (pKey === dueMonthKey || pKey === `monthly_${dueDate}`) return true
    if (pVal.date && getMonthKey(pVal.date) === dueMonthKey) return true
    if (pVal.dueDate && (pVal.dueDate === dueDate || getMonthKey(pVal.dueDate) === dueMonthKey)) return true
    if (pVal.paidAt && getMonthKey(new Date(Number(pVal.paidAt))) === dueMonthKey) return true
    return false
  })
  if (matchedEntry) {
    return { key, payment: matchedEntry[1] }
  }

  const paidMonth = bill.paidAt ? getMonthKey(new Date(Number(bill.paidAt))) : ''
  if (bill?.paid && paidMonth && (paidMonth === dueMonthKey || paidMonth === refMonthKey)) {
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

  return { key, payment: null }
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
  const transfers = Array.isArray(data.transfers) ? data.transfers : []
  const payments = Array.isArray(data.payments) ? data.payments : [
    ...transfers,
    ...expenses.filter(e => e.cat === 'Debts' || e.cat === 'Debt' || e.debtId || (e.desc && e.desc.toLowerCase().includes('payment')))
  ]
  
  // Find accounts, debts, and IDs already explicitly in bills
  const explicitBillAccountIds = new Set(bills.map(b => b.accountId).filter(Boolean))
  const explicitBillDebtIds = new Set(bills.map(b => b.originalDebtId).filter(Boolean))
  const explicitBillNames = new Set(bills.map(b => (b.name || '').trim().toLowerCase()).filter(Boolean))
  const explicitBillIds = new Set(bills.map(b => b._id).filter(Boolean))
  
  const virtualBills = []

  // 1. Convert Debts into Virtual Bills
  debts.forEach(debt => {
    if (!debt) return
    if (explicitBillDebtIds.has(debt._id)) return
    if (explicitBillIds.has(`virtual-debt-${debt._id}`)) return
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

    let paymentAmount = Number(debt.minPayment) > 0 ? Number(debt.minPayment) : balance

    // If this is a credit card with billing cycle info
    if (debt.type === 'Credit Card') {
      const cycleDetails = getCreditCardCycleDetails(
        { ...debt, balance },
        expenses,
        payments,
        today()
      )

      if (cycleDetails.hasCycle) {
        const isClosedCyclePaid = cycleDetails.isPaid
        const hasUnbilledOnly = isClosedCyclePaid && cycleDetails.unbilledAmount > 0

        const targetDueDate = hasUnbilledOnly
          ? cycleDetails.nextDueDate
          : cycleDetails.dueDate

        const targetAmount = hasUnbilledOnly
          ? cycleDetails.unbilledAmount
          : (cycleDetails.billedAmount > 0 ? cycleDetails.billedAmount : (Number(debt.minPayment) > 0 ? Number(debt.minPayment) : balance))

        const targetPeriodKey = `monthly_${targetDueDate}`
        const paidPeriods = getBillPaidPeriods(debt)

        if (isClosedCyclePaid && !hasUnbilledOnly) {
          paidPeriods[targetPeriodKey] = { paid: true, date: today(), amount: targetAmount }
        }

        virtualBills.push({
          _id: `virtual-debt-${debt._id}`,
          name: `${debt.name} (Credit Card)`,
          amount: targetAmount,
          due: parseDayOfMonth(targetDueDate) || dueDay,
          dueDateOverride: targetDueDate,
          freq: 'monthly',
          cat: 'Bills',
          subcat: 'Credit Card',
          accountId: debt.accountId || '',
          isVirtual: true,
          isCreditCard: true,
          statementDate: debt.statementDate,
          originalDebtId: debt._id,
          paidPeriods,
        })
        return
      }
    }

    const currentPeriodKey = getBillPeriodKey({ due: dueDay, freq: 'monthly' }, today())
    const isDebtPaid = Boolean(debt.paidPeriods && (debt.paidPeriods[currentPeriodKey] || debt.paidPeriods[getMonthKey(today())]))

    virtualBills.push({
      _id: `virtual-debt-${debt._id}`,
      name: `${debt.name} (${debt.type || 'Debt'})`,
      amount: paymentAmount,
      due: dueDay,
      freq: 'monthly',
      cat: 'Bills',
      subcat: debt.type || 'Debt',
      accountId: debt.accountId || '',
      isVirtual: true,
      originalDebtId: debt._id,
      paidPeriods: isDebtPaid ? { [currentPeriodKey]: { paid: true } } : (debt.paidPeriods || {}),
    })
  })

  // 2. Convert Credit Card Accounts into Virtual Bills
  accounts.forEach(acc => {
    if (!acc || acc.type !== 'Credit Card') return
    if (explicitBillAccountIds.has(acc._id)) return
    if (explicitBillIds.has(`virtual-acc-${acc._id}`)) return
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

    const cycleDetails = getCreditCardCycleDetails(
      { ...acc, balance },
      expenses,
      payments,
      today()
    )

    if (cycleDetails.hasCycle) {
      const isClosedCyclePaid = cycleDetails.isPaid
      const hasUnbilledOnly = isClosedCyclePaid && cycleDetails.unbilledAmount > 0

      const targetDueDate = hasUnbilledOnly
        ? cycleDetails.nextDueDate
        : cycleDetails.dueDate

      const targetAmount = hasUnbilledOnly
        ? cycleDetails.unbilledAmount
        : (cycleDetails.billedAmount > 0 ? cycleDetails.billedAmount : balance)

      const targetPeriodKey = `monthly_${targetDueDate}`
      const paidPeriods = getBillPaidPeriods(acc)

      if (isClosedCyclePaid && !hasUnbilledOnly) {
        paidPeriods[targetPeriodKey] = { paid: true, date: today(), amount: targetAmount }
      }

      virtualBills.push({
        _id: `virtual-acc-${acc._id}`,
        name: `${acc.name} (Credit Card)`,
        amount: targetAmount,
        due: parseDayOfMonth(targetDueDate) || dueDay,
        dueDateOverride: targetDueDate,
        freq: 'monthly',
        cat: 'Bills',
        subcat: 'Credit Card',
        accountId: acc._id,
        isVirtual: true,
        isCreditCard: true,
        statementDate: acc.statementDate,
        paidPeriods,
      })
      return
    }

    const currentPeriodKey = getBillPeriodKey({ due: dueDay, freq: 'monthly' }, today())
    const isCardPaid = Boolean(acc.paidPeriods && (acc.paidPeriods[currentPeriodKey] || acc.paidPeriods[getMonthKey(today())]))

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
      paidPeriods: isCardPaid ? { [currentPeriodKey]: { paid: true } } : (acc.paidPeriods || {}),
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
    if (explicitBillIds.has(`virtual-tx-${latest._id}`)) return

    let dueDay = 15
    if (latest.date) {
      const day = parseInt(String(latest.date).slice(-2), 10)
      if (Number.isFinite(day) && day >= 1 && day <= 31) dueDay = day
    }

    const paidPeriods = {}
    chain.forEach(tx => {
      if (tx.date) {
        const periodKey = `${latest.recur || 'monthly'}_${tx.date}`
        paidPeriods[periodKey] = {
          paidAt: tx.createdAt || new Date(tx.date).getTime(),
          amount: tx.amount,
          date: tx.date,
          accountId: tx.accountId,
          expenseId: tx._id,
        }
      }
    })

    // If the latest transaction was logged in the current month or matches due date, mark this period paid
    const currentPeriodKey = getBillPeriodKey({ due: dueDay, freq: latest.recur || 'monthly' }, today())
    const currentMonthKey = getMonthKey(today())
    const hasCurrentMonthTx = chain.some(tx => tx.date && getMonthKey(tx.date) === currentMonthKey)
    if (hasCurrentMonthTx) {
      paidPeriods[currentPeriodKey] = {
        paidAt: latest.createdAt || Date.now(),
        amount: latest.amount,
        date: latest.date || today(),
        accountId: latest.accountId,
        expenseId: latest._id,
        paid: true,
      }
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
      paidPeriods,
    })
  })

  return virtualBills
}
