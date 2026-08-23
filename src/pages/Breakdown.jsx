import { useMemo, useState } from 'react'
import { getMonthTotal, getMonthTransactions, isTransactionPaid } from '../lib/finance'
import { getProjectedTransactions } from '../lib/recurrence'
import { displayValue, fmt, maskMoney, playTick } from '../lib/utils'
import DetailsModal from '../components/DetailsModal'
import styles from './Page.module.css'
import bStyles from './Breakdown.module.css'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const CAT_COLORS = {
  'Food & Dining': 'var(--peach)',
  'Transport': 'var(--blue)',
  'Shopping': 'var(--purple)',
  'Health': 'var(--red)',
  'Entertainment': 'var(--peach)',
  'Personal Care': 'var(--rose)',
  'Education': 'var(--blue)',
  Bills: 'var(--amber)',
  Other: 'var(--text3)',
  Salary: 'var(--income)',
  Freelance: 'var(--blue)',
  Business: 'var(--purple)',
  Investment: 'var(--teal)',
  '13th Month': 'var(--income)',
  Bonus: 'var(--income)',
}

const CAT_ICONS = {
  'Food & Dining': '🍔',
  'Transport': '🚗',
  'Shopping': '🛍️',
  'Health': '💊',
  'Entertainment': '🍿',
  'Personal Care': '✨',
  'Education': '📚',
  Bills: '💡',
  Other: '🏷️',
  Salary: '💰',
  Freelance: '💻',
  Business: '🏢',
  Investment: '📈',
  '13th Month': '🎁',
  Bonus: '🎉',
}

function getCatColor(cat) {
  return CAT_COLORS[cat] || 'var(--accent)'
}

function getCatIcon(cat) {
  return CAT_ICONS[cat] || '🏷️'
}

