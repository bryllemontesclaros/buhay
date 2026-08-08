import { normalizeDate } from './utils'

// Recurrence engine — generates projected dates for recurring transactions
// given a source transaction, returns all dates it should appear in a given month/year

const recurringDateFormatter = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export function formatRecurringDateLabel(value) {
  if (!value) return ''
  const normalized = normalizeDate(value)
  if (!normalized) return value
  const parsed = new Date(`${normalized}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return normalized
  return recurringDateFormatter.format(parsed)
}

export function getRecurringOccurrenceKey(tx = {}) {
  return normalizeDate(tx?._occurrenceKey || tx?.recurrenceOccurrenceKey || tx?.date)
}

export function getRecurringActionKey(tx = {}) {
  const sourceId = tx?._sourceId || tx?.recurrenceSourceId
  if (!sourceId) return ''
  const occurrenceKey = getRecurringOccurrenceKey(tx)
  return occurrenceKey ? `${sourceId}:${occurrenceKey}` : ''
}

export function isRecurringCycleSettled(entries = [], tx = {}) {
  const sourceId = tx?._sourceId || tx?.recurrenceSourceId
  const occurrenceKey = getRecurringOccurrenceKey(tx)
  if (!sourceId || !occurrenceKey) return false

  // 1. Exact match via recurrenceSourceId and occurrenceKey or billId / billPeriodKey
  const hasExactMatch = entries.some(existing => {
    if (existing?._projected) return false
    if (existing?.recurrenceSourceId === sourceId && getRecurringOccurrenceKey(existing) === occurrenceKey) return true
    if (existing?.billId && (existing.billId === sourceId || existing.billId === `virtual-tx-${sourceId}`) && existing.billPeriodKey && existing.billPeriodKey.includes(occurrenceKey)) return true
    return false
  })
  if (hasExactMatch) return true

  // 2. Fallback heuristic: check if another actual transaction has already been logged on this date
  // with a highly similar description/category and exact same amount, which prevents double-payment
  const amount = Number(tx.amount) || 0
  const normalizedDesc = String(tx.desc || tx.cat || '').toLowerCase().trim()

  return entries.some(existing => {
    if (existing?._projected) return false
    if (getRecurringOccurrenceKey(existing) !== occurrenceKey) return false

    const existingAmount = Number(existing.amount) || 0
    if (Math.abs(existingAmount - amount) > 0.01) return false

    const existingDesc = String(existing.desc || existing.cat || '').toLowerCase().trim()

    // Check if descriptions are similar (e.g. one contains the other, or one is "X payment" and other is "X")
    const isSimilarDesc = existingDesc.includes(normalizedDesc)
      || normalizedDesc.includes(existingDesc)
      || (existingDesc.replace(/\s+payment$/, '') === normalizedDesc.replace(/\s+payment$/, ''))

    return isSimilarDesc
  })
}

export function isRecurringRecordedOffDueDate(tx = {}) {
  const occurrenceKey = normalizeDate(tx?.recurrenceOccurrenceKey)
  const actualDate = normalizeDate(tx?.date)
  return Boolean(occurrenceKey && actualDate && actualDate !== occurrenceKey)
}

export function getRecurringDates(tx, targetYear, targetMonth) {
  if (!tx.recur || tx.recur === '') return []

  const originDate = new Date(tx.date)
  if (isNaN(originDate)) return []

  const originYear = originDate.getFullYear()
  const originMonth = originDate.getMonth()
  const originDay = originDate.getDate()

  const results = []
  const daysInTarget = new Date(targetYear, targetMonth + 1, 0).getDate()

  // Helper — push a date string if it falls in target month and is on/after origin
  function pushIfValid(year, month, day) {
    if (year !== targetYear || month !== targetMonth) return
    const d = Math.min(day, new Date(year, month + 1, 0).getDate())
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    // Must be on or after origin date
    if (ds >= tx.date) results.push(ds)
  }

  switch (tx.recur) {
    case 'daily': {
      for (let d = 1; d <= daysInTarget; d++) {
        pushIfValid(targetYear, targetMonth, d)
      }
      break
    }
    case 'weekly': {
      // Same day of week as origin, every week in target month
      const originDow = originDate.getDay()
      for (let d = 1; d <= daysInTarget; d++) {
        const dt = new Date(targetYear, targetMonth, d)
        if (dt.getDay() === originDow) pushIfValid(targetYear, targetMonth, d)
      }
      break
    }
    case 'bi-weekly': {
      const originDow = originDate.getDay()
      // Find first occurrence in target month that matches DOW
      // Then every 14 days
      const firstOfMonth = new Date(targetYear, targetMonth, 1)
      const msPerDay = 86400000
      const msOrigin = originDate.getTime()
      for (let d = 1; d <= daysInTarget; d++) {
        const dt = new Date(targetYear, targetMonth, d)
        const diff = Math.round((dt.getTime() - msOrigin) / msPerDay)
        if (diff >= 0 && diff % 14 === 0) pushIfValid(targetYear, targetMonth, d)
      }
      break
    }
    case 'tri-weekly': {
      const msPerDay = 86400000
      const msOrigin = originDate.getTime()
      for (let d = 1; d <= daysInTarget; d++) {
        const dt = new Date(targetYear, targetMonth, d)
        const diff = Math.round((dt.getTime() - msOrigin) / msPerDay)
        if (diff >= 0 && diff % 21 === 0) pushIfValid(targetYear, targetMonth, d)
      }
      break
    }
    case 'quad-weekly': {
      const msPerDay = 86400000
      const msOrigin = originDate.getTime()
      for (let d = 1; d <= daysInTarget; d++) {
        const dt = new Date(targetYear, targetMonth, d)
        const diff = Math.round((dt.getTime() - msOrigin) / msPerDay)
        if (diff >= 0 && diff % 28 === 0) pushIfValid(targetYear, targetMonth, d)
      }
      break
    }
    case 'semi-monthly': {
      // 1st and 15th every month (on or after origin)
      const targetIsAfterOrigin = (targetYear > originYear) || (targetYear === originYear && targetMonth >= originMonth)
      if (targetIsAfterOrigin) {
        pushIfValid(targetYear, targetMonth, 1)
        pushIfValid(targetYear, targetMonth, 15)
      }
      break
    }
    case 'monthly': {
      // Same day of month as origin
      const targetIsAfterOrigin = (targetYear > originYear) || (targetYear === originYear && targetMonth > originMonth)
      if (targetIsAfterOrigin) {
        pushIfValid(targetYear, targetMonth, originDay)
      } else if (targetYear === originYear && targetMonth === originMonth) {
        pushIfValid(targetYear, targetMonth, originDay)
      }
      break
    }
    default:
      break
  }

  return [...new Set(results)]
}

// For a given month, get all projected recurring transactions (virtual — not saved to DB)
export function getProjectedTransactions(allIncome, allExpenses, targetYear, targetMonth) {
  const projected = []

  const process = (txList, type) => {
    txList.forEach(tx => {
      if (!tx.recur) return
      const dates = getRecurringDates(tx, targetYear, targetMonth)
      dates.forEach(date => {
        // Skip if original date — already in the list
        if (date === tx.date) return
        const projectedTx = {
          ...tx,
          _id: `proj_${tx._id}_${date}`,
          date,
          _projected: true,
          _sourceId: tx._id,
          _occurrenceKey: date,
          type,
        }
        // Skip if the projected instance has already been logged as a real entry.
        // We link those entries back to the recurrence source via `recurrenceSourceId`.
        if (isRecurringCycleSettled(txList, projectedTx)) return
        projected.push({
          ...projectedTx,
        })
      })
    })
  }

  process(allIncome, 'income')
  process(allExpenses, 'expense')

  return projected
}
