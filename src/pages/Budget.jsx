import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { fsAdd, fsDel } from '../lib/firestore'
import { notifyApp } from '../lib/appFeedback'
import { isTransactionPaid } from '../lib/finance'
import { displayValue, fmt, isSameMonth, maskMoney, playTick } from '../lib/utils'
import styles from './Page.module.css'
import bStyles from './Budget.module.css'
import SwipeableCard from '../components/SwipeableCard'

const BUDGET_PRESETS = [10000, 15000, 20000, 30000, 50000]

export default function Budget({ user, data, profile = {}, symbol, privacyMode = false, hideHeader = false }) {
  const s = symbol || '₱'
  const now = new Date()
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [savingBudget, setSavingBudget] = useState(false)

  const budgets = data?.budgets || []
  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth()

  const monthLabel = new Date(viewYear, viewMonth).toLocaleString('default', { month: 'long', year: 'numeric' })

  // Days in month & days remaining
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const currentDay = isCurrentMonth ? now.getDate() : daysInMonth
  const daysRemaining = Math.max(1, daysInMonth - currentDay + 1)
  const monthElapsedPct = Math.round((currentDay / daysInMonth) * 100)

  function prevMonth() {
    playTick()
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(year => year - 1)
    } else {
      setViewMonth(month => month - 1)
    }
  }

  function nextMonth() {
    playTick()
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(year => year + 1)
    } else {
      setViewMonth(month => month + 1)
    }
  }

  function resetToCurrentMonth() {
    playTick()
    setViewYear(now.getFullYear())
    setViewMonth(now.getMonth())
  }

  // Monthly Spending
  const monthExpensesList = useMemo(() => {
    return (data?.expenses || [])
      .filter(tx => isTransactionPaid(tx) && isSameMonth(tx.date, viewYear, viewMonth))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }, [data?.expenses, viewMonth, viewYear])

  const totalExpenses = useMemo(() => {
    return monthExpensesList.reduce((sum, tx) => sum + (tx.amount || 0), 0)
  }, [monthExpensesList])

  // Category breakdown of spending
  const categoryBreakdown = useMemo(() => {
    const map = {}
    monthExpensesList.forEach(tx => {
      const cat = tx.cat || 'Other'
      map[cat] = (map[cat] || 0) + (tx.amount || 0)
    })
    return Object.entries(map)
      .map(([cat, amount]) => ({ cat, amount, pct: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0 }))
      .sort((a, b) => b.amount - a.amount)
  }, [monthExpensesList, totalExpenses])

  const currentBudget = budgets.find(b => b.cat === 'global') || budgets[0]
  const totalBudget = currentBudget ? Number(currentBudget.limit) || 0 : 0
  const totalRemaining = totalBudget - totalExpenses
  const usagePct = totalBudget > 0 ? Math.min(100, Math.round((totalExpenses / totalBudget) * 100)) : 0
  const isOverBudget = totalExpenses > totalBudget && totalBudget > 0

  // Safe daily spend allowance for remaining days
  const safeDailySpend = totalRemaining > 0 ? Math.round(totalRemaining / daysRemaining) : 0

  const money = value => displayValue(privacyMode, fmt(value, s), maskMoney(s))

  function openAdjustModal() {
    playTick()
    setAdjustAmount(totalBudget > 0 ? String(totalBudget) : '')
    setShowAdjustModal(true)
  }

  async function handleSaveBudget(e) {
    if (e) e.preventDefault()
    const limit = Number(adjustAmount)
    if (!Number.isFinite(limit) || limit <= 0) {
      notifyApp({ title: 'Check budget limit', message: 'Monthly limit must be greater than zero.', tone: 'warning' })
      return
    }

    setSavingBudget(true)
    try {
      for (const b of budgets) {
        await fsDel(user.uid, 'budgets', b._id)
      }
      await fsAdd(user.uid, 'budgets', { cat: 'global', limit })
      notifyApp({ title: 'Budget updated', message: `Monthly budget set to ${fmt(limit, s)}.`, tone: 'success' })
      setShowAdjustModal(false)
    } catch (err) {
      console.error(err)
      notifyApp({ title: 'Error', message: 'Could not update budget limit.', tone: 'error' })
    } finally {
      setSavingBudget(false)
    }
  }

  const mainContent = (
    <div className={bStyles.budgetContainer}>
      {/* 1. RADAR HERO */}
      <div className={bStyles.radarHeroCard}>
        <div className={bStyles.radarHeroTop}>
          <div className={bStyles.radarHeroCopy}>
            <span className={bStyles.radarHeroLabel}>
              {isOverBudget ? '⚠️ Budget Exceeded By' : 'Remaining Monthly Budget'}
            </span>
            <div className={bStyles.radarHeroVal}>
              <span className={isOverBudget ? bStyles.valNegative : bStyles.valPositive}>
                {isOverBudget ? `−${money(Math.abs(totalRemaining))}` : money(totalRemaining)}
              </span>
              {totalBudget > 0 && (
                <span className={bStyles.radarHeroSub}>of {money(totalBudget)} limit</span>
              )}
            </div>
          </div>

          <div className={bStyles.radarHeroActions}>
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

            <button type="button" className={bStyles.btnHeroPrimary} onClick={openAdjustModal}>
              ⚡ Adjust Budget
            </button>
          </div>
        </div>

        {/* PROGRESS TRACK */}
        {totalBudget > 0 && (
          <div className={bStyles.progressSection}>
            <div className={bStyles.progressTrack}>
              <div
                className={bStyles.progressFill}
                style={{
                  width: `${usagePct}%`,
                  background: isOverBudget
                    ? 'var(--red)'
                    : usagePct > 80
                      ? 'var(--amber)'
                      : 'var(--accent)',
                }}
              />
            </div>
            <div className={bStyles.progressMeta}>
              <span><strong>{usagePct}%</strong> of budget spent ({money(totalExpenses)})</span>
              <span><strong>{daysRemaining}</strong> days left in month</span>
            </div>
          </div>
        )}

        {/* METRIC PILLS */}
        <div className={bStyles.radarMetricsStrip}>
          <div className={bStyles.radarMetricPill}>
            <span className={bStyles.metricDot} style={{ background: 'var(--red)' }} />
            <span className={bStyles.metricLabel}>Total Spent:</span>
            <span className={`${bStyles.metricVal} ${bStyles.valNegative}`}>{money(totalExpenses)}</span>
          </div>

          {totalRemaining > 0 && isCurrentMonth && (
            <div className={`${bStyles.radarMetricPill} ${bStyles.pillPositive}`}>
              <span className={bStyles.metricDot} style={{ background: 'var(--income)' }} />
              <span className={bStyles.metricLabel}>Safe Daily Spend:</span>
              <span className={bStyles.metricVal}>{money(safeDailySpend)}/day</span>
            </div>
          )}

          {totalBudget > 0 && (
            <div className={bStyles.radarMetricPill}>
              <span className={bStyles.metricDot} style={{ background: isOverBudget ? 'var(--red)' : usagePct > monthElapsedPct ? 'var(--amber)' : 'var(--income)' }} />
              <span className={bStyles.metricLabel}>Pacing:</span>
              <span className={bStyles.metricVal}>
                {isOverBudget ? 'Over Budget' : usagePct > monthElapsedPct ? 'Fast Burn' : 'On Track ✓'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. CATEGORY BREAKDOWN SECTION */}
      {categoryBreakdown.length > 0 && (
        <div className={bStyles.surfaceCard}>
          <div className={bStyles.sectionHeader}>
            <div>
              <div className={bStyles.sectionTitle}>Category Spending Impact</div>
              <div className={bStyles.sectionSub}>Where your budget went this month</div>
            </div>
            <span className={bStyles.totalSpendBadge}>
              {categoryBreakdown.length} Categories
            </span>
          </div>

          <div className={bStyles.categoryList}>
            {categoryBreakdown.map(item => (
              <SwipeableCard
                key={item.cat}
                onSwipeRight={() => {
                  playTick()
                  setShowAdjustModal(true)
                }}
                rightLabel="Adjust Budget"
                rightIcon="⚡"
                rightTone="success"
                onSwipeLeft={() => {
                  playTick()
                  setShowAdjustModal(true)
                }}
                leftLabel="Edit"
                leftIcon="✎"
                leftTone="amber"
                onDoubleTap={() => {
                  playTick()
                  setShowAdjustModal(true)
                }}
                style={{ borderRadius: 12, marginBottom: 8 }}
              >
                <div className={bStyles.categoryRow}>
                  <div className={bStyles.categoryRowHeader}>
                    <span className={bStyles.categoryName}>{item.cat}</span>
                    <div className={bStyles.categoryAmounts}>
                      <span className={bStyles.categoryVal}>{money(item.amount)}</span>
                      <span className={bStyles.categoryPct}>{item.pct}%</span>
                    </div>
                  </div>
                  <div className={bStyles.categoryTrack}>
                    <div
                      className={bStyles.categoryFill}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              </SwipeableCard>
            ))}
          </div>
        </div>
      )}

      {/* 3. RECENT EXPENSES */}
      {monthExpensesList.length > 0 && (
        <div className={bStyles.surfaceCard}>
          <div className={bStyles.sectionHeader}>
            <div>
              <div className={bStyles.sectionTitle}>Recent Budget Outflows</div>
              <div className={bStyles.sectionSub}>Tracked expenses in {monthLabel}</div>
            </div>
            <span className={bStyles.totalSpendBadge}>
              {monthExpensesList.length} Transactions
            </span>
          </div>

          <div className={bStyles.expenseList}>
            {monthExpensesList.slice(0, 8).map((tx, idx) => (
              <div key={(tx._id || tx.id || 'b') + idx} className={bStyles.expenseRow}>
                <div className={bStyles.expenseMain}>
                  <div className={bStyles.expenseDesc}>{tx.desc || tx.cat || 'Expense'}</div>
                  <div className={bStyles.expenseMeta}>
                    <span>{tx.cat}</span>
                    <span>·</span>
                    <span>{tx.date}</span>
                  </div>
                </div>
                <div className={bStyles.expenseAmount}>
                  −{money(tx.amount || 0)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADJUST BUDGET MODAL */}
      {showAdjustModal && typeof document !== 'undefined' && createPortal(
        <div className={bStyles.modalOverlay} onClick={() => setShowAdjustModal(false)}>
          <div className={bStyles.modalCard} onClick={e => e.stopPropagation()}>
            <div className={bStyles.modalHeader}>
              <div>
                <div className={bStyles.modalEyebrow}>Monthly Target</div>
                <h3 className={bStyles.modalTitle}>Adjust Monthly Budget</h3>
              </div>
              <button
                type="button"
                className={bStyles.modalClose}
                onClick={() => setShowAdjustModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className={bStyles.modalBody}>
              <div className={bStyles.field}>
                <label className={bStyles.fieldLabel} htmlFor="budget-amount">
                  Monthly Limit ({s})
                </label>
                <input
                  id="budget-amount"
                  className={bStyles.fieldInputBig}
                  type="number"
                  step="any"
                  min="1"
                  placeholder="e.g. 20000"
                  value={adjustAmount}
                  onChange={e => setAdjustAmount(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              {/* Quick Presets */}
              <div className={bStyles.presetSection}>
                <div className={bStyles.fieldLabel}>Quick Presets</div>
                <div className={bStyles.presetGrid}>
                  {BUDGET_PRESETS.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      className={`${bStyles.presetBtn} ${Number(adjustAmount) === preset ? bStyles.presetBtnActive : ''}`}
                      onClick={() => setAdjustAmount(String(preset))}
                    >
                      {fmt(preset, s)}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={bStyles.presetBtn}
                    onClick={() => setAdjustAmount(a => String((Number(a) || 0) + 5000))}
                  >
                    +5k
                  </button>
                </div>
              </div>

              <div className={bStyles.modalActions}>
                <button
                  type="button"
                  className={bStyles.btnSecondary}
                  onClick={() => setShowAdjustModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBudget}
                  className={bStyles.btnPrimary}
                >
                  {savingBudget ? 'Saving...' : 'Save Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )

  return hideHeader ? mainContent : <div className={`${styles.page} ${bStyles.budgetPage}`}>{mainContent}</div>
}
