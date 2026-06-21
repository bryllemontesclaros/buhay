import { useMemo, useState } from 'react'
import { getMonthTotal, getMonthTransactions, isTransactionPaid } from '../lib/finance'
import { getProjectedTransactions } from '../lib/recurrence'
import { displayValue, fmt, isSameMonth, maskMoney, playTick } from '../lib/utils'
import { getBillPeriodInfo } from '../lib/bills'
import DetailsModal from '../components/DetailsModal'
import styles from './Page.module.css'
import bStyles from './Breakdown.module.css'

function FinancialHealthPulse({ data, incomeTotal, expenseTotal, viewYear, viewMonth, symbol, privacyMode }) {
  const s = symbol || '₱'
  const money = value => displayValue(privacyMode, fmt(value, s), maskMoney(s))
  
  const budgets = data.budgets || []
  const monthNet = incomeTotal - expenseTotal
  
  const savingsRate = useMemo(() => {
    if (incomeTotal <= 0) return expenseTotal > 0 ? -1 : 0
    return monthNet / incomeTotal
  }, [incomeTotal, monthNet, expenseTotal])

  const spending = useMemo(() => {
    const map = {}
    data.expenses.filter(tx => isTransactionPaid(tx) && isSameMonth(tx.date, viewYear, viewMonth)).forEach(tx => {
      map[tx.cat] = (map[tx.cat] || 0) + (tx.amount || 0)
    })
    return map
  }, [data.expenses, viewMonth, viewYear])

  const { exceededBudgetsCount, warningBudgetsCount } = useMemo(() => {
    let exceeded = 0
    let warning = 0
    budgets.forEach(b => {
      const spent = spending[b.cat] || 0
      const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0
      if (pct > 100) exceeded++
      else if (pct >= 80) warning++
    })
    return { exceededBudgetsCount: exceeded, warningBudgetsCount: warning }
  }, [budgets, spending])

  const unpaidBillsTotal = useMemo(() => {
    const list = (data.bills || []).map(bill => ({
      ...bill,
      period: getBillPeriodInfo(bill),
    }))
    return list
      .filter(bill => !bill.period?.paid && (bill.period?.status === 'overdue' || bill.period?.status === 'due' || bill.period?.status === 'soon'))
      .reduce((sum, bill) => sum + (Number(bill.amount) || 0), 0)
  }, [data.bills])

  const liquidTotal = useMemo(() => {
    return (data.accounts || [])
      .filter(account => ['Cash', 'Bank', 'E-wallet'].includes(account.type))
      .reduce((sum, account) => sum + (Number(account.balance) || 0), 0)
  }, [data.accounts])

  const healthStatus = useMemo(() => {
    if (savingsRate < 0.05 || (unpaidBillsTotal > 0 && liquidTotal < unpaidBillsTotal) || exceededBudgetsCount >= 3) {
      return 'strained'
    }
    if (savingsRate < 0.2 || exceededBudgetsCount > 0 || warningBudgetsCount > 0 || unpaidBillsTotal > 0) {
      return 'caution'
    }
    return 'healthy'
  }, [savingsRate, unpaidBillsTotal, liquidTotal, exceededBudgetsCount, warningBudgetsCount])

  const coachingAdvice = useMemo(() => {
    if (savingsRate < 0) {
      return `Strained: Your monthly expenses exceed income by ${money(Math.abs(monthNet))}. Review discretionary budgets to stop the deficit.`
    }
    if (unpaidBillsTotal > 0 && liquidTotal < unpaidBillsTotal) {
      return `Caution: Liquid cash (${money(liquidTotal)}) is less than near-term unpaid bills (${money(unpaidBillsTotal)}). Conserve cash to cover commitments.`
    }
    if (exceededBudgetsCount > 0) {
      const topExceededCat = budgets
        .map(b => ({ cat: b.cat, excess: (spending[b.cat] || 0) - b.limit }))
        .sort((a, b) => b.excess - a.excess)[0]
      return `Caution: You are over budget on ${topExceededCat.cat} by ${money(topExceededCat.excess)}. Adjust other category limits to balance spending.`
    }
    if (savingsRate < 0.2) {
      return `Caution: Your savings rate is at ${(savingsRate * 100).toFixed(0)}% (target: 20%). Consider trimming minor subscriptions or eating out.`
    }
    if (savingsRate >= 0.2) {
      return `Healthy: Great job! You saved ${(savingsRate * 100).toFixed(0)}% of your income this month and all budgets are inside guide rails.`
    }
    return 'Your financial pulse is stable. Keep tracking transactions to see trends.'
  }, [savingsRate, monthNet, unpaidBillsTotal, liquidTotal, exceededBudgetsCount, budgets, spending, money])

  const statusLabel = {
    healthy: 'Healthy',
    caution: 'Caution',
    strained: 'Strained',
  }[healthStatus]

  const statusColorClass = {
    healthy: bStyles.pulseColorHealthy,
    caution: bStyles.pulseColorCaution,
    strained: bStyles.pulseColorStrained,
  }[healthStatus]

  return (
    <section className={`${bStyles.pulseCard} ${statusColorClass}`} aria-label="Financial health evaluator">
      <div className={bStyles.pulseVisual}>
        <svg width="40" height="40" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="16" className={bStyles.pulseCircleBg} />
          <circle cx="20" cy="20" r="16" className={bStyles.pulseCirclePulse} />
          <circle cx="20" cy="20" r="8" className={bStyles.pulseCircleCenter} />
        </svg>
      </div>
      <div className={bStyles.pulseContent}>
        <div className={bStyles.pulseHeader}>
          <span className={bStyles.pulseTitle}>Financial Pulse</span>
          <span className={bStyles.pulseBadge}>{statusLabel}</span>
        </div>
        <p className={bStyles.pulseAdvice}>{coachingAdvice}</p>
      </div>
    </section>
  )
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const CAT_COLORS = {
  'Food & Dining': '#ff7043',
  'Transport': '#42a5f5',
  'Shopping': '#ab47bc',
  'Health': '#ef5350',
  'Entertainment': '#ff7043',
  'Personal Care': '#ec407a',
  'Education': '#26c6da',
  Bills: '#ffb347',
  Other: '#9090b0',
  Salary: '#22d87a',
  Freelance: '#6eb5ff',
  Business: '#b48eff',
  Investment: '#2dd4bf',
  '13th Month': '#22d87a',
  Bonus: '#22d87a',
}

function getCatColor(cat) {
  return CAT_COLORS[cat] || '#9090b0'
}

function PieChart({ data, size = 180, symbol = '₱', privacyMode = false }) {
  const [hoveredIndex, setHoveredIndex] = useState(null)
  if (!data.length) return <div className={bStyles.noData}>No data yet</div>
  const total = data.reduce((sum, item) => sum + item.value, 0)
  if (total === 0) return <div className={bStyles.noData}>No data yet</div>

  const cx = size / 2
  const cy = size / 2
  const radius = size / 2 - 10
  const innerRadius = radius * 0.58
  const fullSweep = 2 * Math.PI
  const fullSliceThreshold = fullSweep - 0.0001
  let angle = -Math.PI / 2

  const slices = data.map((item, idx) => {
    const sweep = (item.value / total) * fullSweep
    const startAngle = angle
    const middleAngle = startAngle + sweep / 2
    
    const x1 = cx + radius * Math.cos(startAngle)
    const y1 = cy + radius * Math.sin(startAngle)
    angle += sweep
    const x2 = cx + radius * Math.cos(angle)
    const y2 = cy + radius * Math.sin(angle)
    
    const large = sweep > Math.PI ? 1 : 0
    const isFullSlice = sweep >= fullSliceThreshold

    // Calculate displacement translate vector if hovered
    const offset = hoveredIndex === idx ? 6 : 0
    const dx = offset * Math.cos(middleAngle)
    const dy = offset * Math.sin(middleAngle)

    return {
      ...item,
      isFullSlice,
      dx,
      dy,
      path: isFullSlice ? '' : `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`,
      pct: total > 0 ? Math.round((item.value / total) * 100) : 0
    }
  })

  const activeSlice = hoveredIndex !== null ? slices[hoveredIndex] : null

  return (
    <div style={{ width: size, height: size, flexShrink: 0, position: 'relative' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', overflow: 'visible' }}>
        <g>
          {slices.map((slice, index) => {
            const pathStyle = {
              transform: `translate(${slice.dx}px, ${slice.dy}px) scale(${hoveredIndex === index ? 1.05 : 1})`,
              transformOrigin: 'center',
              transition: 'transform var(--motion-duration) var(--ease-fluid), opacity var(--motion-duration)',
              cursor: 'pointer',
            }

            return slice.isFullSlice ? (
              <circle
                key={index}
                cx={cx}
                cy={cy}
                r={radius}
                fill={slice.color}
                opacity={hoveredIndex === null || hoveredIndex === index ? 1 : 0.72}
                onMouseEnter={() => {
                  playTick()
                  setHoveredIndex(index)
                }}
                onMouseLeave={() => setHoveredIndex(null)}
                style={pathStyle}
              />
            ) : (
              <path
                key={index}
                d={slice.path}
                fill={slice.color}
                opacity={hoveredIndex === null || hoveredIndex === index ? 1 : 0.72}
                onMouseEnter={() => {
                  playTick()
                  setHoveredIndex(index)
                }}
                onMouseLeave={() => setHoveredIndex(null)}
                stroke="var(--bg)"
                strokeWidth="1.5"
                style={pathStyle}
              />
            )
          })}
        </g>
        
        {/* Central Donut Hole */}
        <circle cx={cx} cy={cy} r={innerRadius} fill="var(--surface)" stroke="var(--border)" strokeWidth="1" />
        
        {/* Hover Center Text Information */}
        {activeSlice ? (
          <g style={{ pointerEvents: 'none' }}>
            <text
              x={cx}
              y={cy - 12}
              textAnchor="middle"
              fill="var(--text3)"
              fontSize="10"
              fontWeight="700"
              letterSpacing="0.5"
              textTransform="uppercase"
            >
              {activeSlice.cat.length > 10 ? `${activeSlice.cat.slice(0, 8)}..` : activeSlice.cat}
            </text>
            <text
              x={cx}
              y={cy + 6}
              textAnchor="middle"
              fill="var(--text)"
              fontSize="13"
              fontWeight="800"
              fontFamily="var(--font-mono)"
            >
              {privacyMode ? '•••' : fmt(activeSlice.value, symbol)}
            </text>
            <text
              x={cx}
              y={cy + 20}
              textAnchor="middle"
              fill={activeSlice.color}
              fontSize="10"
              fontWeight="800"
            >
              {privacyMode ? '••%' : `${activeSlice.pct}%`}
            </text>
          </g>
        ) : (
          <g style={{ pointerEvents: 'none' }}>
            <text
              x={cx}
              y={cy - 4}
              textAnchor="middle"
              fill="var(--text3)"
              fontSize="10"
              fontWeight="700"
            >
              TOTAL
            </text>
            <text
              x={cx}
              y={cy + 10}
              textAnchor="middle"
              fill="var(--text)"
              fontSize="13"
              fontWeight="800"
              fontFamily="var(--font-mono)"
            >
              {privacyMode ? '•••••' : fmt(total, symbol)}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}

function formatCompactCellBalance(value) {
  const numericValue = Number(value) || 0
  const absoluteValue = Math.abs(numericValue)
  const sign = numericValue < 0 ? '−' : ''

  if (absoluteValue >= 1_000_000) {
    return `${sign}${(absoluteValue / 1_000_000).toFixed(absoluteValue >= 10_000_000 ? 0 : 1)}M`
  }
  if (absoluteValue >= 1_000) {
    return `${sign}${Math.round(absoluteValue / 1_000)}k`
  }
  return `${sign}${Math.round(absoluteValue)}`
}

function BarChart({ months, income, expenses, symbol, privacyMode }) {
  const [hoveredBar, setHoveredBar] = useState(null)
  const maxVal = Math.max(...income, ...expenses, 1000)
  
  const width = 480
  const height = 160
  const paddingLeft = 45
  const paddingRight = 10
  const paddingTop = 20
  const paddingBottom = 25
  
  const chartW = width - paddingLeft - paddingRight
  const chartH = height - paddingTop - paddingBottom
  
  const yTicksCount = 4
  const yTicks = Array.from({ length: yTicksCount }, (_, i) => (maxVal / (yTicksCount - 1)) * i)

  return (
    <div className={bStyles.barChartWrapper}>
      <svg viewBox={`0 0 ${width} ${height}`} className={bStyles.barChartSvg} width="100%" height="100%">
        <defs>
          <linearGradient id="barIncGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-dim)" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="barExpGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--red)" />
            <stop offset="100%" stopColor="var(--red-dim)" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {yTicks.map((tick, i) => {
          const y = height - paddingBottom - (tick / maxVal) * chartH
          return (
            <g key={i} opacity="0.6">
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="var(--border)"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={paddingLeft - 8}
                y={y + 3}
                textAnchor="end"
                fill="var(--text3)"
                fontSize="9"
                fontFamily="var(--font-mono)"
              >
                {privacyMode ? '•••' : formatCompactCellBalance(tick)}
              </text>
            </g>
          )
        })}

        {months.map((month, index) => {
          const incVal = income[index] || 0
          const expVal = expenses[index] || 0
          
          const groupW = chartW / months.length
          const barW = Math.max(6, groupW * 0.32)
          const gap = groupW * 0.08
          
          const xGroupStart = paddingLeft + index * groupW
          const xInc = xGroupStart + (groupW - 2 * barW - gap) / 2
          const xExp = xInc + barW + gap
          
          const hInc = (incVal / maxVal) * chartH
          const hExp = (expVal / maxVal) * chartH
          
          const yInc = height - paddingBottom - hInc
          const yExp = height - paddingBottom - hExp

          return (
            <g key={index}>
              <rect
                x={xInc}
                y={yInc}
                width={barW}
                height={hInc}
                fill="url(#barIncGrad)"
                rx="3"
                opacity={hoveredBar && (hoveredBar.index !== index || hoveredBar.type !== 'income') ? 0.6 : 1}
                style={{ transition: 'y 0.6s ease, height 0.6s ease, opacity 0.2s ease', cursor: 'pointer' }}
                onMouseEnter={() => {
                  playTick()
                  setHoveredBar({ index, type: 'income', val: incVal, x: xInc + barW / 2, y: yInc })
                }}
                onMouseLeave={() => setHoveredBar(null)}
              />
              
              <rect
                x={xExp}
                y={yExp}
                width={barW}
                height={hExp}
                fill="url(#barExpGrad)"
                rx="3"
                opacity={hoveredBar && (hoveredBar.index !== index || hoveredBar.type !== 'expense') ? 0.6 : 1}
                style={{ transition: 'y 0.6s ease, height 0.6s ease, opacity 0.2s ease', cursor: 'pointer' }}
                onMouseEnter={() => {
                  playTick()
                  setHoveredBar({ index, type: 'expense', val: expVal, x: xExp + barW / 2, y: yExp })
                }}
                onMouseLeave={() => setHoveredBar(null)}
              />

              <text
                x={xGroupStart + groupW / 2}
                y={height - 8}
                textAnchor="middle"
                fill="var(--text2)"
                fontSize="10"
                fontWeight="600"
              >
                {month}
              </text>
            </g>
          )
        })}

        <line
          x1={paddingLeft}
          y1={height - paddingBottom}
          x2={width - paddingRight}
          y2={height - paddingBottom}
          stroke="var(--border2)"
          strokeWidth="1.5"
        />

        {hoveredBar && (
          <g style={{ pointerEvents: 'none' }}>
            <rect
              x={Math.max(10, Math.min(width - 110, hoveredBar.x - 50))}
              y={Math.max(5, hoveredBar.y - 32)}
              width="100"
              height="24"
              rx="6"
              fill="var(--surface-solid-2)"
              stroke="var(--border2)"
              strokeWidth="1"
            />
            <text
              x={Math.max(60, Math.min(width - 60, hoveredBar.x))}
              y={Math.max(20, hoveredBar.y - 17)}
              textAnchor="middle"
              fill={hoveredBar.type === 'income' ? 'var(--accent)' : 'var(--red)'}
              fontSize="9"
              fontWeight="850"
              fontFamily="var(--font-mono)"
            >
              {privacyMode ? 'Hidden' : fmt(hoveredBar.val, symbol)}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}

function Sparkline({ data, width = 220, height = 36, strokeColor = 'var(--blue)', symbol = '₱', privacyMode = false }) {
  if (!data || data.length < 2) return null

  const values = data.map(d => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = data.map((d, index) => {
    const x = (index / (data.length - 1)) * width
    const y = height - ((d.value - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  const fillPoints = `${width},${height} 0,${height} ${points}`

  return (
    <div style={{ position: 'relative', width, height }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={fillPoints} fill="url(#sparklineGrad)" />
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        <circle cx="0" cy={height - ((values[0] - min) / range) * height} r="3.5" fill="var(--bg)" stroke={strokeColor} strokeWidth="1.5" />
        <circle cx={width} cy={height - ((values[values.length - 1] - min) / range) * height} r="4" fill={strokeColor} />
      </svg>
    </div>
  )
}

export default function Breakdown({ data, profile = {}, symbol, privacyMode = false }) {
  const s = symbol || '₱'
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [tab, setTab] = useState('expenses')
  const [detailsMode, setDetailsMode] = useState('')

  const projected = useMemo(
    () => getProjectedTransactions(data.income, data.expenses, viewYear, viewMonth),
    [data.income, data.expenses, viewYear, viewMonth],
  )
  const projectedIncome = useMemo(
    () => projected.filter(tx => tx.type === 'income'),
    [projected],
  )
  const projectedExpenses = useMemo(
    () => projected.filter(tx => tx.type === 'expense'),
    [projected],
  )
  const monthIncome = useMemo(
    () => [...getMonthTransactions(data.income, viewYear, viewMonth).filter(isTransactionPaid), ...projectedIncome],
    [data.income, projectedIncome, viewYear, viewMonth],
  )
  const monthExpenses = useMemo(
    () => [...getMonthTransactions(data.expenses, viewYear, viewMonth).filter(isTransactionPaid), ...projectedExpenses],
    [data.expenses, projectedExpenses, viewYear, viewMonth],
  )

  const expenseCats = useMemo(() => {
    const map = {}
    monthExpenses.forEach(tx => {
      map[tx.cat] = (map[tx.cat] || 0) + (tx.amount || 0)
    })

    return Object.entries(map)
      .map(([cat, value]) => ({ cat, value, color: getCatColor(cat) }))
      .sort((a, b) => b.value - a.value)
  }, [monthExpenses])

  const incomeCats = useMemo(() => {
    const map = {}
    monthIncome.forEach(tx => {
      map[tx.cat] = (map[tx.cat] || 0) + (tx.amount || 0)
    })

    return Object.entries(map)
      .map(([cat, value]) => ({ cat, value, color: getCatColor(cat) }))
      .sort((a, b) => b.value - a.value)
  }, [monthIncome])

  const cats = tab === 'expenses' ? expenseCats : incomeCats
  const total = cats.reduce((sum, item) => sum + item.value, 0)
  const incomeTotal = incomeCats.reduce((sum, item) => sum + item.value, 0)
  const expenseTotal = expenseCats.reduce((sum, item) => sum + item.value, 0)
  const monthNet = incomeTotal - expenseTotal
  const flowTotal = incomeTotal + expenseTotal
  const expenseShare = flowTotal > 0 ? Math.max(8, Math.min(100, Math.round((expenseTotal / flowTotal) * 100))) : 0

  const last6 = useMemo(() => {
    return Array.from({ length: 6 }, (_, index) => {
      let month = viewMonth - 5 + index
      let year = viewYear

      while (month < 0) {
        month += 12
        year--
      }
      while (month > 11) {
        month -= 12
        year++
      }

      const projectedMonth = getProjectedTransactions(data.income, data.expenses, year, month)
      const income = getMonthTotal(data.income, year, month)
        + projectedMonth
          .filter(tx => tx.type === 'income')
          .reduce((sum, tx) => sum + (tx.amount || 0), 0)
      const expenses = getMonthTotal(data.expenses, year, month)
        + projectedMonth
          .filter(tx => tx.type === 'expense')
          .reduce((sum, tx) => sum + (tx.amount || 0), 0)
      return { label: MONTHS[month], income, expenses, net: income - expenses }
    })
  }, [data.expenses, data.income, viewMonth, viewYear])

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(year => year - 1)
    } else {
      setViewMonth(month => month - 1)
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(year => year + 1)
    } else {
      setViewMonth(month => month + 1)
    }
  }

  const monthLabel = new Date(viewYear, viewMonth).toLocaleString('default', { month: 'long', year: 'numeric' })
  const money = value => displayValue(privacyMode, fmt(value, s), maskMoney(s))

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

    const incomeList = monthIncome
    const expenseList = monthExpenses

    if (detailsMode === 'income') {
      return {
        open: true,
        title: 'Income details',
        subtitle: `${monthLabel}. Paid income plus any remaining projected recurring income cycles in this month view.`,
        sections: [{ label: 'Income', list: groupByDate(incomeList) }],
        close,
      }
    }

    if (detailsMode === 'expenses') {
      return {
        open: true,
        title: 'Expense details',
        subtitle: `${monthLabel}. Paid expenses plus any remaining projected recurring expense cycles in this month view.`,
        sections: [{ label: 'Expenses', list: groupByDate(expenseList) }],
        close,
      }
    }

    return {
      open: true,
      title: 'Net breakdown',
      subtitle: `${monthLabel}. Net is income minus expenses for this month view.`,
      sections: [
        { label: 'Income', list: groupByDate(incomeList) },
        { label: 'Expenses', list: groupByDate(expenseList) },
      ],
      close,
    }
  }, [detailsMode, monthExpenses, monthIncome, monthLabel])

  return (
    <div className={`${styles.page} ${bStyles.breakdownPage}`}>
      <FinancialHealthPulse
        data={data}
        incomeTotal={incomeTotal}
        expenseTotal={expenseTotal}
        viewYear={viewYear}
        viewMonth={viewMonth}
        symbol={s}
        privacyMode={privacyMode}
      />
      <div className={bStyles.heroSection}>
        <div className={bStyles.heroCopy}>
          <div className={bStyles.pageEyebrow}>Breakdown</div>
          <div className={bStyles.pageTitle}>Read the pattern, then decide.</div>
          <div className={bStyles.pageSub}>
            Compare category mix, monthly flow, and recent trends as signals to review, not automatic advice.
          </div>
        </div>

        <div className={bStyles.heroAside}>
          <div className={bStyles.heroAsideLabel}>6-Month Net Savings Trend</div>
          <div className={bStyles.sparklineBox}>
            <Sparkline
              data={last6.map(m => ({ value: m.net }))}
              width={220}
              height={36}
              strokeColor={monthNet >= 0 ? 'var(--accent)' : 'var(--red)'}
              symbol={s}
              privacyMode={privacyMode}
            />
          </div>
          <div className={bStyles.heroAsideMeta}>
            {monthNet >= 0 
              ? `Surplus trend is stable · ${money(monthNet)} net`
              : `Expense pressure warning · ${money(monthNet)} net`}
          </div>
        </div>
      </div>

      <div className={bStyles.summaryGrid}>
        <button type="button" className={`${bStyles.summaryCard} ${bStyles.summaryCardButton}`} onClick={() => setDetailsMode('income')}>
          <div className={bStyles.summaryLabel}>Income</div>
          <div className={`${bStyles.summaryValue} ${bStyles.summaryValueAccent}`}>{money(incomeTotal)}</div>
          <div className={bStyles.summaryMeta}>This month across all income sources</div>
        </button>
        <button type="button" className={`${bStyles.summaryCard} ${bStyles.summaryCardButton}`} onClick={() => setDetailsMode('expenses')}>
          <div className={bStyles.summaryLabel}>Expenses</div>
          <div className={`${bStyles.summaryValue} ${bStyles.summaryValueRed}`}>{money(expenseTotal)}</div>
          <div className={bStyles.summaryMeta}>This month across all expense categories</div>
        </button>
        <button type="button" className={`${bStyles.summaryCard} ${bStyles.summaryCardButton}`} onClick={() => setDetailsMode('net')}>
          <div className={bStyles.summaryLabel}>Net</div>
          <div className={`${bStyles.summaryValue} ${monthNet >= 0 ? bStyles.summaryValueBlue : bStyles.summaryValueRed}`}>{money(monthNet)}</div>
          <div className={bStyles.summaryMeta}>{monthNet >= 0 ? 'Net positive so far' : 'Net negative so far'}</div>
        </button>
      </div>

      <div className={bStyles.toolbar}>
        <div className={bStyles.monthNav}>
          <button type="button" className={bStyles.navBtn} onClick={prevMonth}>←</button>
          <div className={bStyles.monthLabel}>{monthLabel}</div>
          <button type="button" className={bStyles.navBtn} onClick={nextMonth}>→</button>
        </div>

        <div className={bStyles.tabRow}>
          <button type="button" className={`${bStyles.tabBtn} ${tab === 'expenses' ? bStyles.tabBtnActive : ''}`} onClick={() => setTab('expenses')}>Expenses</button>
          <button type="button" className={`${bStyles.tabBtn} ${tab === 'income' ? bStyles.tabBtnActive : ''}`} onClick={() => setTab('income')}>Income</button>
        </div>
      </div>

      <div className={bStyles.surfaceCard}>
        <div className={bStyles.sectionHeader}>
          <div className={bStyles.sectionTitle}>{tab === 'expenses' ? 'Spending mix' : 'Income mix'}</div>
          <span className={bStyles.sectionMeta} style={{ color: tab === 'expenses' ? 'var(--red)' : 'var(--accent)' }}>
            {displayValue(privacyMode, `${tab === 'expenses' ? '−' : '+'}${fmt(total, s)}`, `${tab === 'expenses' ? '−' : '+'}${maskMoney(s)}`)}
          </span>
        </div>
        {!cats.length ? (
          <div className={bStyles.emptyState}>No {tab} data yet for this month.</div>
        ) : (
          <div className={bStyles.pieSection}>
            <PieChart data={cats} size={180} symbol={s} privacyMode={privacyMode} />
            <div className={bStyles.legend}>
              {cats.map((cat, index) => (
                <div key={index} className={bStyles.legendItem}>
                  <div className={bStyles.legendDot} style={{ background: cat.color }} />
                  <div className={bStyles.legendCat}>{cat.cat}</div>
                  <div className={bStyles.legendVal} style={{ color: cat.color }}>{money(cat.value)}</div>
                  <div className={bStyles.legendPct}>{displayValue(privacyMode, `${total ? Math.round((cat.value / total) * 100) : 0}%`, '•••')}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={bStyles.surfaceCard}>
        <div className={bStyles.sectionHeader}>
          <div className={bStyles.sectionTitle}>Last 6 months</div>
          <div className={bStyles.legendInline}>
            <span className={bStyles.legendInlineItem}><span className={`${bStyles.legendInlineMark} ${bStyles.legendInlineIncome}`} />Income</span>
            <span className={bStyles.legendInlineItem}><span className={`${bStyles.legendInlineMark} ${bStyles.legendInlineExpense}`} />Expenses</span>
          </div>
        </div>
        <BarChart
          months={last6.map(month => month.label)}
          income={last6.map(month => month.income)}
          expenses={last6.map(month => month.expenses)}
          symbol={s}
          privacyMode={privacyMode}
        />
        <div className={bStyles.monthSummary}>
          {last6.map((month, index) => (
            <div key={index} className={bStyles.monthSummaryItem}>
              <div className={bStyles.monthSummaryLabel}>{month.label}</div>
              <div className={bStyles.monthSummaryNet} style={{ color: month.net >= 0 ? 'var(--accent)' : 'var(--red)' }}>
                {displayValue(privacyMode, `${month.net >= 0 ? '+' : ''}${fmt(month.net, s)}`, `${month.net >= 0 ? '+' : ''}${maskMoney(s)}`)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {expenseCats.length > 0 && (
        <div className={bStyles.surfaceCard}>
          <div className={bStyles.sectionHeader}>
            <div className={bStyles.sectionTitle}>Top spending categories</div>
          </div>
          {expenseCats.slice(0, 5).map((cat, index) => {
            const pct = expenseTotal ? Math.round((cat.value / expenseTotal) * 100) : 0
            return (
              <div key={index} className={bStyles.rankItem}>
                <div className={bStyles.rankRow}>
                  <div className={bStyles.rankLabelWrap}>
                    <div className={bStyles.rankDot} style={{ background: cat.color }} />
                    <span className={bStyles.rankLabel}>{cat.cat}</span>
                  </div>
                  <div className={bStyles.rankValueWrap}>
                    <span className={bStyles.rankPct}>{displayValue(privacyMode, `${pct}%`, '•••')}</span>
                    <span className={bStyles.rankValue}>{money(cat.value)}</span>
                  </div>
                </div>
                <div className={bStyles.rankTrack}>
                  <div className={bStyles.rankFill} style={{ width: `${pct}%`, background: cat.color }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <DetailsModal
        open={detailsConfig.open}
        title={detailsConfig.title}
        subtitle={detailsConfig.subtitle}
        onClose={detailsConfig.close}
      >
        {detailsConfig.sections.map(section => (
          <div key={section.label} className={bStyles.detailsSection}>
            <div className={bStyles.detailsSectionTitle}>{section.label}</div>
            {!section.list.length ? (
              <div className={bStyles.detailsEmpty}>Nothing to show yet.</div>
            ) : (
              <div className={bStyles.detailsList}>
                {section.list.map(([day, list]) => (
                  <div key={day} className={bStyles.detailsDay}>
                    <div className={bStyles.detailsDayLabel}>{day}</div>
                    {list.map((tx, index) => {
                      const isIncome = tx.type === 'income'
                      const sign = isIncome ? '+' : '−'
                      const tone = isIncome ? 'var(--accent)' : 'var(--red)'
                      const projectedBadge = tx._projected || tx.isProjected || tx.projected ? 'Projected cycle' : ''
                      return (
                        <div key={(tx._id || tx.id || 'tx') + index} className={bStyles.detailsRow}>
                          <div className={bStyles.detailsRowMain}>
                            <div className={bStyles.detailsRowDesc}>{tx.desc || tx.cat || 'Untitled'}</div>
                            <div className={bStyles.detailsRowMeta}>
                              <span>{[tx.cat, tx.subcat].filter(Boolean).join(' · ') || 'Other'}</span>
                              {projectedBadge ? <span className={bStyles.detailsBadge}>· {projectedBadge}</span> : null}
                            </div>
                          </div>
                          <div className={bStyles.detailsRowAmount} style={{ color: tone }}>
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
