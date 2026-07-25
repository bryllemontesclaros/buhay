import { useMemo, useState } from 'react'
import { getMonthTotal, getMonthTransactions, isTransactionPaid } from '../lib/finance'
import { getProjectedTransactions } from '../lib/recurrence'
import { displayValue, fmt, isSameMonth, maskMoney, playTick } from '../lib/utils'
import { getBillPeriodInfo } from '../lib/bills'
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
  Salary: 'var(--accent)',
  Freelance: 'var(--blue)',
  Business: 'var(--purple)',
  Investment: 'var(--teal)',
  '13th Month': 'var(--accent)',
  Bonus: 'var(--accent)',
}

function getCatColor(cat) {
  return CAT_COLORS[cat] || 'var(--text3)'
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





export default function Breakdown({ data, profile = {}, symbol, privacyMode = false, hideHeader = false }) {
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

  const mainContent = (
    <>
      {!hideHeader && (
        <div className={bStyles.heroSection}>
          <div className={bStyles.heroCopy}>
            <div className={bStyles.pageEyebrow}>Breakdown</div>
            <div className={bStyles.pageTitle}>Read the pattern, then decide.</div>
            <div className={bStyles.pageSub}>
              Compare category mix and monthly flow as signals to review, not automatic advice.
            </div>
          </div>
        </div>
      )}

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
                {section.list.map(([day, list]) => {
                  const formattedDay = (() => {
                    const parsed = new Date(`${day}T00:00:00`)
                    if (Number.isNaN(parsed.getTime())) return day
                    return parsed.toLocaleDateString('en-PH', {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                    })
                  })()

                  return (
                    <div key={day} className={bStyles.detailsDay}>
                      <div className={bStyles.detailsDayLabel}>{formattedDay}</div>
                      {list.map((tx, index) => {
                        const isIncome = tx.type === 'income'
                        const sign = isIncome ? '+' : '−'
                        const tone = isIncome ? 'var(--income)' : 'var(--red)'
                        const projectedBadge = tx._projected || tx.isProjected || tx.projected ? 'Projected cycle' : ''
                        
                        const displayDesc = tx.desc || tx.cat || 'Untitled'
                        const metaParts = []
                        if (tx.cat && tx.cat.toLowerCase() !== displayDesc.toLowerCase()) {
                          metaParts.push(tx.cat)
                        }
                        if (tx.subcat && tx.subcat.toLowerCase() !== displayDesc.toLowerCase()) {
                          metaParts.push(tx.subcat)
                        }
                        const metaText = metaParts.join(' · ')

                        return (
                          <div key={(tx._id || tx.id || 'tx') + index} className={bStyles.detailsRow}>
                            <div className={bStyles.detailsRowMain}>
                              <div className={bStyles.detailsRowDesc}>{displayDesc}</div>
                              {(metaText || projectedBadge) && (
                                <div className={bStyles.detailsRowMeta}>
                                  {metaText && <span>{metaText}</span>}
                                  {projectedBadge && <span className={bStyles.detailsBadge}>{projectedBadge}</span>}
                                </div>
                              )}
                            </div>
                            <div className={bStyles.detailsRowAmount} style={{ color: tone }}>
                              {displayValue(privacyMode, `${sign}${fmt(tx.amount || 0, s)}`, `${sign}${maskMoney(s)}`)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </DetailsModal>
    </>
  )

  return hideHeader ? mainContent : <div className={`${styles.page} ${bStyles.breakdownPage}`}>{mainContent}</div>
}