function PieChart({ data, size = 200, symbol = '₱', privacyMode = false, onSelectCat, selectedCat }) {
  const [hoveredIndex, setHoveredIndex] = useState(null)
  if (!data.length) return <div className={bStyles.noData}>No data yet</div>
  const total = data.reduce((sum, item) => sum + item.value, 0)
  if (total === 0) return <div className={bStyles.noData}>No data yet</div>

  const cx = size / 2
  const cy = size / 2
  const radius = size / 2 - 12
  const innerRadius = radius * 0.60
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

    const isSelected = selectedCat && selectedCat === item.cat
    const isHovered = hoveredIndex === idx
    const offset = isSelected ? 8 : isHovered ? 5 : 0
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

  const activeSlice = selectedCat 
    ? slices.find(s => s.cat === selectedCat) 
    : hoveredIndex !== null 
      ? slices[hoveredIndex] 
      : null

  return (
    <div style={{ width: size, height: size, flexShrink: 0, position: 'relative' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', overflow: 'visible' }}>
        <g>
          {slices.map((slice, index) => {
            const isHighlighted = (hoveredIndex === null && !selectedCat) || hoveredIndex === index || selectedCat === slice.cat
            const pathStyle = {
              transform: `translate(${slice.dx}px, ${slice.dy}px) scale(${isHighlighted && (hoveredIndex === index || selectedCat === slice.cat) ? 1.04 : 1})`,
              transformOrigin: 'center',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              cursor: 'pointer',
            }

            return slice.isFullSlice ? (
              <circle
                key={index}
                cx={cx}
                cy={cy}
                r={radius}
                fill={slice.color}
                opacity={isHighlighted ? 1 : 0.4}
                onMouseEnter={() => {
                  playTick()
                  setHoveredIndex(index)
                }}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => onSelectCat?.(slice.cat === selectedCat ? null : slice.cat)}
                style={pathStyle}
              />
            ) : (
              <path
                key={index}
                d={slice.path}
                fill={slice.color}
                opacity={isHighlighted ? 1 : 0.4}
                onMouseEnter={() => {
                  playTick()
                  setHoveredIndex(index)
                }}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => onSelectCat?.(slice.cat === selectedCat ? null : slice.cat)}
                stroke="var(--surface)"
                strokeWidth="2"
                style={pathStyle}
              />
            )
          })}
        </g>
        
        {/* Central Donut Hole */}
        <circle cx={cx} cy={cy} r={innerRadius} fill="var(--surface)" stroke="var(--border)" strokeWidth="1" />
        
        {/* Center Text Information */}
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
              {activeSlice.cat.length > 10 ? `${activeSlice.cat.slice(0, 9)}..` : activeSlice.cat}
            </text>
            <text
              x={cx}
              y={cy + 5}
              textAnchor="middle"
              fill="var(--text)"
              fontSize="14"
              fontWeight="800"
              fontFamily="var(--font-mono)"
            >
              {privacyMode ? '•••' : fmt(activeSlice.value, symbol)}
            </text>
            <text
              x={cx}
              y={cy + 19}
              textAnchor="middle"
              fill={activeSlice.color}
              fontSize="11"
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
              letterSpacing="0.08em"
            >
              TOTAL
            </text>
            <text
              x={cx}
              y={cy + 12}
              textAnchor="middle"
              fill="var(--text)"
              fontSize="14"
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

export default function Breakdown({ data, profile = {}, symbol, privacyMode = false, hideHeader = false }) {
  const s = symbol || '₱'
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [tab, setTab] = useState('expenses')
  const [selectedCat, setSelectedCat] = useState(null)
  const [detailsMode, setDetailsMode] = useState('')

  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth()

  const projected = useMemo(
    () => getProjectedTransactions(data?.income || [], data?.expenses || [], viewYear, viewMonth),
    [data?.income, data?.expenses, viewYear, viewMonth],
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
    () => [...getMonthTransactions(data?.income || [], viewYear, viewMonth).filter(isTransactionPaid), ...projectedIncome],
    [data?.income, projectedIncome, viewYear, viewMonth],
  )
  const monthExpenses = useMemo(
    () => [...getMonthTransactions(data?.expenses || [], viewYear, viewMonth).filter(isTransactionPaid), ...projectedExpenses],
    [data?.expenses, projectedExpenses, viewYear, viewMonth],
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

  // Savings rate calculation
  const savingsRate = incomeTotal > 0 ? Math.round((monthNet / incomeTotal) * 100) : 0
  
  // Daily burn rate calculation
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const dailyBurn = expenseTotal > 0 ? Math.round(expenseTotal / daysInMonth) : 0

  // 6-Month cashflow trend
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

      const projectedMonth = getProjectedTransactions(data?.income || [], data?.expenses || [], year, month)
      const inc = getMonthTotal(data?.income || [], year, month)
        + projectedMonth
          .filter(tx => tx.type === 'income')
          .reduce((sum, tx) => sum + (tx.amount || 0), 0)
      const exp = getMonthTotal(data?.expenses || [], year, month)
        + projectedMonth
          .filter(tx => tx.type === 'expense')
          .reduce((sum, tx) => sum + (tx.amount || 0), 0)
      return { 
        label: MONTHS[month], 
        income: inc, 
        expenses: exp, 
        net: inc - exp,
        isCurrent: year === now.getFullYear() && month === now.getMonth()
      }
    })
  }, [data?.expenses, data?.income, viewMonth, viewYear, now])

  const maxTrendFlow = useMemo(() => {
    return Math.max(1, ...last6.map(m => Math.max(m.income, m.expenses)))
  }, [last6])

  function prevMonth() {
    playTick()
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(year => year - 1)
    } else {
      setViewMonth(month => month - 1)
    }
    setSelectedCat(null)
  }

  function nextMonth() {
    playTick()
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(year => year + 1)
    } else {
      setViewMonth(month => month + 1)
    }
    setSelectedCat(null)
  }

  function resetToCurrentMonth() {
    playTick()
    setViewYear(now.getFullYear())
    setViewMonth(now.getMonth())
    setSelectedCat(null)
  }

  const monthLabel = new Date(viewYear, viewMonth).toLocaleString('default', { month: 'long', year: 'numeric' })
  const money = value => displayValue(privacyMode, fmt(value, s), maskMoney(s))

  // Filtered transactions if a category is spotlighted
  const filteredCategoryTxs = useMemo(() => {
    if (!selectedCat) return []
    const source = tab === 'expenses' ? monthExpenses : monthIncome
    return source.filter(tx => tx.cat === selectedCat).sort((a, b) => (b.amount || 0) - (a.amount || 0))
  }, [selectedCat, tab, monthExpenses, monthIncome])

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

    if (detailsMode === 'income') {
      return {
        open: true,
        title: 'Income details',
        subtitle: `${monthLabel}. All paid and scheduled recurring income cycles.`,
        sections: [{ label: 'Income', list: groupByDate(monthIncome) }],
        close,
      }
    }

    if (detailsMode === 'expenses') {
      return {
        open: true,
        title: 'Expense details',
        subtitle: `${monthLabel}. All paid and scheduled recurring expense cycles.`,
        sections: [{ label: 'Expenses', list: groupByDate(monthExpenses) }],
        close,
      }
    }

    return {
      open: true,
      title: 'Net Cashflow Details',
      subtitle: `${monthLabel}. Income minus expenses breakdown.`,
      sections: [
        { label: 'Income', list: groupByDate(monthIncome) },
        { label: 'Expenses', list: groupByDate(monthExpenses) },
      ],
      close,
    }
  }, [detailsMode, monthExpenses, monthIncome, monthLabel])

  const mainContent = (
    <div className={bStyles.breakdownContainer}>
      {/* 1. CASHFLOW RADAR HERO */}
      <div className={bStyles.radarHeroCard}>
        <div className={bStyles.radarHeroTop}>
          <div className={bStyles.radarHeroCopy}>
            <span className={bStyles.radarHeroLabel}>Monthly Net Cashflow</span>
            <div className={bStyles.radarHeroVal}>
              <span className={monthNet >= 0 ? bStyles.valPositive : bStyles.valNegative}>
                {monthNet >= 0 ? '+' : ''}{money(monthNet)}
              </span>
            </div>
          </div>

          <div className={bStyles.monthStepper}>
            <button type="button" className={bStyles.navBtn} onClick={prevMonth} title="Previous Month">
              ‹
            </button>
            <span className={bStyles.monthTitle}>{monthLabel}</span>
            <button type="button" className={bStyles.navBtn} onClick={nextMonth} title="Next Month">
              ›
            </button>
            {!isCurrentMonth && (
              <button type="button" className={bStyles.btnResetMonth} onClick={resetToCurrentMonth}>
                Today
              </button>
            )}
          </div>
        </div>

        {/* METRICS STRIP */}
        <div className={bStyles.radarMetricsStrip}>
          <button
            type="button"
            className={`${bStyles.radarMetricPill} ${bStyles.metricPillBtn}`}
            onClick={() => setDetailsMode('income')}
          >
            <span className={bStyles.metricDot} style={{ background: 'var(--income)' }} />
            <span className={bStyles.metricLabel}>Income:</span>
            <span className={`${bStyles.metricVal} ${bStyles.valPositive}`}>+{money(incomeTotal)}</span>
          </button>

          <button
            type="button"
            className={`${bStyles.radarMetricPill} ${bStyles.metricPillBtn}`}
            onClick={() => setDetailsMode('expenses')}
          >
            <span className={bStyles.metricDot} style={{ background: 'var(--red)' }} />
            <span className={bStyles.metricLabel}>Expenses:</span>
            <span className={`${bStyles.metricVal} ${bStyles.valNegative}`}>-{money(expenseTotal)}</span>
          </button>

          {incomeTotal > 0 && (
            <div className={bStyles.radarMetricPill}>
              <span className={bStyles.metricDot} style={{ background: savingsRate >= 20 ? 'var(--income)' : 'var(--amber)' }} />
              <span className={bStyles.metricLabel}>Savings Rate:</span>
              <span className={bStyles.metricVal}>{savingsRate}%</span>
            </div>
          )}

          {dailyBurn > 0 && (
            <div className={bStyles.radarMetricPill}>
              <span className={bStyles.metricDot} style={{ background: 'var(--text3)' }} />
              <span className={bStyles.metricLabel}>Daily Burn:</span>
              <span className={bStyles.metricVal}>~{money(dailyBurn)}/day</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. SEGMENTED SWITCHER & CATEGORY BREAKDOWN */}
      <div className={bStyles.surfaceCard}>
        <div className={bStyles.sectionHeader}>
          <div className={bStyles.tabSegmentWrap}>
            <button
              type="button"
              className={`${bStyles.tabSegmentBtn} ${tab === 'expenses' ? bStyles.tabSegmentBtnActive : ''}`}
              onClick={() => {
                playTick()
                setTab('expenses')
                setSelectedCat(null)
              }}
            >
              💳 Expenses ({expenseCats.length})
            </button>
            <button
              type="button"
              className={`${bStyles.tabSegmentBtn} ${tab === 'income' ? bStyles.tabSegmentBtnActive : ''}`}
              onClick={() => {
                playTick()
                setTab('income')
                setSelectedCat(null)
              }}
            >
              💰 Income ({incomeCats.length})
            </button>
          </div>

          <span className={bStyles.totalBadge}>
            Total: {money(total)}
          </span>
        </div>

        {!cats.length ? (
          <div className={bStyles.emptyState}>
            <div className={bStyles.emptyIcon}>{tab === 'expenses' ? '💳' : '💰'}</div>
            <h4>No {tab} records for {monthLabel}</h4>
            <p>Transactions recorded in this month will appear here with dynamic categorical distribution.</p>
          </div>
        ) : (
          <div className={bStyles.pieSection}>
            <div className={bStyles.chartWrapper}>
              <PieChart
                data={cats}
                size={200}
                symbol={s}
                privacyMode={privacyMode}
                selectedCat={selectedCat}
                onSelectCat={cat => {
                  playTick()
                  setSelectedCat(cat)
                }}
              />
              <div className={bStyles.chartHint}>Tap any slice to spotlight</div>
            </div>

            <div className={bStyles.legend}>
              {cats.map((cat, index) => {
                const isSelected = selectedCat === cat.cat
                const pct = total > 0 ? Math.round((cat.value / total) * 100) : 0
                return (
                  <div
                    key={index}
                    className={`${bStyles.legendItem} ${isSelected ? bStyles.legendItemActive : ''}`}
                    onClick={() => {
                      playTick()
                      setSelectedCat(isSelected ? null : cat.cat)
                    }}
                  >
                    <div className={bStyles.legendIcon}>{getCatIcon(cat.cat)}</div>
                    <div className={bStyles.legendInfo}>
                      <div className={bStyles.legendRow}>
                        <span className={bStyles.legendCat}>{cat.cat}</span>
                        <span className={bStyles.legendVal}>{money(cat.value)}</span>
                      </div>
                      <div className={bStyles.progressTrack}>
                        <div
                          className={bStyles.progressFill}
                          style={{ width: `${pct}%`, background: cat.color }}
                        />
                      </div>
                    </div>
                    <span className={bStyles.legendPct}>{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* SPOTLIGHT CATEGORY TRANSACTIONS */}
        {selectedCat && filteredCategoryTxs.length > 0 && (
          <div className={bStyles.spotlightSection}>
            <div className={bStyles.spotlightHeader}>
              <div className={bStyles.spotlightTitle}>
                {getCatIcon(selectedCat)} {selectedCat} Breakdown ({filteredCategoryTxs.length})
              </div>
              <button
                type="button"
                className={bStyles.spotlightClear}
                onClick={() => setSelectedCat(null)}
              >
                Clear filter ✕
              </button>
            </div>

            <div className={bStyles.spotlightList}>
              {filteredCategoryTxs.map((tx, idx) => (
                <div key={(tx._id || tx.id || 'st') + idx} className={bStyles.spotlightRow}>
                  <div className={bStyles.spotlightRowMain}>
                    <div className={bStyles.spotlightDesc}>{tx.desc || tx.cat || 'Untitled'}</div>
                    <div className={bStyles.spotlightDate}>{tx.date || 'No date'}</div>
                  </div>
                  <div className={`${bStyles.spotlightAmount} ${tab === 'income' ? bStyles.valPositive : bStyles.valNegative}`}>
                    {tab === 'income' ? '+' : '-'}{money(tx.amount || 0)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. 6-MONTH CASHFLOW TREND */}
      <div className={bStyles.surfaceCard}>
        <div className={bStyles.sectionHeader}>
          <div>
            <div className={bStyles.sectionTitle}>6-Month Cashflow Trajectory</div>
            <div className={bStyles.sectionSub}>Monthly Income vs Expenses comparison</div>
          </div>
          <div className={bStyles.trendLegend}>
            <span className={bStyles.trendLegendItem}>
              <span className={bStyles.trendDot} style={{ background: 'var(--income)' }} /> Income
            </span>
            <span className={bStyles.trendLegendItem}>
              <span className={bStyles.trendDot} style={{ background: 'var(--red)' }} /> Expenses
            </span>
          </div>
        </div>

        <div className={bStyles.trendGrid}>
          {last6.map((m, idx) => {
            const incH = Math.max(4, Math.round((m.income / maxTrendFlow) * 100))
            const expH = Math.max(4, Math.round((m.expenses / maxTrendFlow) * 100))
            return (
              <div key={idx} className={`${bStyles.trendCol} ${m.isCurrent ? bStyles.trendColActive : ''}`}>
                <div className={bStyles.trendBarsWrap}>
                  <div
                    className={bStyles.trendBarIncome}
                    style={{ height: `${incH}%` }}
                    title={`Income: ${fmt(m.income, s)}`}
                  />
                  <div
                    className={bStyles.trendBarExpense}
                    style={{ height: `${expH}%` }}
                    title={`Expenses: ${fmt(m.expenses, s)}`}
                  />
                </div>
                <div className={bStyles.trendLabel}>{m.label}</div>
                <div className={`${bStyles.trendNetPill} ${m.net >= 0 ? bStyles.trendNetPos : bStyles.trendNetNeg}`}>
                  {m.net >= 0 ? '+' : ''}{money(m.net)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* DETAILS MODAL */}
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
              <div className={bStyles.detailsEmpty}>No transactions recorded.</div>
            ) : (
              <div className={bStyles.detailsList}>
                {section.list.map(([day, list]) => (
                  <div key={day} className={bStyles.detailsDay}>
                    <div className={bStyles.detailsDayLabel}>{day}</div>
                    {list.map((tx, index) => {
                      const isIncome = tx.type === 'income'
                      return (
                        <div key={(tx._id || tx.id || 'tx') + index} className={bStyles.detailsRow}>
                          <div className={bStyles.detailsRowMain}>
                            <div className={bStyles.detailsRowDesc}>{tx.desc || tx.cat || 'Untitled'}</div>
                            <div className={bStyles.detailsRowMeta}>
                              <span>{tx.cat}{tx.subcat ? ` · ${tx.subcat}` : ''}</span>
                            </div>
                          </div>
                          <div className={`${bStyles.detailsRowAmount} ${isIncome ? bStyles.valPositive : bStyles.valNegative}`}>
                            {isIncome ? '+' : '-'}{money(tx.amount || 0)}
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

  return hideHeader ? mainContent : <div className={`${styles.page} ${bStyles.breakdownPage}`}>{mainContent}</div>
}
