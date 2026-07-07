import { useMemo, useState } from 'react'
import { fsAdd, fsDel } from '../lib/firestore'
import { notifyApp } from '../lib/appFeedback'
import { isTransactionPaid } from '../lib/finance'
import { displayValue, fmt, isSameMonth, maskMoney, playTick } from '../lib/utils'
import styles from './Page.module.css'
import bStyles from './Budget.module.css'
export default function Budget({ user, data, profile = {}, symbol, privacyMode = false, hideHeader = false }) {
  const s = symbol || '₱'
  const now = new Date()
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [form, setForm] = useState({ limit: '' })
  const budgets = data.budgets || []

  const monthLabel = new Date(viewYear, viewMonth).toLocaleString('default', { month: 'long', year: 'numeric' })

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

  const spending = useMemo(() => {
    let sum = 0
    data.expenses.filter(tx => isTransactionPaid(tx) && isSameMonth(tx.date, viewYear, viewMonth)).forEach(tx => {
      sum += (tx.amount || 0)
    })
    return sum
  }, [data.expenses, viewMonth, viewYear])

  const totalExpenses = spending
  const totalBudget = budgets.reduce((sum, budget) => sum + (budget.limit || 0), 0)
  const totalRemaining = totalBudget - totalExpenses
  const usagePct = totalBudget > 0 ? Math.min(100, Math.round((totalExpenses / totalBudget) * 100)) : 0
  const money = value => displayValue(privacyMode, fmt(value, s), maskMoney(s))

  async function handleAddBudget() {
    if (!form.limit) {
      notifyApp({ title: 'Budget needs a limit', message: 'Enter a monthly limit before saving.', tone: 'warning' })
      return
    }
    const limit = Number(form.limit)
    if (!Number.isFinite(limit) || limit <= 0) {
      notifyApp({ title: 'Check budget limit', message: 'Monthly limit must be greater than zero.', tone: 'warning' })
      return
    }
    // Remove old category-based budgets and set the single global limit
    for (const b of budgets) {
      await fsDel(user.uid, 'budgets', b._id)
    }
    await fsAdd(user.uid, 'budgets', { cat: 'global', limit })
    setForm({ limit: '' })
    notifyApp({ title: 'Budget set', message: 'Your monthly budget has been updated.', tone: 'success' })
  }



  const mainContent = (
    <>
      {!hideHeader && (
        <div className={bStyles.heroSection}>
        <div className={bStyles.heroCopy}>
          <div className={bStyles.pageEyebrow}>Budget</div>
          <div className={bStyles.pageTitle}>Use budgets as guide rails, not punishment.</div>
          <div className={bStyles.pageSub}>
            Keep category limits, actual spending, and unplanned pressure in one monthly view so nothing sneaks up on you.
          </div>
        </div>

        <div className={bStyles.heroAside}>
          <div className={bStyles.heroAsideLabel}>Current month</div>
          <div className={bStyles.heroAsideValue}>{monthLabel}</div>
          <div className={bStyles.heroAsideTrack}>
            <div
              className={bStyles.heroAsideFill}
              style={{ width: `${usagePct}%`, background: totalExpenses > totalBudget ? 'var(--red)' : 'var(--accent)' }}
            />
          </div>
          <div className={bStyles.heroAsideMeta}>
            {totalBudget > 0
              ? `${displayValue(privacyMode, `${usagePct}% used`, 'Usage hidden')} · ${totalRemaining >= 0 ? `${money(totalRemaining)} left` : `Over by ${money(Math.abs(totalRemaining))}`}`
              : 'Set a budget limit to track progress.'}
          </div>
        </div>
      </div>
      )}

      <div className={bStyles.summaryGrid}>
        <div className={bStyles.summaryCard}>
          <div className={bStyles.summaryLabel}>Total budget</div>
          <div className={`${bStyles.summaryValue} ${bStyles.summaryValueBlue}`}>{money(totalBudget)}</div>
          <div className={bStyles.summaryMeta}>Budgeted for this month</div>
        </div>
        <div className={bStyles.summaryCard}>
          <div className={bStyles.summaryLabel}>Spent</div>
          <div className={`${bStyles.summaryValue} ${bStyles.summaryValueRed}`}>{money(totalExpenses)}</div>
          <div className={bStyles.summaryMeta}>Tracked this month</div>
        </div>
        <div className={bStyles.summaryCard}>
          <div className={bStyles.summaryLabel}>Remaining</div>
          <div className={`${bStyles.summaryValue} ${totalRemaining >= 0 ? bStyles.summaryValueAccent : bStyles.summaryValueRed}`}>{money(totalRemaining)}</div>
          <div className={bStyles.summaryMeta}>{totalRemaining >= 0 ? 'Still available this month' : 'Over plan; trim the category or adjust the limit'}</div>
        </div>
      </div>



      <div className={bStyles.monthBar}>
        <button type="button" className={bStyles.navBtn} onClick={() => { playTick(); prevMonth(); }}>←</button>
        <div className={bStyles.monthLabel}>{monthLabel}</div>
        <button type="button" className={bStyles.navBtn} onClick={() => { playTick(); nextMonth(); }}>→</button>
      </div>

      {totalBudget > 0 && (
        <div className={bStyles.surfaceCard}>
          <div className={bStyles.sectionHeader}>
            <div className={bStyles.sectionTitle}>Total budget usage</div>
            <div className={bStyles.sectionMeta}>{displayValue(privacyMode, `${usagePct}% used`, 'Usage hidden')}</div>
          </div>
          <div className={bStyles.usageMetaRow}>
            <span>{displayValue(privacyMode, `${fmt(totalExpenses, s)} spent`, `${maskMoney(s)} spent`)}</span>
            <span>{displayValue(privacyMode, `${fmt(totalBudget, s)} budget`, `${maskMoney(s)} budget`)}</span>
          </div>
          <div className={bStyles.usageTrack}>
            <div
              className={bStyles.usageFill}
              style={{
                width: `${usagePct}%`,
                background: totalExpenses > totalBudget ? 'var(--red)' : totalExpenses / totalBudget > 0.8 ? 'var(--amber)' : 'var(--accent)',
              }}
            />
          </div>
          <div className={bStyles.usageNote}>
            {totalExpenses > totalBudget ? 'Spending is past the total budget.' : 'This shows how far the month has moved through the budget.'}
          </div>
        </div>
      )}

      <div className={bStyles.composerCard}>
        <div className={bStyles.sectionHeader}>
          <div>
            <div className={bStyles.sectionTitle}>Set monthly budget</div>
            <div className={bStyles.sectionCopy}>Update your global monthly limit.</div>
          </div>
        </div>
        <div className={bStyles.composerGrid}>
          <div className={bStyles.field}>
            <label className={bStyles.fieldLabel}>Monthly limit ({s})</label>
            <input className={bStyles.fieldInput} type="number" min="0" inputMode="decimal" placeholder="e.g. 5000" value={form.limit} onChange={event => setForm(current => ({ ...current, limit: event.target.value }))} />
          </div>
          <div className={bStyles.field}>
            <button type="button" className={bStyles.primaryButton} onClick={() => { playTick(); handleAddBudget(); }}>Save budget</button>
          </div>
        </div>
      </div>

    </>
  )

  return hideHeader ? mainContent : <div className={`${styles.page} ${bStyles.budgetPage}`}>{mainContent}</div>
}
