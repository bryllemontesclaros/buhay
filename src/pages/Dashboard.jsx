import { useMemo, useState } from 'react'
import { getBillPeriodInfo } from '../lib/bills'
import { getAccountSignedBalance, getBalanceOverrides, getMonthEndBalanceForView, getMonthTotal, getMonthTransactions, isTransactionPaid } from '../lib/finance'
import { getTakdaTotalBalanceNow } from '../lib/balanceSystem'
import { getIncludedPortfolioValue } from '../lib/portfolio'
import { getProjectedTransactions } from '../lib/recurrence'
import { displayValue, fmt, isSameMonth, maskMoney } from '../lib/utils'
import DetailsModal from '../components/DetailsModal'
import styles from './Page.module.css'
import dStyles from './Dashboard.module.css'

const TYPE_COLOR = { income: 'var(--accent)', expense: 'var(--red)' }
const TYPE_SIGN = { income: '+', expense: '−' }
const TYPE_BG = { income: 'var(--accent-glow)', expense: 'var(--red-dim)' }

function DashboardIcon({ type }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  if (type === 'income') {
    return (
      <svg {...common}>
        <path d="M12 19V5"/>
        <path d="m6 11 6-6 6 6"/>
      </svg>
    )
  }

  if (type === 'salary') {
    return (
      <svg {...common}>
        <rect x="3" y="6" width="18" height="13" rx="3"/>
        <path d="M7 10h5"/>
        <path d="M16 14h2"/>
      </svg>
    )
  }

  if (type === 'food') {
    return (
      <svg {...common}>
        <path d="M7 3v8"/>
        <path d="M5 3v4"/>
        <path d="M9 3v4"/>
        <path d="M7 11v10"/>
        <path d="M15 3v18"/>
        <path d="M15 3c2 1.2 3 3.2 3 6 0 2.4-1 4-3 4"/>
      </svg>
    )
  }

  if (type === 'transport') {
    return (
      <svg {...common}>
        <path d="M5 16h14l-1.4-5.2A2.4 2.4 0 0 0 15.3 9H8.7a2.4 2.4 0 0 0-2.3 1.8L5 16Z"/>
        <path d="M7 16v2"/>
        <path d="M17 16v2"/>
        <path d="M8 13h.01"/>
        <path d="M16 13h.01"/>
      </svg>
    )
  }

  if (type === 'bills') {
    return (
      <svg {...common}>
        <path d="M7 3.5h10a2 2 0 0 1 2 2V21l-3-1.8-3 1.8-3-1.8L7 21V5.5a2 2 0 0 1 2-2Z"/>
        <path d="M10 8h6"/>
        <path d="M10 12h6"/>
      </svg>
    )
  }

  if (type === 'shopping') {
    return (
      <svg {...common}>
        <path d="M6 8h12l-1 12H7L6 8Z"/>
        <path d="M9 8a3 3 0 0 1 6 0"/>
      </svg>
    )
  }

  if (type === 'health') {
    return (
      <svg {...common}>
        <path d="M12 5v14"/>
        <path d="M5 12h14"/>
        <rect x="4" y="4" width="16" height="16" rx="4"/>
      </svg>
    )
  }

  return (
    <svg {...common}>
      <path d="M12 5v14"/>
      <path d="m18 13-6 6-6-6"/>
    </svg>
  )
}

