import { dateDaysAgo } from './lakasHelpers'

// Helpers
function parseDateStr(ds) {
  const [y, m, d] = ds.split('-').map(Number)
  return { y, m, d }
}

function getMTDTotal(list = [], year, month, maxDay) {
  return list.reduce((sum, tx) => {
    if (!tx.date) return sum
    const d = parseDateStr(tx.date)
    if (d.y === year && d.m === month && d.d <= maxDay) {
      return sum + (Number(tx.amount) || 0)
    }
    return sum
  }, 0)
}

function getLastMonth(year, month) {
  let ly = year
  let lm = month - 1
  if (lm < 1) {
    lm = 12
    ly -= 1
  }
  return { ly, lm }
}

export function generateDashboardInsight(data, todayStr) {
  const { y: curY, m: curM, d: curD } = parseDateStr(todayStr)
  const { ly, lm } = getLastMonth(curY, curM)

  const income = data.income || []
  const expenses = data.expenses || []
  const bills = data.bills || []

  // Calculate MTD totals
  const currentIncomeMTD = getMTDTotal(income, curY, curM, curD)
  const currentExpenseMTD = getMTDTotal(expenses, curY, curM, curD)
  const lastExpenseMTD = getMTDTotal(expenses, ly, lm, curD)

  // Trigger 1: High Spending Warning
  if (lastExpenseMTD > 1000 && currentExpenseMTD > lastExpenseMTD * 1.15) {
    const diff = currentExpenseMTD - lastExpenseMTD
    return {
      type: 'warning',
      icon: '⚠️',
      title: 'Spending Alert',
      message: `You've spent ₱${diff.toLocaleString(undefined, { maximumFractionDigits: 0 })} more this month compared to this exact time last month.`
    }
  }

  // Trigger 2: High Savings Rate
  if (currentIncomeMTD > 1000) {
    const savings = currentIncomeMTD - currentExpenseMTD
    const savingsRate = savings / currentIncomeMTD
    if (savingsRate >= 0.20) {
      const pct = Math.round(savingsRate * 100)
      return {
        type: 'positive',
        icon: '🔥',
        title: 'Savings Milestone',
        message: `Incredible work! You've saved ${pct}% of your income so far this month.`
      }
    }
  }

  // Trigger 3: Upcoming Bills
  const upcomingBills = bills
    .filter(b => !b.isPaid && b.dueDate >= todayStr)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  if (upcomingBills.length > 0) {
    const nextBill = upcomingBills[0]
    const daysUntil = Math.round((new Date(nextBill.dueDate) - new Date(todayStr)) / (1000 * 60 * 60 * 24))
    if (daysUntil <= 3) {
      return {
        type: 'neutral',
        icon: '📅',
        title: 'Upcoming Bill',
        message: `Don't forget! ${nextBill.desc || nextBill.cat} is due ${daysUntil === 0 ? 'today' : 'in ' + daysUntil + ' days'}.`
      }
    }
  }

  // Trigger 4: Zero Spend Streak
  let spentInLast3Days = false
  for (let i = 0; i < 3; i++) {
    const d = dateDaysAgo(i)
    if (expenses.some(tx => tx.date === d)) {
      spentInLast3Days = true
      break
    }
  }

  if (!spentInLast3Days && curD > 3) {
    return {
      type: 'positive',
      icon: '🎉',
      title: 'Quiet Wallet',
      message: 'You haven\'t logged a single expense in 3 days. Your wallet is resting!'
    }
  }

  // Fallback
  return {
    type: 'neutral',
    icon: '💡',
    title: 'Financial Rhythm',
    message: 'Everything is flowing smoothly. Keep logging your habits to maintain your rhythm!'
  }
}
