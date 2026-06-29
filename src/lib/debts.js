/**
 * Smart Debt payoff simulation engine.
 * Computes monthly interest, rolls over paid-off minimums,
 * and prioritizes extra payments under Avalanche and Snowball strategies.
 */

export function calculatePayoffSchedule(debts = [], extraBudget = 0, strategy = 'avalanche') {
  // Filter active debts (debts with positive balance)
  const activeDebts = debts
    .filter(d => (Number(d.balance) || 0) > 0)
    .map(d => ({
      id: d._id || d.id,
      name: d.name || 'Unnamed Debt',
      balance: Number(d.balance) || 0,
      originalAmount: Number(d.originalAmount) || Number(d.balance) || 0,
      interestRate: Number(d.interestRate) || 0,
      minPayment: Number(d.minPayment) || 0,
      color: d.color || '#ff5370',
    }))

  if (activeDebts.length === 0) {
    return {
      timeline: [],
      totalInterest: 0,
      months: 0,
      payoffDate: null,
      error: null,
    }
  }

  const sumMinPayments = activeDebts.reduce((sum, d) => sum + d.minPayment, 0)
  const totalMonthlyBudget = sumMinPayments + extraBudget

  // Priority sorting helper
  const sortDebts = (list) => {
    return [...list].sort((a, b) => {
      if (strategy === 'avalanche') {
        // 1. Higher interest rate first
        if (b.interestRate !== a.interestRate) {
          return b.interestRate - a.interestRate
        }
        // 2. Larger balance second
        return b.balance - a.balance
      } else {
        // 1. Smaller balance first (Snowball)
        if (a.balance !== b.balance) {
          return a.balance - b.balance
        }
        // 2. Higher interest rate second
        return b.interestRate - a.interestRate
      }
    })
  }

  const timeline = []
  const maxMonths = 360 // Cap at 30 years to avoid infinite loop
  let currentDebts = activeDebts.map(d => ({ ...d }))
  let totalInterestPaid = 0
  let monthIndex = 0

  // Verify that the total monthly budget is sufficient to cover initial monthly interest
  const initialMonthlyInterest = currentDebts.reduce(
    (sum, d) => sum + d.balance * (d.interestRate / 100 / 12),
    0
  )
  if (totalMonthlyBudget <= initialMonthlyInterest) {
    return {
      timeline: [],
      totalInterest: 0,
      months: 0,
      payoffDate: null,
      error: 'Monthly budget is too low to cover interest. Debt balance will grow infinitely.',
    }
  }

  while (currentDebts.some(d => d.balance > 0) && monthIndex < maxMonths) {
    monthIndex++

    // Determine current order of payoff
    const sortedActive = sortDebts(currentDebts.filter(d => d.balance > 0))
    if (sortedActive.length === 0) break

    // 1. Apply interest to active debts
    let monthlyInterestAccrued = 0
    currentDebts.forEach(d => {
      if (d.balance > 0) {
        const interest = d.balance * (d.interestRate / 100 / 12)
        d.balance += interest
        totalInterestPaid += interest
        monthlyInterestAccrued += interest
      }
    })

    let remainingBudget = totalMonthlyBudget
    const paymentsThisMonth = {}
    currentDebts.forEach(d => {
      paymentsThisMonth[d.id] = 0
    })

    // 2. First Pass: Pay minimums on all active debts
    const activeInOrderOfMin = [...currentDebts].filter(d => d.balance > 0)
    activeInOrderOfMin.forEach(d => {
      const minDue = Math.min(d.balance, d.minPayment)
      if (minDue > 0) {
        d.balance -= minDue
        paymentsThisMonth[d.id] += minDue
        remainingBudget -= minDue
      }
    })

    // 3. Second Pass: Allocate remaining budget (extra payment + paid-off roll overs) to highest priority
    if (remainingBudget > 0) {
      const priorityList = sortDebts(currentDebts.filter(d => d.balance > 0))
      for (const d of priorityList) {
        if (remainingBudget <= 0) break
        const payAmount = Math.min(d.balance, remainingBudget)
        if (payAmount > 0) {
          d.balance -= payAmount
          paymentsThisMonth[d.id] += payAmount
          remainingBudget -= payAmount
        }
      }
    }

    // Record this month's stats
    timeline.push({
      monthIndex,
      debts: currentDebts.map(d => ({
        id: d.id,
        name: d.name,
        balance: Math.round(d.balance * 100) / 100,
        payment: Math.round(paymentsThisMonth[d.id] * 100) / 100,
      })),
      totalOwed: Math.round(currentDebts.reduce((sum, d) => sum + d.balance, 0) * 100) / 100,
      interestAccrued: Math.round(monthlyInterestAccrued * 100) / 100,
    })
  }

  // Calculate payoff date
  const now = new Date()
  const payoffDate = new Date(now.getFullYear(), now.getMonth() + monthIndex, 1)

  return {
    timeline,
    totalInterest: Math.round(totalInterestPaid * 100) / 100,
    months: monthIndex,
    payoffDate: monthIndex >= maxMonths ? null : payoffDate,
    error: monthIndex >= maxMonths ? 'Timeline exceeds 30 years.' : null,
  }
}
