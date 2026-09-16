import { normalizeDate, today, getMonthKey } from './utils'

/**
 * Parses a day string or number into a valid day of month (1..31).
 */
export function parseDayOfMonth(val) {
  if (!val && val !== 0) return null
  const num = parseInt(String(val).trim().slice(-2), 10)
  return Number.isFinite(num) && num >= 1 && num <= 31 ? num : null
}

/**
 * Infers a realistic statement cut-off day if only due day is provided.
 * Standard credit card grace period is ~20 to 25 days before payment due date.
 */
export function inferStatementDay(dueDay) {
  const d = parseDayOfMonth(dueDay)
  if (!d) return 15
  let stmt = d - 25
  if (stmt <= 0) stmt += 30
  return Math.max(1, Math.min(28, stmt))
}

/**
 * Returns a normalized date string (YYYY-MM-DD) clamped to the valid days of that month.
 */
export function makeValidDate(year, monthIndex, day) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  const clampedDay = Math.min(Math.max(day, 1), lastDay)
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`
}

/**
 * Computes the statement closing date and payment due date for a given year & month.
 * 
 * Rules:
 * If dueDay <= statementDay (e.g. Cutoff 10th/15th/20th, Due Date 5th/7th):
 *   Due date is in the MONTH FOLLOWING the statement cutoff.
 * If dueDay > statementDay (e.g. Cutoff 5th, Due Date 25th):
 *   Due date is in the SAME MONTH as the statement cutoff.
 */
export function getCycleDatesForMonth(year, monthIndex, statementDay, dueDay) {
  const sDay = parseDayOfMonth(statementDay) || 15
  const dDay = parseDayOfMonth(dueDay) || (sDay <= 10 ? sDay + 20 : sDay - 10)
  const statementDate = makeValidDate(year, monthIndex, sDay)
  
  let dueYear = year
  let dueMonthIndex = monthIndex
  
  if (dDay <= sDay) {
    // Due date is next month
    dueMonthIndex = monthIndex + 1
    if (dueMonthIndex > 11) {
      dueMonthIndex = 0
      dueYear = year + 1
    }
  }
  
  const dueDate = makeValidDate(dueYear, dueMonthIndex, dDay)
  return { statementDate, dueDate }
}

/**
 * Finds which billing cycle a transaction belongs to based on transaction date and statement cutoff day.
 */
export function getCycleForTransaction(txDateStr, statementDay, dueDay) {
  const normalized = normalizeDate(txDateStr)
  if (!normalized) return null

  const sDay = parseDayOfMonth(statementDay) || (dueDay ? inferStatementDay(dueDay) : 15)
  const dDay = parseDayOfMonth(dueDay) || (sDay <= 10 ? sDay + 20 : sDay - 10)

  const [yStr, mStr, dStr] = normalized.split('-')
  const txYear = parseInt(yStr, 10)
  const txMonthIndex = parseInt(mStr, 10) - 1
  const txDay = parseInt(dStr, 10)

  // If transaction is on or before this month's statement cut-off, it belongs to this month's cycle.
  // If transaction is AFTER this month's statement cut-off, it rolls over to next month's cycle.
  let cycleYear = txYear
  let cycleMonthIndex = txMonthIndex

  if (txDay > sDay) {
    cycleMonthIndex += 1
    if (cycleMonthIndex > 11) {
      cycleMonthIndex = 0
      cycleYear += 1
    }
  }

  const { statementDate, dueDate } = getCycleDatesForMonth(cycleYear, cycleMonthIndex, sDay, dDay)
  return { cycleYear, cycleMonthIndex, statementDate, dueDate }
}

/**
 * Computes complete billing cycle state for a credit card account or debt.
 * Handles statement balances, unbilled current charges, and payment allocations.
 */
export function getCreditCardCycleDetails(cardOrDebt = {}, expenses = [], payments = [], referenceDate = today()) {
  const rawStatementDay = parseDayOfMonth(cardOrDebt.statementDate)
  const rawDueDay = parseDayOfMonth(cardOrDebt.dueDate)

  // If neither statement date nor due date is given, fallback
  if (!rawStatementDay && !rawDueDay) {
    const currentTotalBalance = Math.abs(Number(cardOrDebt.balance) || 0)
    return {
      hasCycle: false,
      statementDay: null,
      dueDay: null,
      billedAmount: currentTotalBalance,
      unbilledAmount: 0,
      dueDate: null,
      isPaid: currentTotalBalance === 0,
      totalBalance: currentTotalBalance,
    }
  }

  const dueDay = rawDueDay || (rawStatementDay <= 10 ? rawStatementDay + 20 : rawStatementDay - 10)
  const statementDay = rawStatementDay || inferStatementDay(dueDay)

  const currentTotalBalance = Math.abs(Number(cardOrDebt.balance) || 0)

  const refNorm = normalizeDate(referenceDate) || today()
  const [refY, refM, refD] = refNorm.split('-').map(Number)
  const refYear = refY
  const refMonthIndex = refM - 1
  const refDay = refD

  // Determine current closed statement vs. current in-progress statement
  let closedCycleYear = refYear
  let closedCycleMonthIndex = refMonthIndex

  if (refDay <= statementDay) {
    // Current month's statement hasn't closed yet; latest closed statement is previous month
    closedCycleMonthIndex -= 1
    if (closedCycleMonthIndex < 0) {
      closedCycleMonthIndex = 11
      closedCycleYear -= 1
    }
  }

  const closedCycle = getCycleDatesForMonth(closedCycleYear, closedCycleMonthIndex, statementDay, dueDay)
  
  // Previous cycle start is the statement date before closedCycle
  let prevCycleYear = closedCycleYear
  let prevCycleMonthIndex = closedCycleMonthIndex - 1
  if (prevCycleMonthIndex < 0) {
    prevCycleMonthIndex = 11
    prevCycleYear -= 1
  }
  const prevCycle = getCycleDatesForMonth(prevCycleYear, prevCycleMonthIndex, statementDay, dueDay)
  const closedCycleStartDate = prevCycle.statementDate // transactions > prevCycle.statementDate && <= closedCycle.statementDate

  // Next in-progress cycle (closing in the future)
  let nextCycleYear = closedCycleYear
  let nextCycleMonthIndex = closedCycleMonthIndex + 1
  if (nextCycleMonthIndex > 11) {
    nextCycleMonthIndex = 0
    nextCycleYear += 1
  }
  const nextCycle = getCycleDatesForMonth(nextCycleYear, nextCycleMonthIndex, statementDay, dueDay)

  // Filter expenses and payments belonging to this card
  const cardAccountId = cardOrDebt.accountId || cardOrDebt._id
  const debtId = cardOrDebt._id || ''
  const cleanDebtId = String(debtId).replace('synth_', '')
  const cardNameLower = String(cardOrDebt.name || '').toLowerCase().trim()

  const relevantExpenses = expenses.filter(tx => {
    if (!tx) return false
    if (tx.accountId === cardAccountId || tx.debtId === debtId || tx.debtId === cleanDebtId) return true
    return false
  })

  const relevantPayments = payments.filter(tx => {
    if (!tx) return false
    if (tx.toAccountId === cardAccountId || tx.accountId === cardAccountId || tx.debtId === debtId || tx.debtId === cleanDebtId) return true
    if (cardNameLower && tx.desc && tx.desc.toLowerCase().includes(cardNameLower)) {
      if (tx.type === 'transfer' || tx.cat === 'Debts' || tx.cat === 'Debt' || tx.desc.toLowerCase().includes('payment')) return true
    }
    return false
  })

  // Check if debt or account has recorded paid periods for this closed cycle
  const paidPeriodsMap = cardOrDebt.paidPeriods && typeof cardOrDebt.paidPeriods === 'object' ? cardOrDebt.paidPeriods : {}
  const closedDueMonth = getMonthKey(closedCycle.dueDate)
  const closedStmtMonth = getMonthKey(closedCycle.statementDate)
  const hasExplicitPaidPeriod = Boolean(
    paidPeriodsMap[closedDueMonth] ||
    paidPeriodsMap[closedStmtMonth] ||
    paidPeriodsMap[`monthly_${closedCycle.dueDate}`] ||
    paidPeriodsMap[closedCycle.dueDate]
  )

  // Calculate unbilled charges (transactions dated strictly AFTER the closed statement cut-off)
  let unbilledCharges = 0
  let closedCycleCharges = 0

  relevantExpenses.forEach(tx => {
    const txDate = normalizeDate(tx.date)
    if (!txDate) return
    const amt = Math.abs(Number(tx.amount) || 0)

    if (txDate > closedCycle.statementDate) {
      unbilledCharges += amt
    } else if (txDate > closedCycleStartDate && txDate <= closedCycle.statementDate) {
      closedCycleCharges += amt
    }
  })

  // Calculate payments made strictly after the closed cycle start date
  let paymentsForClosedCycle = 0
  relevantPayments.forEach(tx => {
    const txDate = normalizeDate(tx.date)
    if (!txDate) return
    const amt = Math.abs(Number(tx.amount) || 0)
    if (txDate > closedCycleStartDate) {
      paymentsForClosedCycle += amt
    }
  })

  // Billed Statement Balance:
  // It is the total balance on the card minus any post-cutoff unbilled charges.
  let billedAmount = 0
  if (hasExplicitPaidPeriod) {
    billedAmount = 0
  } else if (currentTotalBalance > 0) {
    billedAmount = Math.max(0, currentTotalBalance - unbilledCharges)
  } else if (closedCycleCharges > 0) {
    billedAmount = Math.max(0, closedCycleCharges - paymentsForClosedCycle)
  }

  const unbilledAmount = unbilledCharges
  const isClosedCyclePaid = hasExplicitPaidPeriod || (billedAmount <= 0)

  return {
    hasCycle: true,
    statementDay,
    dueDay,
    closedStatementDate: closedCycle.statementDate,
    dueDate: closedCycle.dueDate,
    billedAmount,
    unbilledAmount,
    nextStatementDate: nextCycle.statementDate,
    nextDueDate: nextCycle.dueDate,
    isPaid: isClosedCyclePaid,
    totalBalance: currentTotalBalance,
  }
}

