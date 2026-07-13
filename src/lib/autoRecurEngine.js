import { today } from './utils'
import { getProjectedTransactions } from './recurrence'
import { fsAddTransaction } from './firestore'

export async function runAutoRecurrenceEngine(uid, allIncome = [], allExpenses = [], accounts = []) {
  if (!uid) return 0
  
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
  // Only auto-log transactions whose projected date is today or in the past
  const dueProjected = allProjected.filter(tx => tx.date <= nowStr)
  
  if (dueProjected.length === 0) return 0
  
  let addedCount = 0
  
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
