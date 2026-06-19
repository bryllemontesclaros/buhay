import { useMemo, useState } from 'react'
import GamificationCard from '../components/GamificationCard'
import { fsAdd, fsDel, fsUpdate } from '../lib/firestore'
import { confirmDeleteApp, notifyApp } from '../lib/appFeedback'
import { isTransactionPaid } from '../lib/finance'
import { getTransactionCategories } from '../lib/transactionOptions'
import { displayValue, fmt, isSameMonth, maskMoney } from '../lib/utils'
import styles from './Page.module.css'
import bStyles from './Budget.module.css'

const EXPENSE_CATS = getTransactionCategories('expense')

export default function Budget({ user, data, profile = {}, symbol, privacyMode = false, gamification }) {
  const s = symbol || '₱'
  const now = new Date()
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [form, setForm] = useState({ cat: 'Food & Dining', limit: '' })
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
    const map = {}
    data.expenses.filter(tx => isTransactionPaid(tx) && isSameMonth(tx.date, viewYear, viewMonth)).forEach(tx => {
      map[tx.cat] = (map[tx.cat] || 0) + (tx.amount || 0)
    })
    return map
  }, [data.expenses, viewMonth, viewYear])

  const totalExpenses = Object.values(spending).reduce((sum, value) => sum + value, 0)
  const totalBudget = budgets.reduce((sum, budget) => sum + (budget.limit || 0), 0)
  const totalRemaining = totalBudget - totalExpenses
  const usagePct = totalBudget > 0 ? Math.min(100, Math.round((totalExpenses / totalBudget) * 100)) : 0
  const money = value => displayValue(privacyMode, fmt(value, s), maskMoney(s))

  async function handleAddBudget() {
    if (!form.cat || !form.limit) {
      notifyApp({ title: 'Budget needs a limit', message: 'Choose a category and monthly limit before saving.', tone: 'warning' })
      return
    }
    const limit = Number(form.limit)
    if (!Number.isFinite(limit) || limit <= 0) {
      notifyApp({ title: 'Check budget limit', message: 'Monthly limit must be greater than zero.', tone: 'warning' })
      return
    }
    const existing = budgets.find(budget => budget.cat === form.cat)
    if (existing) {
      await fsUpdate(user.uid, 'budgets', existing._id, { limit })
    } else {
      await fsAdd(user.uid, 'budgets', { cat: form.cat, limit })
    }
    setForm(current => ({ ...current, limit: '' }))
  }

  async function handleDelBudget(id) {
    if (!(await confirmDeleteApp('this budget'))) return
    await fsDel(user.uid, 'budgets', id)
  }

  const budgetItems = useMemo(() => {
    return budgets
      .map(budget => {
        const spent = spending[budget.cat] || 0
        const remaining = budget.limit - spent
        const pct = budget.limit > 0 ? Math.min(100, Math.round((spent / budget.limit) * 100)) : 0
        const status = pct >= 100 ? 'over' : pct >= 80 ? 'warning' : 'ok'
        return { ...budget, spent, remaining, pct, status }
      })
      .sort((a, b) => b.pct - a.pct)
  }, [budgets, spending])

  const unbudgeted = useMemo(() => {
    const budgetedCats = new Set(budgets.map(budget => budget.cat))
    const map = {}
    data.expenses.filter(tx => isTransactionPaid(tx) && isSameMonth(tx.date, viewYear, viewMonth) && !budgetedCats.has(tx.cat)).forEach(tx => {
      map[tx.cat] = (map[tx.cat] || 0) + (tx.amount || 0)
    })
    return Object.entries(map).map(([cat, amount]) => ({ cat, amount })).sort((a, b) => b.amount - a.amount)
  }, [data.expenses, budgets, viewMonth, viewYear])

  const statusColor = { ok: 'var(--accent)', warning: 'var(--amber)', over: 'var(--red)' }
  const topBudget = budgetItems[0] || null

  return (
    <div className={`${styles.page} ${bStyles.budgetPage}`}>
      <div className={bStyles.heroSection}>
        <div className={bStyles.heroCopy}>
          <div className={bStyles.pageEyebrow}>Budget</div>
          <div className={bStyles.pageTitle}>Use budgets as guide rails, not punishment.</div>
          <div className={bStyles.pageSub}>
            Keep category limits, actual spending, and unplanned pressure in one monthly view so nothing sneaks up on you.
          </div>
        </div>

        <div className={bStyles.heroAside}>
          <div className={bStyles.heroAsideLabel}>{topBudget ? 'Most pressured' : 'Current month'}</div>
          <div className={bStyles.heroAsideValue}>{topBudget ? topBudget.cat : monthLabel}</div>
          <div className={bStyles.heroAsideTrack}>
            <div
              className={bStyles.heroAsideFill}
              style={{ width: `${topBudget ? topBudget.pct : usagePct}%`, background: topBudget ? statusColor[topBudget.status] : 'var(--accent)' }}
            />
          </div>
          <div className={bStyles.heroAsideMeta}>
            {topBudget
              ? `${displayValue(privacyMode, `${topBudget.pct}% used`, 'Usage hidden')} · ${topBudget.remaining >= 0 ? `${money(topBudget.remaining)} left` : `Over by ${money(Math.abs(topBudget.remaining))}`}`
              : 'Add a budget to start tracking category pressure.'}
          </div>
        </div>
      </div>

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

      <div className={bStyles.gamificationWrap}>
        <GamificationCard
          gamification={gamification}
          privacyMode={privacyMode}
          compact
          title="Buhay progress"
          message="Takda, Lakas, and Tala all feed the same level, streak, and EXP now."
        />
      </div>

      <div className={bStyles.monthBar}>
        <button type="button" className={bStyles.navBtn} onClick={prevMonth}>←</button>
        <div className={bStyles.monthLabel}>{monthLabel}</div>
        <button type="button" className={bStyles.navBtn} onClick={nextMonth}>→</button>
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
            <div className={bStyles.sectionTitle}>Set category limit</div>
            <div className={bStyles.sectionCopy}>Create or update a monthly limit without leaving the page.</div>
          </div>
        </div>
        <div className={bStyles.composerGrid}>
          <div className={bStyles.field}>
            <label className={bStyles.fieldLabel}>Category</label>
            <select className={bStyles.fieldInput} value={form.cat} onChange={event => setForm(current => ({ ...current, cat: event.target.value }))}>
              {EXPENSE_CATS.map(cat => <option key={cat}>{cat}</option>)}
            </select>
          </div>
          <div className={bStyles.field}>
            <label className={bStyles.fieldLabel}>Monthly limit ({s})</label>
            <input className={bStyles.fieldInput} type="number" min="0" inputMode="decimal" placeholder="e.g. 5000" value={form.limit} onChange={event => setForm(current => ({ ...current, limit: event.target.value }))} />
          </div>
          <div className={bStyles.field}>
            <button type="button" className={bStyles.primaryButton} onClick={handleAddBudget}>Save budget</button>
          </div>
        </div>
      </div>

      {!budgetItems.length ? (
        <div className={bStyles.emptyCard}>
          <div className={bStyles.emptyTitle}>No budgets yet</div>
          <div className={bStyles.emptyBody}>Add one above to start reading monthly pressure by category.</div>
        </div>
      ) : budgetItems.map(item => (
        <div key={item._id} className={bStyles.budgetCard} style={{ borderColor: item.status === 'over' ? 'rgba(255,83,112,0.4)' : item.status === 'warning' ? 'rgba(255,179,71,0.3)' : 'var(--border)' }}>
          {item.status === 'over' && (
            <div className={bStyles.alertBanner} style={{ background: 'var(--red-dim)', color: 'var(--red)' }}>
              Over budget by {money(Math.abs(item.remaining))}
            </div>
          )}
          {item.status === 'warning' && (
            <div className={bStyles.alertBanner} style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>
              {money(item.remaining)} left before you hit the limit
            </div>
          )}

          <div className={bStyles.budgetHeader}>
            <div className={bStyles.budgetCat}>{item.cat}</div>
            <div className={bStyles.budgetHeaderRight}>
              <span className={bStyles.budgetSpent} style={{ color: statusColor[item.status] }}>{money(item.spent)}</span>
              <span className={bStyles.budgetLimit}>/ {money(item.limit)}</span>
              <button type="button" className={bStyles.deleteBtn} onClick={() => handleDelBudget(item._id)}>Delete</button>
            </div>
          </div>

          <div className={bStyles.budgetTrack}>
            <div className={bStyles.budgetFill} style={{ width: `${item.pct}%`, background: statusColor[item.status] }} />
          </div>

          <div className={bStyles.budgetMeta}>
            <span>{displayValue(privacyMode, `${item.pct}% used`, 'Usage hidden')}</span>
            <span className={bStyles.budgetRemaining} style={{ color: item.remaining >= 0 ? statusColor[item.status] : 'var(--red)' }}>
              {item.remaining >= 0 ? `${money(item.remaining)} left` : `Over by ${money(Math.abs(item.remaining))}`}
            </span>
          </div>
        </div>
      ))}

      {unbudgeted.length > 0 && (
        <div className={bStyles.surfaceCard}>
          <div className={bStyles.sectionHeader}>
            <div className={bStyles.sectionTitle}>Unbudgeted spending</div>
          </div>
          {unbudgeted.map((item, index) => (
            <div key={index} className={bStyles.unbudgetedRow}>
              <span className={bStyles.unbudgetedCat}>{item.cat}</span>
              <span className={bStyles.unbudgetedValue}>{money(item.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
