import { normalizeDate, today, getMonthKey } from './utils'

/**
 * Parses a day string or number into a valid day of month (1..31).
 */
export function parseDayOfMonth(val) {
  if (!val) return null
  const num = parseInt(String(val).trim().slice(-2), 10)
  return Number.isFinite(num) && num >= 1 && num <= 31 ? num : null
}

/**
 * Returns a normalized date string (YYYY-MM-DD) clamped to the valid days of that month.
 */
function makeValidDate(year, monthIndex, day) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  const clampedDay = Math.min(Math.max(day, 1), lastDay)
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`
}

/**
 * Computes the statement closing date and payment due date for a given year & month.
 * 
 * Rules:
 * If dueDay < statementDay (e.g. Cutoff 15th/20th, Due Date 7th):
 *   Due date is in the MONTH FOLLOWING the statement cutoff.
 * If dueDay > statementDay (e.g. Cutoff 5th, Due Date 25th):
 *   Due date is in the SAME MONTH as the statement cutoff.
 */
export function getCycleDatesForMonth(year, monthIndex, statementDay, dueDay) {
  const statementDate = makeValidDate(year, monthIndex, statementDay)
  
  let dueYear = year
  let dueMonthIndex = monthIndex
  
  if (dueDay <= statementDay) {
    // Due date is next month
    dueMonthIndex = monthIndex + 1
    if (dueMonthIndex > 11) {
      dueMonthIndex = 0
      dueYear = year + 1
    }
  }
  
  const dueDate = makeValidDate(dueYear, dueMonthIndex, dueDay)
  return { statementDate, dueDate }
}

/**
 * Finds which billing cycle a transaction belongs to based on transaction date and statement cutoff day.
 */
export function getCycleForTransaction(txDateStr, statementDay, dueDay) {
  const normalized = normalizeDate(txDateStr)
  if (!normalized || !statementDay) return null

  const [yStr, mStr, dStr] = normalized.split('-')
  const txYear = parseInt(yStr, 10)
  const txMonthIndex = parseInt(mStr, 10) - 1
  const txDay = parseInt(dStr, 10)

  // If transaction is on or before this month's statement cut-off, it belongs to this month's cycle.
  // If transaction is AFTER this month's statement cut-off, it rolls over to next month's cycle.
  let cycleYear = txYear
  let cycleMonthIndex = txMonthIndex

  if (txDay > statementDay) {
    cycleMonthIndex += 1
    if (cycleMonthIndex > 11) {
      cycleMonthIndex = 0
      cycleYear += 1
    }
  }

  const { statementDate, dueDate } = getCycleDatesForMonth(cycleYear, cycleMonthIndex, statementDay, dueDay || statementDay)
  return { cycleYear, cycleMonthIndex, statementDate, dueDate }
}

/**
 * Computes complete billing cycle state for a credit card account or debt.
 * Handles statement balances, unbilled current charges, and payment allocations.
 */
export function getCreditCardCycleDetails(cardOrDebt = {}, expenses = [], payments = [], referenceDate = today()) {
  const statementDay = parseDayOfMonth(cardOrDebt.statementDate)
  const dueDay = parseDayOfMonth(cardOrDebt.dueDate) || statementDay

  const currentTotalBalance = Math.abs(Number(cardOrDebt.balance) || 0)

  if (!statementDay || !dueDay) {
    return {
      hasCycle: false,
      statementDay: null,
      dueDay: dueDay || null,
      billedAmount: currentTotalBalance,
      unbilledAmount: 0,
      dueDate: null,
      isPaid: currentTotalBalance === 0,
    }
  }

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
  
  // Previous cycle start is the day after the cycle before closedCycle
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
  const relevantExpenses = expenses.filter(tx => tx && (tx.accountId === cardAccountId || tx.debtId === cardOrDebt._id))
  const relevantPayments = payments.filter(tx => tx && (tx.toAccountId === cardAccountId || tx.accountId === cardAccountId || tx.debtId === cardOrDebt._id))

  // Sum transactions in closed cycle
  let closedCycleCharges = 0
  let unbilledCharges = 0

  relevantExpenses.forEach(tx => {
    const txDate = normalizeDate(tx.date)
    if (!txDate) return
    const amt = Math.abs(Number(tx.amount) || 0)

    if (txDate > closedCycleStartDate && txDate <= closedCycle.statementDate) {
      closedCycleCharges += amt
    } else if (txDate > closedCycle.statementDate) {
      unbilledCharges += amt
    }
  })

  // Sum payments made towards closed cycle (payments made after closed statement date)
  let paymentsForClosedCycle = 0
  relevantPayments.forEach(tx => {
    const txDate = normalizeDate(tx.date)
    if (!txDate) return
    const amt = Math.abs(Number(tx.amount) || 0)
    if (txDate > closedCycle.statementDate) {
      paymentsForClosedCycle += amt
    }
  })

  // If explicit transaction history is sparse, calculate from balance
  let billedAmount = closedCycleCharges > 0 ? Math.max(0, closedCycleCharges - paymentsForClosedCycle) : 0
  let unbilledAmount = unbilledCharges

  if (relevantExpenses.length === 0 && currentTotalBalance > 0) {
    // If user hasn't logged individual expenses, check if today is past due date or if paid
    const isPastDue = refNorm > closedCycle.dueDate
    if (isPastDue) {
      // Past due date is treated as paid if card was used recently
      billedAmount = 0
      unbilledAmount = currentTotalBalance
    } else {
      billedAmount = currentTotalBalance
      unbilledAmount = 0
    }
  }

  const isClosedCyclePaid = billedAmount <= 0

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
