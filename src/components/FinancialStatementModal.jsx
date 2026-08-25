import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  getCurrentBalance,
  getTakdaNetWorth,
  getTakdaTotalAssets,
  getTakdaTotalDebts,
  getTakdaTotalSavings,
} from '../lib/finance'
import styles from './FinancialStatementModal.module.css'

export default function FinancialStatementModal({ data = {}, profile = {}, symbol = '₱', onClose }) {
  const [range, setRange] = useState('thisMonth')
  const s = symbol || '₱'

  const userDisplayName = profile.name || profile.displayName || profile.email || 'Account Holder'
  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  // Date filtering helper
  const filteredData = useMemo(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    const income = Array.isArray(data.income) ? data.income : []
    const expenses = Array.isArray(data.expenses) ? data.expenses : []
    const transfers = Array.isArray(data.transfers) ? data.transfers : []

    const isMatch = (dateStr) => {
      if (!dateStr) return range === 'all'
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return range === 'all'

      if (range === 'thisMonth') {
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth
      }
      if (range === 'lastMonth') {
        const prevMonthDate = new Date(currentYear, currentMonth - 1, 1)
        return d.getFullYear() === prevMonthDate.getFullYear() && d.getMonth() === prevMonthDate.getMonth()
      }
      if (range === 'last30') {
        const diffMs = now.getTime() - d.getTime()
        return diffMs >= 0 && diffMs <= 30 * 24 * 60 * 60 * 1000
      }
      if (range === 'ytd') {
        return d.getFullYear() === currentYear
      }
      return true // 'all'
    }

    const filteredIncome = income.filter(t => isMatch(t.date))
    const filteredExpenses = expenses.filter(t => isMatch(t.date))
    const filteredTransfers = transfers.filter(t => isMatch(t.date))

    return {
      income: filteredIncome,
      expenses: filteredExpenses,
      transfers: filteredTransfers,
    }
  }, [data, range])

  // Aggregate metrics
  const totalIncome = filteredData.income.reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  const totalExpenses = filteredData.expenses.reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  const netCashflow = totalIncome - totalExpenses
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((netCashflow / totalIncome) * 100)) : 0

  const accountsList = Array.isArray(data.accounts) ? data.accounts : []
  const debtsList = Array.isArray(data.debts) ? data.debts : []
  const goalsList = Array.isArray(data.goals) ? data.goals : []
  const billsList = Array.isArray(data.bills) ? data.bills : []
  const holdingsList = Array.isArray(data.portfolioHoldings) ? data.portfolioHoldings : []

  const liquidCash = getCurrentBalance(accountsList, debtsList)
  const totalDebts = getTakdaTotalDebts(accountsList, debtsList)
  const totalSavings = getTakdaTotalSavings(goalsList)
  const netWorth = getTakdaNetWorth(accountsList, debtsList, goalsList, holdingsList)

  // Category breakdown calculation
  const categoryBreakdown = useMemo(() => {
    const map = {}
    filteredData.expenses.forEach(t => {
      const cat = t.cat || 'Uncategorized'
      map[cat] = (map[cat] || 0) + (Number(t.amount) || 0)
    })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, amt]) => ({
        name,
        amount: amt,
        percentage: totalExpenses > 0 ? Math.round((amt / totalExpenses) * 100) : 0,
      }))
  }, [filteredData.expenses, totalExpenses])

  const periodLabel = useMemo(() => {
    const now = new Date()
    if (range === 'thisMonth') {
      return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
    if (range === 'lastMonth') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return prev.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
    if (range === 'last30') return 'Last 30 Days'
    if (range === 'ytd') return `Year-to-Date ${now.getFullYear()}`
    return 'All-Time Financial History'
  }, [range])

  const handlePrint = () => {
    window.print()
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Top Control Bar (Screen only) */}
        <div className={styles.controlBar}>
          <div className={styles.rangePills}>
            <button
              type="button"
              className={`${styles.pill} ${range === 'thisMonth' ? styles.pillActive : ''}`}
              onClick={() => setRange('thisMonth')}
            >
              This Month
            </button>
            <button
              type="button"
              className={`${styles.pill} ${range === 'lastMonth' ? styles.pillActive : ''}`}
              onClick={() => setRange('lastMonth')}
            >
              Last Month
            </button>
            <button
              type="button"
              className={`${styles.pill} ${range === 'last30' ? styles.pillActive : ''}`}
              onClick={() => setRange('last30')}
            >
              Last 30 Days
            </button>
            <button
              type="button"
              className={`${styles.pill} ${range === 'ytd' ? styles.pillActive : ''}`}
              onClick={() => setRange('ytd')}
            >
              YTD
            </button>
            <button
              type="button"
              className={`${styles.pill} ${range === 'all' ? styles.pillActive : ''}`}
              onClick={() => setRange('all')}
            >
              All Time
            </button>
          </div>

          <div className={styles.actionButtons}>
            <button type="button" className={styles.btnPrint} onClick={handlePrint}>
              🖨️ Print / Save PDF
            </button>
            <button type="button" className={styles.btnClose} onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        {/* Statement Body (Print-optimized) */}
        <div className={styles.statementBody}>
          {/* Header Letterhead */}
          <div className={styles.statementHeader}>
            <div className={styles.brandCol}>
              <div className={styles.statementBrand}>↗ Buhay</div>
              <div className={styles.statementTagline}>Financial clarity for real life</div>
            </div>
            <div className={styles.statementMetaCol}>
              <div className={styles.statementTitle}>Financial Statement</div>
              <div>Period: <strong>{periodLabel}</strong></div>
              <div>Account: <strong>{userDisplayName}</strong></div>
              <div>Generated: {currentDateFormatted}</div>
            </div>
          </div>

          {/* Executive Summary Cards */}
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Net Worth</div>
              <div className={styles.kpiValue}>{s}{netWorth.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Period Inflow (Income)</div>
              <div className={`${styles.kpiValue} ${styles.valPos}`}>+{s}{totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Period Outflow (Spent)</div>
              <div className={`${styles.kpiValue} ${styles.valNeg}`}>-{s}{totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Net Cashflow</div>
              <div className={`${styles.kpiValue} ${netCashflow >= 0 ? styles.valPos : styles.valNeg}`}>
                {netCashflow >= 0 ? '+' : ''}{s}{netCashflow.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* 2-Column: Spending by Category & Multi-Account Snapshot */}
          <div className={styles.twoColGrid}>
            {/* Left: Spending by Category */}
            <div className={styles.sectionBlock}>
              <div className={styles.sectionHeading}>
                <span>Spending by Category</span>
                <span>Total: {s}{totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              {categoryBreakdown.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94a3b8', padding: '12px 0' }}>No expense records in this period</div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th className={styles.amtCol}>Amount ({s})</th>
                      <th className={styles.amtCol}>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryBreakdown.slice(0, 8).map(cat => (
                      <tr key={cat.name}>
                        <td>
                          <div>{cat.name}</div>
                          <div className={styles.categoryMeterTrack}>
                            <div className={styles.categoryMeterFill} style={{ width: `${cat.percentage}%` }}></div>
                          </div>
                        </td>
                        <td className={styles.amtCol}>{cat.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className={styles.amtCol}>{cat.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Right: Account Balance Snapshot */}
            <div className={styles.sectionBlock}>
              <div className={styles.sectionHeading}>
                <span>Balance Sheet Snapshot</span>
                <span>Liquid: {s}{liquidCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              {accountsList.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94a3b8', padding: '12px 0' }}>No accounts registered</div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Type</th>
                      <th className={styles.amtCol}>Balance ({s})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountsList.map(acc => (
                      <tr key={acc.id || acc.name}>
                        <td><strong>{acc.name}</strong></td>
                        <td>{acc.type || 'Standard'}</td>
                        <td className={styles.amtCol}>
                          <span style={{ color: Number(acc.balance) >= 0 ? '#059669' : '#dc2626' }}>
                            {Number(acc.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* 2-Column: Upcoming Bills & Savings Goals */}
          <div className={styles.twoColGrid}>
            {/* Left: Recurring Bills */}
            <div className={styles.sectionBlock}>
              <div className={styles.sectionHeading}>
                <span>Recurring Commitments</span>
                <span>{billsList.length} Active Bills</span>
              </div>
              {billsList.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94a3b8', padding: '12px 0' }}>No recurring bills recorded</div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Bill</th>
                      <th>Due</th>
                      <th className={styles.amtCol}>Amount ({s})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billsList.slice(0, 6).map(b => (
                      <tr key={b.id || b.name}>
                        <td>{b.name}</td>
                        <td>{b.due ? `Day ${b.due}` : (b.dueDate || b.freq || 'Monthly')}</td>
                        <td className={styles.amtCol}>{Number(b.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Right: Active Savings Goals & Debts */}
            <div className={styles.sectionBlock}>
              <div className={styles.sectionHeading}>
                <span>Savings Goals & Debt Status</span>
                <span>Saved: {s}{totalSavings.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              {goalsList.length === 0 && debtsList.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94a3b8', padding: '12px 0' }}>No active goals or debts</div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Target</th>
                      <th>Saved / Balance</th>
                      <th className={styles.amtCol}>Target Goal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {goalsList.map(g => {
                      const cur = Number(g.current) || 0
                      const tgt = Number(g.target) || 1
                      const pct = Math.min(100, Math.round((cur / tgt) * 100))
                      return (
                        <tr key={g.id || g.name}>
                          <td>
                            <div>🎯 {g.name}</div>
                            <div className={styles.categoryMeterTrack}>
                              <div className={styles.categoryMeterFill} style={{ width: `${pct}%`, background: '#059669' }}></div>
                            </div>
                          </td>
                          <td>{s}{cur.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({pct}%)</td>
                          <td className={styles.amtCol}>{s}{tgt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      )
                    })}
                    {debtsList.map(d => (
                      <tr key={d.id || d.name}>
                        <td>💳 {d.name}</td>
                        <td style={{ color: '#dc2626' }}>{s}{Number(d.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className={styles.amtCol}>{d.apr ? `${d.apr}% APR` : 'Debt'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Statement Footer */}
          <div className={styles.statementFooter}>
            <span>Buhay · Private Personal Finance Operating System</span>
            <span>Generated from Client-Side Verified Records</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
