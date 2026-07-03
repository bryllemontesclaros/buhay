import { useEffect, useMemo, useRef, useState } from 'react'
import { fsAdd, fsDel, fsUpdate, fsAddTransaction } from '../lib/firestore'
import { calculatePayoffSchedule } from '../lib/debts'
import { confirmApp, notifyApp } from '../lib/appFeedback'
import { displayValue, fmt, maskMoney, playTick, today } from '../lib/utils'
import { safeScrollIntoView } from '../lib/ui'
import styles from './Page.module.css'
import dStyles from './Debts.module.css'

const DEBT_TYPES = ['Credit Card', 'Loan', 'Informal']
const DEBT_ICONS = { 'Credit Card': '💳', Loan: '🏦', Informal: '🏷' }
const COLORS = [
  { name: 'Red', value: 'var(--red)' },
  { name: 'Amber', value: 'var(--amber)' },
  { name: 'Blue', value: 'var(--blue)' },
  { name: 'Green', value: 'var(--accent)' },
  { name: 'Purple', value: 'var(--purple)' },
  { name: 'Teal', value: 'var(--teal)' },
  { name: 'Pink', value: 'var(--rose)' },
  { name: 'Gray', value: 'var(--text3)' },
]

const EMPTY_FORM = {
  name: '',
  type: 'Credit Card',
  balance: '',
  originalAmount: '',
  interestRate: '',
  minPayment: '',
  dueDate: '',
  color: 'var(--red)',
  contactName: '',
  notes: '',
  accountId: '',
}

