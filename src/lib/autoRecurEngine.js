import { today } from './utils'
import { getProjectedTransactions } from './recurrence'
import { fsAddTransaction, fsMarkBillPaid } from './firestore'
import { getBillPeriodInfo } from './bills'

export async function runAutoRecurrenceEngine(uid, allIncome = [], allExpenses = [], accounts = [], bills = []) {
  if (!uid) return 0
  let addedCount = 0

  // Auto-deduct bills that have autoDeduct === true and are due today or overdue
  if (Array.isArray(bills) && bills.length > 0) {
    const todayStr = today()
    for (const bill of bills) {
      if (!bill || !bill.autoDeduct || !bill._id) continue
      const period = getBillPeriodInfo(bill, todayStr)
      if (period.paid) continue
      if (todayStr >= period.dueDate) {
        try {
          await fsMarkBillPaid(uid, bill, {
            amount: bill.amount,
            date: period.dueDate > todayStr ? todayStr : period.dueDate,
            accountId: bill.accountId || '',
            source: 'auto-deduct-engine',
          }, accounts)
          addedCount++
        } catch (err) {
          console.error('Failed to auto-deduct bill', bill.name, err)
        }
      }
    }
  }
  
  const currentDate = new Date()
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth()
  
  // Lookback to previous month to catch missed entries if the user hasn't opened the app in a while
  let lastMonthYear = currentYear
  let lastMonthNum = currentMonth - 1
  if (lastMonthNum < 0) {
    lastMonthNum = 11
    lastMonthYear -= 1
  }
  
  const projectedLastMonth = getProjectedTransactions(allIncome, allExpenses, lastMonthYear, lastMonthNum)
  const projectedThisMonth = getProjectedTransactions(allIncome, allExpenses, currentYear, currentMonth)
  
  const allProjected = [...projectedLastMonth, ...projectedThisMonth]
  
  const nowStr = today()
  // Only auto-log transactions whose projected date is today or in the past, deduplicating by source and occurrence key
  const seenKeys = new Set()
  const dueProjected = allProjected.filter(tx => {
    if (!tx || tx.date > nowStr) return false
    const key = `${tx._sourceId || tx.recurrenceSourceId}_${tx._occurrenceKey || tx.date}`
    if (seenKeys.has(key)) return false
    seenKeys.add(key)
    return true
  })
  
  if (dueProjected.length === 0) return addedCount
  
  for (const pTx of dueProjected) {
    const col = pTx.type === 'income' ? 'income' : 'expenses'
    const payload = {
      desc: pTx.desc || '',
      amount: pTx.amount || 0,
      cat: pTx.cat || '',
      subcat: pTx.subcat || '',
      date: pTx.date,
      recur: pTx.recur || '',
      presetKey: pTx.presetKey || '',
      accountId: pTx.accountId || '',
      accountBalanceLinked: pTx.accountBalanceLinked || false,
      paymentStatus: 'paid', // Auto-logged items are assumed paid since the date has arrived
      recurrenceSourceId: pTx._sourceId,
      recurrenceOccurrenceKey: pTx._occurrenceKey,
      source: 'auto-recur-engine'
    }
    
    try {
      await fsAddTransaction(uid, col, payload, accounts)
      addedCount++
    } catch (err) {
      console.error('Failed to auto-log recurring transaction', err)
    }
  }
  
  return addedCount
}