function getTransactionIconKey(tx = {}) {
  const text = `${tx.cat || ''} ${tx.subcat || ''} ${tx.desc || ''}`.toLowerCase()

  if (tx.txType === 'income') {
    return /salary|payroll|freelance|bonus|business/.test(text) ? 'salary' : 'income'
  }

  if (/food|dining|coffee|restaurant|grocery|groceries|market|supermarket/.test(text)) return 'food'
  if (/transport|commute|grab|taxi|bus|jeep|fuel|gas|parking/.test(text)) return 'transport'
  if (/bill|rent|electric|water|internet|mobile|subscription|utilities|loan|installment/.test(text)) return 'bills'
  if (/shopping|clothes|mall|store|online/.test(text)) return 'shopping'
  if (/health|medicine|doctor|pharmacy|hospital/.test(text)) return 'health'
  return 'expense'
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

export default function Dashboard({ user, data, profile = {}, symbol, privacyMode = false, onTogglePrivacy, exchangeRates = null }) {
  const s = symbol || '₱'
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const [detailsMode, setDetailsMode] = useState('')
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'
  const name = user?.displayName?.split(' ')[0] || 'there'

  const mIncome = useMemo(() => getMonthTotal(data.income, year, month), [data.income, year, month])
  const mExpense = useMemo(() => getMonthTotal(data.expenses, year, month), [data.expenses, year, month])
  const mNet = mIncome - mExpense

  let lm = month - 1
  let ly = year
  if (lm < 0) {
    lm = 11
    ly--
  }
  const lmExpense = useMemo(() => getMonthTotal(data.expenses, ly, lm), [data.expenses, ly, lm])
  const expenseChange = lmExpense > 0 ? Math.round(((mExpense - lmExpense) / lmExpense) * 100) : null

  const portfolioIncludedValue = getIncludedPortfolioValue(data.portfolioHoldings || [], exchangeRates)
  const netWorth = getTakdaTotalBalanceNow(data.accounts, data.portfolioHoldings || [], data.debts || [], exchangeRates)

  const monthSpending = useMemo(() => {
    const spending = {}
    data.expenses.filter(t => isTransactionPaid(t) && isSameMonth(t.date, year, month)).forEach(t => {
      spending[t.cat] = (spending[t.cat] || 0) + (t.amount || 0)
    })
    return spending
  }, [data.expenses, year, month])

  const budgetHealth = useMemo(() => {
    let ok = 0
    let warning = 0
    let over = 0

    data.budgets.forEach(budget => {
      const pct = budget.limit > 0 ? (monthSpending[budget.cat] || 0) / budget.limit : 0
      if (pct >= 1) over++
      else if (pct >= 0.8) warning++
      else ok++
    })

    return { ok, warning, over, total: data.budgets.length }
  }, [data.budgets, monthSpending])

  const billWatch = useMemo(() => {
    return (data.bills || []).reduce((summary, bill) => {
      const status = getBillPeriodInfo(bill)?.status || ''
      return {
        overdue: summary.overdue + (status === 'overdue' ? 1 : 0),
        dueSoon: summary.dueSoon + (status === 'due' || status === 'soon' ? 1 : 0),
        unpaid: summary.unpaid + (status !== 'paid' ? 1 : 0),
      }
    }, { overdue: 0, dueSoon: 0, unpaid: 0 })
  }, [data.bills])

  const biggestBudgetGap = useMemo(() => {
    return data.budgets
      .map(budget => {
        const spent = monthSpending[budget.cat] || 0
        const limit = Number(budget.limit) || 0
        const over = Math.max(0, spent - limit)
        const pct = limit > 0 ? spent / limit : 0
        return { ...budget, spent, limit, over, pct }
      })
      .filter(budget => budget.over > 0)
      .sort((a, b) => b.over - a.over)[0] || null
  }, [data.budgets, monthSpending])

  const savingsTotal = data.goals.reduce((sum, goal) => sum + (goal.current || 0), 0)
  const savingsTarget = data.goals.reduce((sum, goal) => sum + (goal.target || 0), 0)
  const savingsPct = savingsTarget > 0 ? Math.min(100, Math.round((savingsTotal / savingsTarget) * 100)) : 0

  const goalHighlight = useMemo(() => {
    return data.goals
      .map(goal => {
        const current = Number(goal.current) || 0
        const target = Number(goal.target) || 0
        const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
        const remaining = Math.max(0, target - current)
        return { ...goal, pct, remaining }
      })
      .sort((a, b) => {
        if (b.pct !== a.pct) return b.pct - a.pct
        return a.remaining - b.remaining
      })[0] || null
  }, [data.goals])

  const creditCardAccounts = useMemo(() => {
    return (data.accounts || []).filter(acc => acc.type === 'Credit Card')
  }, [data.accounts])

  const creditCardStats = useMemo(() => {
    if (!creditCardAccounts.length) return null
    const totalCreditLimit = creditCardAccounts.reduce((sum, acc) => sum + (Number(acc.creditLimit) || 0), 0)
    const totalCreditOwed = Math.abs(creditCardAccounts.reduce((sum, acc) => sum + (getAccountSignedBalance(acc)), 0))
    const totalAvailableCredit = Math.max(0, totalCreditLimit - totalCreditOwed)
    const aggregateUtilization = totalCreditLimit > 0
      ? Math.min(100, Math.round((totalCreditOwed / totalCreditLimit) * 100))
      : 0
    return { totalCreditLimit, totalCreditOwed, totalAvailableCredit, aggregateUtilization }
  }, [creditCardAccounts])

  const projected = useMemo(() => getProjectedTransactions(data.income, data.expenses, year, month), [data.income, data.expenses, year, month])
  const projectedIncome = useMemo(() => projected.filter(t => t.type === 'income'), [projected])
  const projectedExpenses = useMemo(() => projected.filter(t => t.type === 'expense'), [projected])
  const balanceOverrides = useMemo(
    () => getBalanceOverrides(profile?.dailyBalanceOverrides || {}, profile?.monthStartBalances || {}),
    [profile?.dailyBalanceOverrides, profile?.monthStartBalances],
  )
  const eomBalance = useMemo(
    () => getMonthEndBalanceForView(data.accounts, data.income, data.expenses, projectedIncome, projectedExpenses, year, month, balanceOverrides),
    [data.accounts, data.income, data.expenses, projectedIncome, projectedExpenses, year, month, balanceOverrides],
  )

  const recent = useMemo(() => {
    const all = [
      ...data.income.map(t => ({ ...t, txType: 'income' })),
      ...data.expenses.map(t => ({ ...t, txType: 'expense' })),
    ]
      .filter(t => t.date)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))

    return all.slice(0, 5)
  }, [data.income, data.expenses])

  const monthIncomePaid = useMemo(
    () => getMonthTransactions(data.income, year, month).filter(isTransactionPaid).map(tx => ({ ...tx, type: 'income' })),
    [data.income, year, month],
  )
  const monthExpensePaid = useMemo(
    () => getMonthTransactions(data.expenses, year, month).filter(isTransactionPaid).map(tx => ({ ...tx, type: 'expense' })),
    [data.expenses, year, month],
  )

  const detailsConfig = useMemo(() => {
    const close = () => setDetailsMode('')
    if (!detailsMode) return { open: false, title: '', subtitle: '', sections: [], close }

    const groupByDate = list => {
      const map = {}
      list.forEach(tx => {
        const key = tx.date || 'No date'
        if (!map[key]) map[key] = []
        map[key].push(tx)
      })
      return Object.entries(map).sort((a, b) => String(b[0] || '').localeCompare(String(a[0] || '')))
    }

    const incomeList = monthIncomePaid
    const expenseList = monthExpensePaid

    if (detailsMode === 'income') {
      return {
        open: true,
        title: 'Income details',
        subtitle: 'Paid income entries contributing to this month total.',
        sections: [{ label: 'Income', list: groupByDate(incomeList) }],
        close,
      }
    }

    if (detailsMode === 'expenses') {
      return {
        open: true,
        title: 'Expense details',
        subtitle: 'Paid expense entries contributing to this month total.',
        sections: [{ label: 'Expenses', list: groupByDate(expenseList) }],
        close,
      }
    }

    return {
      open: true,
      title: 'Net breakdown',
      subtitle: 'Net is income minus expenses for this month total.',
      sections: [
        { label: 'Income', list: groupByDate(incomeList) },
        { label: 'Expenses', list: groupByDate(expenseList) },
      ],
      close,
    }
  }, [detailsMode, monthExpensePaid, monthIncomePaid])

  const money = value => displayValue(privacyMode, fmt(value, s), maskMoney(s))
  const accountCountLabel = portfolioIncludedValue
    ? `${data.accounts.length} account${data.accounts.length !== 1 ? 's' : ''} + included portfolio`
    : `${data.accounts.length} account${data.accounts.length !== 1 ? 's' : ''} right now`
  const activeGoalCount = data.goals.filter(goal => (Number(goal.target) || 0) > 0).length

  const actualIncome = useMemo(
    () => (data.income || []).filter(t => t?.date && isSameMonth(t.date, year, month)),
    [data.income, year, month],
  )

  const dashboardSignals = [
    {
      label: 'Accounts',
      value: pluralize(data.accounts.length, 'account'),
      meta: data.accounts.length
        ? `${money(netWorth)} across accounts${portfolioIncludedValue ? ' and included portfolio holdings' : ''}`
        : 'Add your first account to anchor the month',
      tone: 'var(--blue)',
    },
    {
      label: 'Bill watch',
      value: billWatch.overdue > 0
        ? `${pluralize(billWatch.overdue, 'overdue bill')}`
        : billWatch.dueSoon > 0
          ? `${pluralize(billWatch.dueSoon, 'bill due soon')}`
          : billWatch.unpaid > 0
            ? `${pluralize(billWatch.unpaid, 'open bill')}`
            : 'All clear',
      meta: billWatch.overdue > 0
        ? 'Protect overdue commitments first'
        : billWatch.dueSoon > 0
          ? 'Next due dates are approaching'
          : 'Nothing urgent is pressuring this month yet',
      tone: billWatch.overdue > 0 ? 'var(--red)' : billWatch.dueSoon > 0 ? 'var(--amber)' : 'var(--accent)',
    },
    {
      label: 'Savings',
      value: activeGoalCount > 0 ? pluralize(activeGoalCount, 'active goal') : 'No active goal',
      meta: activeGoalCount > 0
        ? `${displayValue(privacyMode, `${savingsPct}% funded overall`, 'Progress hidden')}`
        : 'Create one target to keep future plans visible',
      tone: activeGoalCount > 0 ? 'var(--accent)' : 'var(--blue)',
    },
  ]

  const monthStoryCards = [
    {
      label: 'Income rhythm',
      value: displayValue(privacyMode, `+${fmt(mIncome, s)}`, `+${maskMoney(s)}`),
      meta: actualIncome.length
        ? `${pluralize(actualIncome.length, 'income entry')} already recorded this month`
        : 'No income recorded in this month yet',
      tone: 'var(--accent)',
    },
    {
      label: 'Expense pressure',
      value: displayValue(privacyMode, `−${fmt(mExpense, s)}`, `−${maskMoney(s)}`),
      meta: expenseChange !== null
        ? `${expenseChange > 0 ? 'Up' : 'Down'} ${Math.abs(expenseChange)}% versus last month`
        : 'No prior month baseline to compare yet',
      tone: mExpense > mIncome ? 'var(--red)' : 'var(--amber)',
    },
    {
      label: 'Bills in the way',
      value: billWatch.overdue > 0
        ? pluralize(billWatch.overdue, 'overdue bill')
        : billWatch.dueSoon > 0
          ? pluralize(billWatch.dueSoon, 'bill due soon')
          : 'Nothing urgent',
      meta: billWatch.unpaid > 0
        ? `${pluralize(billWatch.unpaid, 'open bill')} still waiting for attention`
        : 'All tracked bills are clear right now',
      tone: billWatch.overdue > 0 ? 'var(--red)' : billWatch.dueSoon > 0 ? 'var(--amber)' : 'var(--blue)',
    },
    {
      label: 'Closest goal',
      value: goalHighlight ? goalHighlight.name : 'No active goal',
      meta: goalHighlight
        ? `${displayValue(privacyMode, `${goalHighlight.pct}% funded`, 'Progress hidden')} · ${money(goalHighlight.remaining)} left`
        : 'Start one savings target to give this month a future job',
      tone: goalHighlight ? 'var(--blue)' : 'var(--text3)',
    },
  ]

  const focusPills = [
    eomBalance >= 0 ? 'Month-end forecast positive' : null,
    mNet > 0 ? 'Net positive this month' : null,
    budgetHealth.total > 0 && budgetHealth.over === 0 ? 'Budgets holding' : null,
    goalHighlight?.pct >= 80 ? `${goalHighlight.name} ${goalHighlight.pct}% funded` : null,
  ].filter(Boolean)

  let focusState = {
    tone: 'var(--accent)',
    eyebrow: 'Next best move',
    title: 'Keep the month visible',
    body: 'One real update keeps the month useful. Takda is here to help you review what matters next, not to replace your judgment.',
  }

  if (biggestBudgetGap) {
    focusState = {
      tone: 'var(--red)',
      eyebrow: 'Budget rescue',
      title: `Tighten ${biggestBudgetGap.cat}`,
      body: `You are over by ${money(biggestBudgetGap.over)}. Closing that gap gives the rest of the month more room.`,
    }
  } else if (eomBalance < 0) {
    focusState = {
      tone: 'var(--amber)',
      eyebrow: 'Forecast risk',
      title: 'Protect month-end before it slips',
      body: `Takda estimates a ${money(Math.abs(eomBalance))} gap by month-end. Treat it as an early warning, not a final bank balance.`,
    }
  } else if (goalHighlight && goalHighlight.remaining > 0 && goalHighlight.pct >= 70) {
    focusState = {
      tone: 'var(--blue)',
      eyebrow: 'Finish a win',
      title: `Close out ${goalHighlight.name}`,
      body: `You are only ${money(goalHighlight.remaining)} away from finishing this goal. One contribution would close it out.`,
    }
  } else {
    focusState = {
      tone: 'var(--accent)',
      eyebrow: 'Momentum is healthy',
      title: 'This month is holding steady',
      body: 'Net, forecast, and routine all look steady. Keep logging real activity so the view stays reliable.',
    }
  }

  return (
    <div className={`${styles.page} ${dStyles.dashboardPage}`}>
      <div className={dStyles.introBoard}>
        <div className={dStyles.introCopy}>
          <div className={dStyles.introEyebrow}>Takda</div>
          <div className={dStyles.greetingText}>
            <span className={dStyles.greetingHi}>{greeting}, {name}</span>
            <span className={dStyles.greetingDate}>{now.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
          </div>
          <div className={dStyles.introSub}>
            Start with what needs money attention today. Takda keeps balances, bills, savings, and recent activity in one clear daily view.
          </div>
        </div>
        <div className={dStyles.introAside}>
          <div>
            <span className={dStyles.introAsideLabel}>Projected close</span>
            <strong className={dStyles.introAsideValue}>{money(eomBalance)}</strong>
            <small className={dStyles.introAsideMeta}>
              {eomBalance >= 0
                ? 'Projected month-end if your current pace holds.'
                : 'This month needs one careful money move to avoid a shortfall.'}
            </small>
          </div>
        </div>
      </div>

      <div className={dStyles.signalDeck}>
        {dashboardSignals.map(signal => (
          <div key={signal.label} className={dStyles.signalCard} style={{ '--signal-tone': signal.tone }}>
            <span className={dStyles.signalLabel}>{signal.label}</span>
            <strong className={dStyles.signalValue}>{signal.value}</strong>
            <small className={dStyles.signalMeta}>{signal.meta}</small>
          </div>
        ))}
      </div>

      <div className={dStyles.topBoard}>
        <div className={dStyles.heroCard}>
          <div className={dStyles.heroLabel}>Net position</div>
          <div className={dStyles.heroVal}>{money(netWorth)}</div>
          <div className={dStyles.heroSub}>{accountCountLabel}</div>
          <div className={dStyles.heroMetaGrid}>
            <div className={dStyles.heroMetaStat}>
              <span>Month net</span>
              <strong style={{ color: mNet >= 0 ? 'var(--accent)' : 'var(--red)' }}>
                {displayValue(privacyMode, `${mNet >= 0 ? '+' : ''}${fmt(mNet, s)}`, `${mNet >= 0 ? '+' : ''}${maskMoney(s)}`)}
              </strong>
            </div>
            <div className={dStyles.heroMetaStat}>
              <span>Month-end</span>
              <strong style={{ color: eomBalance >= 0 ? 'var(--blue)' : 'var(--red)' }}>
                {money(eomBalance)}
              </strong>
            </div>
          </div>
        </div>

        <div className={dStyles.focusCard} style={{ '--focus-tone': focusState.tone }}>
          <div className={dStyles.focusHeader}>
            <div>
              <div className={dStyles.focusEyebrow}>{focusState.eyebrow}</div>
              <div className={dStyles.focusTitle}>{focusState.title}</div>
            </div>
            <div className={dStyles.focusBadge}>Priority</div>
          </div>
          <div className={dStyles.focusBody}>{focusState.body}</div>
          <div className={dStyles.focusPillRow}>
            {(focusPills.length ? focusPills : ['Momentum follows consistency']).slice(0, 3).map(pill => (
              <span key={pill} className={dStyles.focusPill}>{pill}</span>
            ))}
          </div>
        </div>
      </div>

      <div className={dStyles.analyticsBoard}>
        <div className={dStyles.analyticsHeader}>
          <div>
            <div className={dStyles.analyticsEyebrow}>This month</div>
            <div className={dStyles.analyticsTitle}>Watch what changes your next money move</div>
          </div>
          <div className={dStyles.analyticsMeta}>Updated this month</div>
        </div>
        <div className={dStyles.statsRow}>
          <button type="button" className={`${dStyles.statBox} ${dStyles.statBoxButton}`} onClick={() => setDetailsMode('income')}>
            <div className={dStyles.statBoxLabel}>Income</div>
            <div className={dStyles.statBoxVal} style={{ color: 'var(--accent)' }}>
              {displayValue(privacyMode, `+${fmt(mIncome, s)}`, `+${maskMoney(s)}`)}
            </div>
          </button>
          <button type="button" className={`${dStyles.statBox} ${dStyles.statBoxButton}`} onClick={() => setDetailsMode('expenses')}>
            <div className={dStyles.statBoxLabel}>Expenses</div>
            <div className={dStyles.statBoxVal} style={{ color: 'var(--red)' }}>
              {displayValue(privacyMode, `−${fmt(mExpense, s)}`, `−${maskMoney(s)}`)}
            </div>
            {expenseChange !== null && (
              <div className={dStyles.statBoxChange} style={{ color: expenseChange > 0 ? 'var(--red)' : 'var(--accent)' }}>
                {expenseChange > 0 ? '↑' : '↓'} {Math.abs(expenseChange)}% vs last month
              </div>
            )}
          </button>
          <button type="button" className={`${dStyles.statBox} ${dStyles.statBoxButton}`} onClick={() => setDetailsMode('net')}>
            <div className={dStyles.statBoxLabel}>Net</div>
            <div className={dStyles.statBoxVal} style={{ color: mNet >= 0 ? 'var(--blue)' : 'var(--red)' }}>
              {displayValue(privacyMode, `${mNet >= 0 ? '+' : ''}${fmt(mNet, s)}`, `${mNet >= 0 ? '+' : ''}${maskMoney(s)}`)}
            </div>
          </button>
        </div>

        <div className={dStyles.missionGrid}>
          <div className={dStyles.missionCard} style={{ '--mission-tone': eomBalance >= 0 ? 'var(--accent)' : 'var(--red)' }}>
            <div className={dStyles.missionTop}>
              <div className={dStyles.missionTitle}>Month-end estimate</div>
              <div className={dStyles.missionStat}>{eomBalance >= 0 ? 'Stable' : 'Risk'}</div>
            </div>
            <div className={dStyles.miniVal} style={{ color: eomBalance >= 0 ? 'var(--accent)' : 'var(--red)' }}>
              {money(eomBalance)}
            </div>
            <div className={dStyles.missionBody}>
              {eomBalance >= 0 ? 'Projected surplus if current pace holds.' : 'Projected deficit if no new action changes the month.'}
            </div>
          </div>

          <div className={dStyles.missionCard} style={{ '--mission-tone': budgetHealth.over > 0 ? 'var(--red)' : budgetHealth.warning > 0 ? 'var(--amber)' : 'var(--accent)' }}>
            <div className={dStyles.missionTop}>
              <div className={dStyles.missionTitle}>Budget pressure</div>
              <div className={dStyles.missionStat}>{budgetHealth.total || 0} tracked</div>
            </div>
            {budgetHealth.total === 0 ? (
              <div className={dStyles.missionBody}>Set your first budget to start tracking category pressure and room left for the month.</div>
            ) : (
              <>
                <div className={dStyles.budgetDots}>
                  {budgetHealth.ok > 0 && <span className={dStyles.budgetDot} style={{ background: 'var(--accent)' }}>{budgetHealth.ok} ok</span>}
                  {budgetHealth.warning > 0 && <span className={dStyles.budgetDot} style={{ background: 'var(--amber)' }}>{budgetHealth.warning} near</span>}
                  {budgetHealth.over > 0 && <span className={dStyles.budgetDot} style={{ background: 'var(--red)' }}>{budgetHealth.over} over</span>}
                </div>
                <div className={dStyles.missionBody}>
                  {budgetHealth.over > 0
                    ? `${budgetHealth.over} budget${budgetHealth.over > 1 ? 's' : ''} exceeded`
                    : budgetHealth.warning > 0
                      ? 'Some budgets are nearing their limit.'
                      : 'All budgets are holding steady.'}
                </div>
              </>
            )}
          </div>

          {creditCardStats && (
            <div className={dStyles.missionCard} style={{ '--mission-tone': creditCardStats.aggregateUtilization > 80 ? 'var(--red)' : creditCardStats.aggregateUtilization > 30 ? 'var(--amber)' : 'var(--accent)' }}>
              <div className={dStyles.missionTop}>
                <div className={dStyles.missionTitle}>Credit utilization</div>
                <div className={dStyles.missionStat}>{creditCardAccounts.length} card{creditCardAccounts.length === 1 ? '' : 's'}</div>
              </div>
              {creditCardStats.totalCreditLimit > 0 ? (
                <>
                  <div className={dStyles.miniVal} style={{ color: creditCardStats.aggregateUtilization > 80 ? 'var(--red)' : creditCardStats.aggregateUtilization > 30 ? 'var(--amber)' : 'var(--accent)' }}>
                    {creditCardStats.aggregateUtilization}%
                  </div>
                  <div className={dStyles.goalSummaryTrack} style={{ marginBlock: '8px', height: '4px' }}>
                    <div
                      className={dStyles.goalSummaryFill}
                      style={{
                        width: `${creditCardStats.aggregateUtilization}%`,
                        background: creditCardStats.aggregateUtilization > 80 ? 'var(--red)' : creditCardStats.aggregateUtilization > 30 ? 'var(--amber)' : 'var(--accent)'
                      }}
                    />
                  </div>
                  <div className={dStyles.missionBody}>
                    {money(creditCardStats.totalAvailableCredit)} available credit remaining.
                  </div>
                </>
              ) : (
                <div className={dStyles.missionBody}>
                  Add credit limits in Accounts to track aggregate available credit and utilization gauges.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={dStyles.sectionGrid}>
        {data.goals.length > 0 && (
          <div className={`${dStyles.sectionCard} ${dStyles.sectionSpan}`}>
            <div className={dStyles.sectionHeader}>
              <span className={dStyles.sectionTitle}>Savings</span>
              <span className={dStyles.sectionMeta}>
                {displayValue(privacyMode, `${savingsPct}% funded`, 'Progress hidden')}
              </span>
            </div>
            <div className={dStyles.goalSummary}>
              <div className={dStyles.goalSummaryMeta}>
                <span>{displayValue(privacyMode, `${fmt(savingsTotal, s)} saved`, `${maskMoney(s)} saved`)}</span>
                <span>{displayValue(privacyMode, `${fmt(savingsTarget, s)} target`, `${maskMoney(s)} target`)}</span>
              </div>
              <div className={dStyles.goalSummaryTrack}>
                <div className={dStyles.goalSummaryFill} style={{ width: `${savingsPct}%` }} />
              </div>
            </div>
            {data.goals.slice(0, 3).map(goal => {
              const pct = Math.min(100, Math.round(((goal.current || 0) / (goal.target || 1)) * 100))
              return (
                <div key={goal._id} className={dStyles.goalRow}>
                  <div className={dStyles.goalRowMain}>
                    <div className={dStyles.goalRowName}>{goal.name}</div>
                    <div className={dStyles.goalRowTrack}>
                      <div className={dStyles.goalRowFill} style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--accent)' : 'var(--blue)' }} />
                    </div>
                  </div>
                  <div className={dStyles.goalRowPct}>
                    {displayValue(privacyMode, `${pct}%`, '•••')}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className={`${dStyles.sectionCard} ${data.goals.length > 0 ? dStyles.sectionSpanWide : dStyles.sectionSpanFull}`}>
          <div className={dStyles.sectionHeader}>
            <span className={dStyles.sectionTitle}>Recent transactions</span>
            <span className={dStyles.sectionMeta}>{recent.length ? `${recent.length} recent` : 'Live feed'}</span>
          </div>
          {!recent.length ? (
            <div className={dStyles.sectionEmpty}>No entries yet. Add your first one to bring this month into view.</div>
          ) : recent.map((tx, index) => (
            <div
              key={tx._id + index}
              className={dStyles.txRow}
              style={{ borderBottom: index < recent.length - 1 ? '1px solid color-mix(in srgb, var(--border) 66%, transparent)' : 'none' }}
            >
              <div className={dStyles.txIcon} style={{ background: TYPE_BG[tx.txType], color: TYPE_COLOR[tx.txType] }}>
                <DashboardIcon type={getTransactionIconKey(tx)} />
              </div>
              <div className={dStyles.txContent}>
                <div className={dStyles.txDesc}>{tx.desc}</div>
                <div className={dStyles.txMeta}>{[tx.cat, tx.subcat].filter(Boolean).join(' · ')} · {tx.date}</div>
              </div>
              <div className={dStyles.txAmount} style={{ color: TYPE_COLOR[tx.txType] }}>
                {displayValue(privacyMode, `${TYPE_SIGN[tx.txType]}${fmt(tx.amount, s)}`, `${TYPE_SIGN[tx.txType]}${maskMoney(s)}`)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <DetailsModal
        open={detailsConfig.open}
        title={detailsConfig.title}
        subtitle={detailsConfig.subtitle}
        onClose={detailsConfig.close}
      >
        {detailsConfig.sections.map(section => (
          <div key={section.label} className={dStyles.detailsSection}>
            <div className={dStyles.detailsSectionTitle}>{section.label}</div>
            {!section.list.length ? (
              <div className={dStyles.detailsEmpty}>Nothing to show yet.</div>
            ) : (
              <div className={dStyles.detailsList}>
                {section.list.map(([day, list]) => (
                  <div key={day} className={dStyles.detailsDay}>
                    <div className={dStyles.detailsDayLabel}>{day}</div>
                    {list.map((tx, index) => {
                      const isIncome = tx.type === 'income'
                      const sign = isIncome ? '+' : '−'
                      const tone = isIncome ? 'var(--accent)' : 'var(--red)'
                      return (
                        <div key={(tx._id || tx.id || 'tx') + index} className={dStyles.detailsRow}>
                          <div className={dStyles.detailsRowMain}>
                            <div className={dStyles.detailsRowDesc}>{tx.desc || tx.cat || 'Untitled'}</div>
                            <div className={dStyles.detailsRowMeta}>
                              <span>{[tx.cat, tx.subcat].filter(Boolean).join(' · ') || 'Other'}</span>
                            </div>
                          </div>
                          <div className={dStyles.detailsRowAmount} style={{ color: tone }}>
                            {displayValue(privacyMode, `${sign}${fmt(tx.amount || 0, s)}`, `${sign}${maskMoney(s)}`)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </DetailsModal>
    </div>
  )
}