export default function Debts({ user, data, symbol, privacyMode = false }) {
  const s = symbol || '₱'
  const debts = data.debts || []
  
  const [extraBudget, setExtraBudget] = useState(0)
  const [strategy, setStrategy] = useState('avalanche')
  const [form, setForm] = useState(EMPTY_FORM)
  const [editDebt, setEditDebt] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [payments, setPayments] = useState({})
  
  const editorRef = useRef(null)

  function set(key, value) {
    setForm(current => ({ ...current, [key]: value }))
  }

  function openAdd() {
    setEditDebt(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(debt) {
    setEditDebt(debt)
    setForm({
      name: debt.name || '',
      type: debt.type || 'Credit Card',
      balance: debt.balance || '',
      originalAmount: debt.originalAmount || '',
      interestRate: debt.interestRate || '',
      minPayment: debt.minPayment || '',
      dueDate: debt.dueDate || '',
      color: debt.color || 'var(--red)',
      contactName: debt.contactName || '',
      notes: debt.notes || '',
      accountId: debt.accountId || '',
    })
    setShowModal(true)
  }

  function closeEditor() {
    setShowModal(false)
    setEditDebt(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave() {
    const isCreditCardLinked = form.type === 'Credit Card' && form.accountId
    if (!form.name || (!isCreditCardLinked && form.balance === '') || form.minPayment === '') {
      notifyApp({
        title: 'Debt needs details',
        message: 'Add a name, balance, and minimum monthly payment before saving.',
        tone: 'warning',
      })
      return
    }

    const linkedAcc = isCreditCardLinked ? (data.accounts || []).find(a => a._id === form.accountId) : null
    const balanceVal = isCreditCardLinked && linkedAcc
      ? Math.abs(parseFloat(linkedAcc.balance) || 0)
      : (parseFloat(form.balance) || 0)
    const originalVal = parseFloat(form.originalAmount) || balanceVal
    const rateVal = parseFloat(form.interestRate) || 0
    const minVal = parseFloat(form.minPayment) || 0

    if (balanceVal <= 0) {
      notifyApp({ title: 'Check balance', message: 'Current balance must be greater than zero.', tone: 'warning' })
      return
    }
    if (minVal <= 0) {
      notifyApp({ title: 'Check minimum payment', message: 'Minimum payment must be greater than zero.', tone: 'warning' })
      return
    }

    const payload = {
      name: form.name,
      type: form.type,
      balance: balanceVal,
      originalAmount: originalVal,
      interestRate: rateVal,
      minPayment: minVal,
      dueDate: form.dueDate,
      color: form.color,
      contactName: form.contactName || '',
      notes: form.notes || '',
      accountId: form.type === 'Credit Card' ? form.accountId : '',
    }

    try {
      if (editDebt) {
        await fsUpdate(user.uid, 'debts', editDebt._id, payload)
        notifyApp({ title: 'Debt updated', message: `${form.name} changes have been saved.`, tone: 'success' })
      } else {
        await fsAdd(user.uid, 'debts', payload)
        notifyApp({ title: 'Debt added', message: `${form.name} has been added to your payoff stack.`, tone: 'success' })
      }
      closeEditor()
    } catch {
      notifyApp({ title: 'Operation failed', message: 'Could not save debt details. Try again.', tone: 'error' })
    }
  }

  async function handleDel(id, name) {
    const confirmed = await confirmApp({
      title: 'Delete debt details?',
      message: `Are you sure you want to delete ${name}? This will remove it from net worth and payoff simulations permanently.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Keep',
      tone: 'danger',
    })
    if (!confirmed) return
    try {
      await fsDel(user.uid, 'debts', id)
      notifyApp({ title: 'Debt deleted', message: `${name} has been removed.`, tone: 'success' })
    } catch {
      notifyApp({ title: 'Delete failed', message: 'Could not remove this debt. Try again.', tone: 'error' })
    }
  }

  const accounts = data.accounts || []
  const creditCardAccounts = accounts.filter(a => a.type === 'Credit Card')

  const mappedDebts = useMemo(() => {
    return debts.map(d => {
      if (d.accountId) {
        const linkedAcc = accounts.find(a => a._id === d.accountId)
        if (linkedAcc) {
          return {
            ...d,
            balance: Math.abs(Number(linkedAcc.balance) || 0),
          }
        }
      }
      return d
    })
  }, [debts, accounts])

  async function handlePayment(debt) {
    const value = parseFloat(payments[debt._id] || 0)
    if (!Number.isFinite(value) || value <= 0) {
      notifyApp({ title: 'Check payment', message: 'Add a payment amount greater than zero.', tone: 'warning' })
      return
    }

    try {
      if (debt.accountId) {
        await fsAddTransaction(user.uid, 'income', {
          desc: `CC Payment: ${debt.name}`,
          amount: value,
          date: today(),
          cat: 'Debts',
          subcat: 'Credit Card Payment',
          accountId: debt.accountId,
          accountBalanceLinked: true,
          accountBalanceApplied: true,
          type: 'income'
        }, data.accounts || [])
      } else {
        const newBalance = Math.max(0, (debt.balance || 0) - value)
        await fsUpdate(user.uid, 'debts', debt._id, { balance: newBalance })
      }
      setPayments(current => ({ ...current, [debt._id]: '' }))
      notifyApp({
        title: 'Payment logged',
        message: `Paid ${fmt(value, s)} toward ${debt.name}.`,
        tone: 'success',
      })
    } catch {
      notifyApp({ title: 'Payment failed', message: 'Could not record transaction. Try again.', tone: 'error' })
    }
  }

  const activeDebtsCount = mappedDebts.filter(d => (d.balance || 0) > 0).length
  const totalDebtOwed = mappedDebts.reduce((sum, d) => sum + (Number(d.balance) || 0), 0)

  // Calculations for current payoff schedule
  const schedule = useMemo(() => {
    return calculatePayoffSchedule(mappedDebts, extraBudget, strategy)
  }, [mappedDebts, extraBudget, strategy])

  // Comparison logic (Avalanche vs Snowball)
  const avalancheComparison = useMemo(() => {
    return calculatePayoffSchedule(mappedDebts, extraBudget, 'avalanche')
  }, [mappedDebts, extraBudget])

  const snowballComparison = useMemo(() => {
    return calculatePayoffSchedule(mappedDebts, extraBudget, 'snowball')
  }, [mappedDebts, extraBudget])

  // Calculations for baseline (no extra budget payoff)
  const baselineSchedule = useMemo(() => {
    return calculatePayoffSchedule(mappedDebts, 0, strategy)
  }, [mappedDebts, strategy])

  const money = value => displayValue(privacyMode, fmt(value, s), maskMoney(s))

  // Weighted average interest rate calculations
  const weightedAvgRate = useMemo(() => {
    if (totalDebtOwed === 0) return 0
    const weightedSum = mappedDebts.reduce((sum, d) => sum + (Number(d.balance) || 0) * (Number(d.interestRate) || 0), 0)
    return Math.round((weightedSum / totalDebtOwed) * 10) / 10
  }, [mappedDebts, totalDebtOwed])

  // Dynamic SVG line/area calculations for the timeline graph
  const { chartPoints, areaPoints } = useMemo(() => {
    if (!schedule?.timeline || schedule.timeline.length < 2) {
      return { chartPoints: '', areaPoints: '' }
    }
    const timeline = schedule.timeline
    const maxVal = Math.max(...timeline.map(t => t.totalOwed), 1)
    const width = 500
    const height = 120
    
    const points = timeline.map((t, idx) => {
      const x = (idx / (timeline.length - 1)) * width
      const y = height - (t.totalOwed / maxVal) * (height - 15) - 5
      return `${x},${y}`
    })

    const chartPointsStr = points.join(' ')
    const areaPointsStr = `0,120 ${chartPointsStr} 500,120`
    return { chartPoints: chartPointsStr, areaPoints: areaPointsStr }
  }, [schedule])

  // Calculate savings compared to baseline (paying only minimums)
  const interestSaved = Math.max(0, (baselineSchedule?.totalInterest || 0) - (schedule?.totalInterest || 0))
  const monthsSaved = Math.max(0, (baselineSchedule?.months || 0) - (schedule?.months || 0))

  useEffect(() => {
    if (showModal && editorRef.current) {
      safeScrollIntoView(editorRef.current, { behavior: 'smooth', block: 'start' })
    }
  }, [showModal, editDebt?._id])

  return (
    <div className={`${styles.page} ${dStyles.debtsPage}`}>
      {/* Hero Header */}
      <div className={dStyles.heroSection}>
        <div className={dStyles.heroCopy}>
          <div className={dStyles.pageEyebrow}>Plan · Debts</div>
          <div className={dStyles.pageTitle}>Take command of what you owe.</div>
          <div className={dStyles.pageSub}>
            Visualize payoff dates, simulate Snowball vs. Avalanche strategies, and see exactly when you will reach complete freedom.
          </div>
        </div>

        <div
          className={dStyles.heroAside}
          style={{ '--debt-tone': editDebt?.color || 'var(--red)' }}
        >
          <div className={dStyles.heroAsideLabel}>Weighted Avg Interest</div>
          <div className={dStyles.heroAsideValue}>
            {weightedAvgRate}% <small style={{ fontSize: 13, color: 'var(--text3)' }}>APR</small>
          </div>
          <div className={dStyles.heroAsideMeta}>
            Across {activeDebtsCount} active loan{activeDebtsCount === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* Main Totals */}
      <div className={dStyles.totalCard}>
        <div className={dStyles.totalLabel}>Total Outstanding Debt</div>
        <div className={dStyles.totalVal}>{money(totalDebtOwed)}</div>
        <div className={dStyles.totalSub}>
          {schedule.error ? (
            <span className={dStyles.growWarning}>⚠️ {schedule.error}</span>
          ) : schedule.payoffDate ? (
            `Projected Debt-Free: ${schedule.payoffDate.toLocaleString('default', { month: 'long', year: 'numeric' })} (${schedule.months} months)`
          ) : (
            'Add outstanding balances to simulate payoff targets.'
          )}
        </div>
      </div>

      {/* Strategy Optimizer & Simulator */}
      {activeDebtsCount > 0 && (
        <div className={dStyles.optimizerCard}>
          <div className={dStyles.optimizerHeader}>
            <div>
              <div className={dStyles.sectionTitle}>Smart Payoff Simulator</div>
              <div className={dStyles.sectionSub}>Allocate extra monthly cash to speed up payoff time and save interest.</div>
            </div>
            <div className={dStyles.strategySelectors}>
              <button
                type="button"
                className={`${dStyles.strategyBtn} ${strategy === 'avalanche' ? dStyles.strategyBtnActive : ''}`}
                onClick={() => { playTick(); setStrategy('avalanche'); }}
              >
                Avalanche (APR)
              </button>
              <button
                type="button"
                className={`${dStyles.strategyBtn} ${strategy === 'snowball' ? dStyles.strategyBtnActive : ''}`}
                onClick={() => { playTick(); setStrategy('snowball'); }}
              >
                Snowball (Balance)
              </button>
            </div>
          </div>

          <div className={dStyles.simulatorGrid}>
            <div className={dStyles.sliderBox}>
              <div className={dStyles.sliderLabelRow}>
                <span>Extra Monthly Payment</span>
                <strong className={dStyles.sliderVal}>{money(extraBudget)}</strong>
              </div>
              <input
                type="range"
                className={dStyles.sliderRange}
                min="0"
                max="50000"
                step="500"
                value={extraBudget}
                onChange={event => setExtraBudget(Number(event.target.value))}
              />
              <div className={dStyles.sliderMinMax}>
                <span>{s}0</span>
                <span>{s}50,000+</span>
              </div>
            </div>

            <div className={dStyles.adviceBox}>
              <div className={dStyles.adviceRow}>
                <span className={dStyles.adviceLabel}>Strategy recommendation:</span>
                <span className={dStyles.adviceValue}>
                  {avalancheComparison.totalInterest < snowballComparison.totalInterest
                    ? 'Avalanche is mathematically optimal'
                    : 'Snowball for quick motivational wins'}
                </span>
              </div>
              <div className={dStyles.adviceMetrics}>
                <div className={dStyles.metricCol}>
                  <div className={dStyles.metricNum}>{monthsSaved}</div>
                  <div className={dStyles.metricLbl}>Months saved</div>
                </div>
                <div className={dStyles.metricCol}>
                  <div className={dStyles.metricNum}>{money(interestSaved)}</div>
                  <div className={dStyles.metricLbl}>Interest saved</div>
                </div>
              </div>
            </div>
          </div>

          {/* SVG Payoff Timeline */}
          {chartPoints && (
            <div className={dStyles.chartContainer}>
              <div className={dStyles.chartHeader}>
                <span>Debt payoff timeline</span>
                <span>{schedule.months} months</span>
              </div>
              <div className={dStyles.svgWrapper}>
                <svg viewBox="0 0 500 120" className={dStyles.chartSvg} preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <polyline
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2.5"
                    points={chartPoints}
                  />
                  <polygon
                    fill="url(#chartGrad)"
                    points={areaPoints}
                  />
                </svg>
              </div>
              <div className={dStyles.chartFooter}>
                <span>Now ({money(totalDebtOwed)})</span>
                <span>{schedule.payoffDate?.toLocaleString('default', { month: 'short', year: 'numeric' })} ({s}0)</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className={dStyles.toolbar}>
        <div className={dStyles.toolbarCopy}>
          <div className={dStyles.toolbarTitle}>Payoff Stack</div>
          <div className={dStyles.toolbarMeta}>
            Keep track of individual accounts, interest rates, and log payments directly below.
          </div>
        </div>
        <button type="button" className={dStyles.primaryButton} onClick={openAdd}>Add debt</button>
      </div>

      {/* Debt Add/Edit Modal */}
      {showModal && (
        <div ref={editorRef} className={dStyles.editorCard}>
          <div className={dStyles.editorHeader}>
            <div>
              <div className={dStyles.editorEyebrow}>{editDebt ? 'Editing Debt' : 'New Debt'}</div>
              <div className={dStyles.editorTitle}>{editDebt ? 'Update debt record' : 'Add to your stack'}</div>
            </div>
            <button type="button" onClick={closeEditor} className={dStyles.editorClose}>Close</button>
          </div>

          <div className={dStyles.editorGrid}>
            <div className={dStyles.field}>
              <label className={dStyles.fieldLabel} htmlFor="debt-name">Debt Name</label>
              <input
                id="debt-name"
                className={dStyles.fieldInput}
                placeholder="e.g. UnionBank Credit Card"
                value={form.name}
                onChange={event => set('name', event.target.value)}
              />
            </div>

            <div className={dStyles.field}>
              <label className={dStyles.fieldLabel} htmlFor="debt-type">Debt Type</label>
              <select
                id="debt-type"
                className={dStyles.fieldInput}
                value={form.type}
                onChange={event => {
                  set('type', event.target.value)
                  if (event.target.value !== 'Credit Card') {
                    set('accountId', '')
                  }
                }}
              >
                {DEBT_TYPES.map(type => <option key={type}>{type}</option>)}
              </select>
            </div>

            {form.type === 'Credit Card' && (
              <div className={dStyles.field}>
                <label className={dStyles.fieldLabel} htmlFor="debt-account">Link to Credit Card Account</label>
                <select
                  id="debt-account"
                  className={dStyles.fieldInput}
                  value={form.accountId}
                  onChange={event => {
                    const linkedId = event.target.value
                    const linkedAcc = creditCardAccounts.find(a => a._id === linkedId)
                    set('accountId', linkedId)
                    if (linkedAcc) {
                      set('balance', Math.abs(Number(linkedAcc.balance) || 0))
                    }
                  }}
                >
                  <option value="">None (manual entry)</option>
                  {creditCardAccounts.map(acc => (
                    <option key={acc._id} value={acc._id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={dStyles.field}>
              <label className={dStyles.fieldLabel} htmlFor="debt-balance">Current Balance ({s})</label>
              <input
                id="debt-balance"
                className={dStyles.fieldInput}
                type="number"
                min="0"
                inputMode="decimal"
                placeholder="0.00"
                value={form.accountId && form.type === 'Credit Card' ? (creditCardAccounts.find(a => a._id === form.accountId)?.balance || '') : form.balance}
                disabled={Boolean(form.type === 'Credit Card' && form.accountId)}
                onChange={event => set('balance', event.target.value)}
              />
              {form.type === 'Credit Card' && form.accountId && (
                <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 4 }}>
                  Balance is automatically synced from your linked credit card account.
                </div>
              )}
            </div>

            <div className={dStyles.field}>
              <label className={dStyles.fieldLabel} htmlFor="debt-original">Original Loan Amount ({s})</label>
              <input
                id="debt-original"
                className={dStyles.fieldInput}
                type="number"
                min="0"
                inputMode="decimal"
                placeholder="Defaults to current balance"
                value={form.originalAmount}
                onChange={event => set('originalAmount', event.target.value)}
              />
            </div>

            <div className={dStyles.field}>
              <label className={dStyles.fieldLabel} htmlFor="debt-rate">Interest Rate (% APR)</label>
              <input
                id="debt-rate"
                className={dStyles.fieldInput}
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={form.interestRate}
                onChange={event => set('interestRate', event.target.value)}
              />
            </div>

            <div className={dStyles.field}>
              <label className={dStyles.fieldLabel} htmlFor="debt-min">Minimum Monthly Payment ({s})</label>
              <input
                id="debt-min"
                className={dStyles.fieldInput}
                type="number"
                min="0"
                inputMode="decimal"
                placeholder="0.00"
                value={form.minPayment}
                onChange={event => set('minPayment', event.target.value)}
              />
            </div>

            <div className={dStyles.field}>
              <label className={dStyles.fieldLabel} htmlFor="debt-due">Due Day of Month</label>
              <input
                id="debt-due"
                className={dStyles.fieldInput}
                type="number"
                min="1"
                max="31"
                placeholder="e.g. 15"
                value={form.dueDate}
                onChange={event => set('dueDate', event.target.value)}
              />
            </div>

            {form.type === 'Informal' && (
              <div className={dStyles.field}>
                <label className={dStyles.fieldLabel} htmlFor="debt-contact">Contact Name</label>
                <input
                  id="debt-contact"
                  className={dStyles.fieldInput}
                  placeholder="e.g. John Doe"
                  value={form.contactName}
                  onChange={event => set('contactName', event.target.value)}
                />
              </div>
            )}
          </div>

          <details className={dStyles.advancedBox}>
            <summary className={dStyles.advancedSummary}>
              <span>More options</span>
              <small>Notes and color selection</small>
            </summary>
            <div className={dStyles.advancedBody}>
              <div className={dStyles.field}>
                <label className={dStyles.fieldLabel} htmlFor="debt-notes">Notes</label>
                <input
                  id="debt-notes"
                  className={dStyles.fieldInput}
                  placeholder="Additional context..."
                  value={form.notes}
                  onChange={event => set('notes', event.target.value)}
                />
              </div>

              <div className={dStyles.colorSection}>
                <div className={dStyles.fieldLabel}>Card Theme Color</div>
                <div className={dStyles.colorGrid}>
                  {COLORS.map(color => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => set('color', color.value)}
                      className={`${dStyles.colorBtn} ${form.color === color.value ? dStyles.colorBtnActive : ''}`}
                      style={{ '--swatch': color.value }}
                      title={color.name}
                      aria-pressed={form.color === color.value}
                    />
                  ))}
                </div>
              </div>
            </div>
          </details>

          <div className={dStyles.editorActions}>
            <button type="button" onClick={closeEditor} className={dStyles.secondaryButton}>Cancel</button>
            <button type="button" onClick={handleSave} className={dStyles.primaryButton}>
              {editDebt ? 'Save changes' : 'Add debt'}
            </button>
          </div>
        </div>
      )}

      {/* Debt List / Cards */}
      {!debts.length ? (
        <div className={dStyles.emptyCard}>
          <div className={dStyles.emptyTitle}>No active debts entered</div>
          <div className={dStyles.emptyBody}>
            Add credit cards or loans above to activate simulations and see your optimal path to financial freedom.
          </div>
        </div>
      ) : (
        <div className={dStyles.debtsGrid}>
          {mappedDebts.map(debt => {
            const balance = Number(debt.balance) || 0
            const original = Number(debt.originalAmount) || balance
            const pctPaid = original > 0 ? Math.min(100, Math.round(((original - balance) / original) * 100)) : 0
            const isCleared = balance === 0

            return (
               <div
                 key={debt._id}
                 className={`${dStyles.debtCard} ${editDebt?._id === debt._id ? dStyles.debtCardEditing : ''} ${isCleared ? dStyles.debtCardCleared : ''}`}
                 style={{ '--debt-tone': debt.color || 'var(--red)' }}
               >
                 <div className={dStyles.debtTop}>
                   <div className={dStyles.debtLeading}>
                     <div className={dStyles.debtIcon}>{DEBT_ICONS[debt.type] || '🏷'}</div>
                     <div className={dStyles.debtInfo}>
                       <div className={dStyles.debtName}>
                         {debt.name}
                         {debt.accountId && (
                           <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)', marginLeft: 8, padding: '2px 6px', borderRadius: 999, border: '1px solid color-mix(in srgb, var(--accent) 30%, var(--border2))', background: 'color-mix(in srgb, var(--accent) 8%, var(--surface2))' }}>
                             🔗 Linked
                           </span>
                         )}
                       </div>
                      <div className={dStyles.debtMeta}>
                        {debt.type} · {debt.interestRate}% APR
                        {debt.contactName && ` · Contact: ${debt.contactName}`}
                      </div>
                    </div>
                  </div>
                  <div className={dStyles.debtActions}>
                    <button type="button" className={dStyles.cardAction} onClick={() => openEdit(debt)}>Edit</button>
                    <button type="button" className={`${dStyles.cardAction} ${dStyles.cardActionDanger}`} onClick={() => handleDel(debt._id, debt.name)}>Delete</button>
                  </div>
                </div>

                <div className={dStyles.debtDetails}>
                  <div className={dStyles.debtCol}>
                    <div className={dStyles.detailsLabel}>Remaining</div>
                    <div className={dStyles.detailsValue}>{money(balance)}</div>
                  </div>
                  <div className={dStyles.debtCol}>
                    <div className={dStyles.detailsLabel}>Min Payment</div>
                    <div className={dStyles.detailsValue}>{money(debt.minPayment)}</div>
                  </div>
                  <div className={dStyles.debtCol}>
                    <div className={dStyles.detailsLabel}>Due Day</div>
                    <div className={dStyles.detailsValue}>{debt.dueDate ? `Day ${debt.dueDate}` : '—'}</div>
                  </div>
                </div>

                {/* Progress bar */}
                {!isCleared && original > 0 && (
                  <div className={dStyles.progressBlock}>
                    <div className={dStyles.progressMeta}>
                      <span>{pctPaid}% paid off</span>
                      <span>{money(original - balance)} paid</span>
                    </div>
                    <div className={dStyles.progressBar}>
                      <div className={dStyles.progressFill} style={{ width: `${pctPaid}%` }} />
                    </div>
                  </div>
                )}

                {/* Payment actions */}
                {!isCleared && (
                  <div className={dStyles.paymentActions}>
                    <input
                      type="number"
                      className={dStyles.paymentInput}
                      min="0"
                      inputMode="decimal"
                      placeholder={`Payment amount (${s})`}
                      value={payments[debt._id] || ''}
                      onChange={event => setPayments(current => ({ ...current, [debt._id]: event.target.value }))}
                      onKeyDown={event => {
                        if (event.key === 'Enter') handlePayment(debt)
                      }}
                    />
                    <button
                      type="button"
                      className={dStyles.payBtn}
                      onClick={() => { playTick(); handlePayment(debt); }}
                    >
                      Make Payment
                    </button>
                  </div>
                )}

                {isCleared && (
                  <div className={dStyles.clearedBanner}>
                    <span>🎉 This debt is completely paid off!</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
