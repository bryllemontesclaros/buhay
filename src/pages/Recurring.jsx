import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { fsAdd, fsUpdateTransaction } from '../lib/firestore'
import { confirmApp, notifyApp } from '../lib/appFeedback'
import { RECUR_OPTIONS, fmt, playTick, formatDisplayDate, displayValue, maskMoney, today } from '../lib/utils'
import styles from './Page.module.css'
import sStyles from './Recurring.module.css'
import { getVirtualBills } from '../lib/bills'
import { getRecurringOccurrenceKey } from '../lib/recurrence'
import Bills from './Bills'

function getMonthlyEquivalent(amount, freq = 'monthly') {
  const numericAmount = Number(amount) || 0
  if (!numericAmount) return 0
  switch (freq) {
    case 'weekly': return (numericAmount * 52) / 12
    case 'bi-weekly':
    case 'biweekly': return (numericAmount * 26) / 12
    case 'tri-weekly': return (numericAmount * (365 / 21)) / 12
    case 'quad-weekly': return (numericAmount * (365 / 28)) / 12
    case 'semi-monthly': return (numericAmount * 24) / 12
    case 'yearly':
    case 'annually': return numericAmount / 12
    case 'quarterly': return numericAmount / 3
    case 'daily': return numericAmount * 30.4
    case 'monthly':
    default:
      return numericAmount
  }
}

export default function Recurring({ user, data, symbol, privacyMode = false, billPaymentTarget }) {
  const s = symbol || '₱'
  const money = value => displayValue(privacyMode, fmt(value, s), maskMoney(s))
  
  // Default to bills tab if arriving via a bill payment deep-link, otherwise check localStorage or default to bills
  const initialTab = billPaymentTarget ? 'bills' : (localStorage.getItem('takda_recurring_tab') || 'bills')
  const [activeTab, setActiveTab] = useState(initialTab)

  const handleTabChange = (tab) => {
    playTick()
    setActiveTab(tab)
    localStorage.setItem('takda_recurring_tab', tab)
  }

  // --- Aggregate Recurring Transactions ---
  const { calendarBills, subscriptions, recurringIncome, totals, dueThisWeek } = useMemo(() => {
    const allTx = [...(data?.income || []), ...(data?.expenses || [])]
    const chains = {}
    
    allTx.forEach(tx => {
      const chainId = tx.recurrenceSourceId || tx._id
      if (!chains[chainId]) chains[chainId] = []
      chains[chainId].push(tx)
    })
    
    const active = []
    Object.values(chains).forEach(chain => {
      chain.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      const latest = chain[0]
      if (latest && latest.recur) {
        active.push(latest)
      }
    })
    
    const cBills = []
    const subs = []
    const rIncome = []
    
    let obligationsMonthly = 0
    let incomeMonthly = 0
    
    active.forEach(tx => {
      const monthlyEquiv = getMonthlyEquivalent(tx.amount, tx.recur)
      if (tx.type === 'income') {
        rIncome.push(tx)
        incomeMonthly += monthlyEquiv
      } else {
        obligationsMonthly += monthlyEquiv
        if (tx.cat === 'Bills' && tx.subcat !== 'Subscriptions') {
          cBills.push(tx)
        } else {
          subs.push(tx)
        }
      }
    })
    
    // Add manual bills to obligations & calculate due this week
    let weekDueSum = 0
    const todayDate = new Date()
    const currentDay = todayDate.getDate()
    
    if (data?.bills) {
      data.bills.forEach(bill => {
        obligationsMonthly += getMonthlyEquivalent(bill.amount, bill.freq)
        const due = Number(bill.due)
        if (due >= currentDay && due <= currentDay + 7) {
          weekDueSum += Number(bill.amount) || 0
        }
      })
    }
    
    const sortByAmount = (a, b) => b.amount - a.amount
    cBills.sort(sortByAmount)
    subs.sort(sortByAmount)
    rIncome.sort(sortByAmount)
    
    return { 
      calendarBills: cBills, 
      subscriptions: subs, 
      recurringIncome: rIncome,
      totals: {
        obligations: obligationsMonthly,
        income: incomeMonthly,
        net: incomeMonthly - obligationsMonthly
      },
      dueThisWeek: weekDueSum
    }
  }, [data?.income, data?.expenses, data?.bills])

  // Stop Recurrence Handler
  async function handleStopRecurrence(tx) {
    playTick()
    const confirmed = await confirmApp({
      title: 'Stop recurring?',
      message: `Stop the recurring rule for "${tx.desc || tx.cat}"? Past records will be kept, but future auto-cycles will stop.`,
      confirmLabel: 'Stop recurring',
      cancelLabel: 'Keep active',
      tone: 'danger',
    })
    if (!confirmed) return

    try {
      const col = tx.type === 'income' ? 'income' : 'expenses'
      await fsUpdateTransaction(user.uid, col, tx, { recur: '' }, data?.accounts || [])
      notifyApp({
        title: 'Recurrence stopped',
        message: `${tx.desc || tx.cat} will no longer recur.`,
        tone: 'success'
      })
    } catch (err) {
      console.error(err)
      notifyApp({
        title: 'Error',
        message: 'Could not update recurrence right now.',
        tone: 'error'
      })
    }
  }

  // Edit Modal State
  const [editingTx, setEditingTx] = useState(null)
  const [editForm, setEditForm] = useState({ desc: '', amount: '', recur: 'monthly', accountId: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  function handleEditRecurrence(tx) {
    playTick()
    setEditingTx(tx)
    setEditForm({
      desc: tx.desc || tx.cat || '',
      amount: String(tx.amount || ''),
      recur: tx.recur || 'monthly',
      accountId: tx.accountId || '',
    })
  }

  async function handleSaveEdit(e) {
    if (e) e.preventDefault()
    if (!editingTx) return
    const numericAmount = parseFloat(editForm.amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      notifyApp({ title: 'Check amount', message: 'Amount must be greater than zero.', tone: 'warning' })
      return
    }

    setSavingEdit(true)
    try {
      const col = editingTx.type === 'income' ? 'income' : 'expenses'
      const updates = {
        desc: editForm.desc.trim() || editingTx.cat,
        amount: numericAmount,
        recur: editForm.recur,
        accountId: editForm.accountId || '',
      }
      await fsUpdateTransaction(user.uid, col, editingTx, updates, data?.accounts || [])
      notifyApp({ title: 'Recurring updated', message: `${updates.desc} has been updated.`, tone: 'success' })
      setEditingTx(null)
    } catch (err) {
      console.error(err)
      notifyApp({ title: 'Error', message: 'Could not update recurring transaction.', tone: 'error' })
    } finally {
      setSavingEdit(false)
    }
  }

  // Add Recurring Modal State
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({
    kind: 'subscription', // 'bill' | 'subscription' | 'income'
    name: '',
    amount: '',
    freq: 'monthly',
    due: '1',
    accountId: '',
  })
  const [savingAdd, setSavingAdd] = useState(false)

  function openAddModal(defaultKind = 'subscription') {
    playTick()
    setAddForm({
      kind: defaultKind,
      name: '',
      amount: '',
      freq: 'monthly',
      due: String(new Date().getDate()),
      accountId: data?.accounts?.[0]?._id || '',
    })
    setShowAddModal(true)
  }

  async function handleSaveAdd(e) {
    if (e) e.preventDefault()
    const numericAmount = parseFloat(addForm.amount)
    if (!addForm.name.trim()) {
      notifyApp({ title: 'Name required', message: 'Please enter a name or description.', tone: 'warning' })
      return
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      notifyApp({ title: 'Check amount', message: 'Amount must be greater than zero.', tone: 'warning' })
      return
    }

    setSavingAdd(true)
    try {
      if (addForm.kind === 'bill') {
        const payload = {
          name: addForm.name.trim(),
          amount: numericAmount,
          due: Number(addForm.due) || 1,
          freq: addForm.freq,
          cat: 'Bills',
          subcat: 'Utilities',
          accountId: addForm.accountId || '',
          autoDeduct: false,
        }
        await fsAdd(user.uid, 'bills', payload)
        notifyApp({ title: 'Bill added', message: `${payload.name} added to your recurring bills.`, tone: 'success' })
      } else if (addForm.kind === 'subscription') {
        const payload = {
          desc: addForm.name.trim(),
          amount: numericAmount,
          recur: addForm.freq,
          cat: 'Bills',
          subcat: 'Subscriptions',
          date: today(),
          type: 'expense',
          accountId: addForm.accountId || '',
        }
        await fsAdd(user.uid, 'expenses', payload)
        notifyApp({ title: 'Subscription added', message: `${payload.desc} added to active subscriptions.`, tone: 'success' })
      } else {
        const payload = {
          desc: addForm.name.trim(),
          amount: numericAmount,
          recur: addForm.freq,
          cat: 'Income',
          subcat: 'Salary',
          date: today(),
          type: 'income',
          accountId: addForm.accountId || '',
        }
        await fsAdd(user.uid, 'income', payload)
        notifyApp({ title: 'Recurring income added', message: `${payload.desc} added to recurring income.`, tone: 'success' })
      }
      setShowAddModal(false)
    } catch (err) {
      console.error(err)
      notifyApp({ title: 'Error', message: 'Could not create recurring item.', tone: 'error' })
    } finally {
      setSavingAdd(false)
    }
  }

  // Commitment calculation
  const commitmentRatio = totals.income > 0 ? Math.min(100, Math.round((totals.obligations / totals.income) * 100)) : 0

  const renderRowItem = (tx) => {
    const freqLabel = RECUR_OPTIONS.find(o => o.value === tx.recur)?.label || tx.recur
    const isIncome = tx.type === 'income'
    const occurrenceDate = getRecurringOccurrenceKey(tx) || tx.date
    const monthlyEquiv = getMonthlyEquivalent(tx.amount, tx.recur)
    const isNotMonthly = tx.recur && tx.recur !== 'monthly'
    
    return (
      <div key={tx._id} className={sStyles.rowItem}>
        <div className={sStyles.rowTop}>
          <div className={sStyles.rowLeft}>
            <div className={`${sStyles.iconWrap} ${isIncome ? sStyles.iconIncome : sStyles.iconExpense}`}>
              {isIncome ? '💰' : tx.subcat === 'Subscriptions' ? '🍿' : '🔄'}
            </div>
            <div className={sStyles.rowInfo}>
              <h4 className={sStyles.rowTitle} title={tx.desc || tx.cat}>{tx.desc || tx.cat}</h4>
              <div className={sStyles.rowMeta}>
                <span className={`${sStyles.badge} ${isIncome ? sStyles.badgeIncome : sStyles.badgeExpense}`}>
                  {isIncome ? 'Income' : 'Expense'}
                </span>
                <span className={`${sStyles.badge} ${sStyles.badgeFreq}`}>{freqLabel}</span>
                {isNotMonthly && monthlyEquiv > 0 && (
                  <span className={sStyles.monthlyEquivChip}>~{money(monthlyEquiv)}/mo</span>
                )}
              </div>
            </div>
          </div>
          <div className={sStyles.amountContainer}>
            <div className={`${sStyles.rowAmount} ${isIncome ? sStyles.amountIncome : sStyles.amountExpense}`}>
              {isIncome ? '+' : '-'}{money(tx.amount)}
            </div>
          </div>
        </div>
        
        <div className={sStyles.rowBottom}>
          <div className={sStyles.lastRecorded}>
            <span role="img" aria-label="calendar">📅</span> 
            Last: {formatDisplayDate(occurrenceDate)}
          </div>
          <div className={sStyles.rowActions}>
            <button type="button" className={sStyles.editBtn} onClick={() => handleEditRecurrence(tx)}>
              ✏️ Edit
            </button>
            <button type="button" className={sStyles.stopBtn} onClick={() => handleStopRecurrence(tx)}>
              ⏹ Stop
            </button>
          </div>
        </div>
      </div>
    )
  }

  const totalBillsCount = useMemo(() => {
    return [...(data?.bills || []), ...getVirtualBills(data)].length
  }, [data?.bills, data?.debts, data?.accounts, data?.expenses])

  return (
    <div className={styles.page}>
      {/* FRICTIONLESS RADAR HERO */}
      <div className={sStyles.radarHeroCard}>
        <div className={sStyles.radarHeroTop}>
          <div className={sStyles.radarHeroCopy}>
            <span className={sStyles.radarHeroLabel}>Monthly Fixed Obligations</span>
            <div className={sStyles.radarHeroVal}>
              {money(totals.obligations)}
              <span className={sStyles.radarHeroPerMonth}>/ month</span>
            </div>
          </div>

          <div className={sStyles.radarHeroActions}>
            <button
              type="button"
              className={sStyles.btnHeroPrimary}
              onClick={() => openAddModal(activeTab === 'income' ? 'income' : activeTab === 'subscriptions' ? 'subscription' : 'bill')}
            >
              + Add Recurring
            </button>
          </div>
        </div>

        {/* COMMITMENT METER & STATS PILLS */}
        <div className={sStyles.radarMetricsStrip}>
          <div className={sStyles.radarMetricPill}>
            <span className={sStyles.metricDot} style={{ background: 'var(--income)' }} />
            <span className={sStyles.metricLabel}>Expected Income:</span>
            <span className={sStyles.metricVal}>{money(totals.income)}/mo</span>
          </div>

          <div className={sStyles.radarMetricPill}>
            <span className={sStyles.metricDot} style={{ background: totals.net >= 0 ? 'var(--accent)' : 'var(--red)' }} />
            <span className={sStyles.metricLabel}>Free Cash Flow:</span>
            <span className={`${sStyles.metricVal} ${totals.net >= 0 ? sStyles.valPositive : sStyles.valNegative}`}>
              {totals.net >= 0 ? '+' : ''}{money(totals.net)}/mo
            </span>
          </div>

          {dueThisWeek > 0 && (
            <div className={`${sStyles.radarMetricPill} ${sStyles.pillUrgent}`}>
              <span className={sStyles.metricDot} style={{ background: 'var(--amber)' }} />
              <span className={sStyles.metricLabel}>Due in Next 7 Days:</span>
              <span className={sStyles.metricVal}>{money(dueThisWeek)}</span>
            </div>
          )}
        </div>

        {totals.income > 0 && (
          <div className={sStyles.commitmentBarSection}>
            <div className={sStyles.commitmentBarTrack}>
              <div
                className={sStyles.commitmentBarFill}
                style={{
                  width: `${commitmentRatio}%`,
                  background: commitmentRatio > 75 ? 'var(--red)' : commitmentRatio > 50 ? 'var(--amber)' : 'var(--accent)',
                }}
              />
            </div>
            <div className={sStyles.commitmentBarMeta}>
              <span><strong>{commitmentRatio}%</strong> of monthly income is committed to fixed costs</span>
              <span>{money(Math.max(0, totals.net))} unallocated</span>
            </div>
          </div>
        )}
      </div>

      {/* SEGMENTED TAB SWITCHER */}
      <div className={sStyles.tabsWrap}>
        <div className={sStyles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'bills'}
            className={`${sStyles.tab} ${activeTab === 'bills' ? sStyles.tabActive : ''}`}
            onClick={() => handleTabChange('bills')}
          >
            📄 Bills & Utilities
            <span className={sStyles.tabCount}>{totalBillsCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'subscriptions'}
            className={`${sStyles.tab} ${activeTab === 'subscriptions' ? sStyles.tabActive : ''}`}
            onClick={() => handleTabChange('subscriptions')}
          >
            🔄 Subscriptions
            <span className={sStyles.tabCount}>{subscriptions.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'income'}
            className={`${sStyles.tab} ${activeTab === 'income' ? sStyles.tabActive : ''}`}
            onClick={() => handleTabChange('income')}
          >
            💰 Recurring Income
            <span className={sStyles.tabCount}>{recurringIncome.length}</span>
          </button>
        </div>
      </div>

      {/* TAB CONTENT */}
      {activeTab === 'bills' && (
        <div className={sStyles.billsWrapper}>
          <Bills user={user} data={data} symbol={s} privacyMode={privacyMode} billPaymentTarget={billPaymentTarget} embedded={true} />
          
          {calendarBills.length > 0 && (
            <div>
              <div className={sStyles.billsDivider} />
              <div className={sStyles.groupHeader}>
                <h3 className={sStyles.groupTitle}>Auto-generated Bills</h3>
                <span className={sStyles.groupDesc}>Tracked from your calendar</span>
              </div>
              <div className={sStyles.listLayout}>
                {calendarBills.map(renderRowItem)}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'subscriptions' && (
        <div>
          <div className={sStyles.groupHeader}>
            <div>
              <h3 className={sStyles.groupTitle}>Subscriptions & Services</h3>
              <div className={sStyles.groupSub}>Recurring memberships, streaming, software, and tools</div>
            </div>
            <button
              type="button"
              className={sStyles.btnAddCompact}
              onClick={() => openAddModal('subscription')}
            >
              + Add Subscription
            </button>
          </div>
          
          <div className={sStyles.listLayout}>
            {subscriptions.length > 0 ? (
              subscriptions.map(renderRowItem)
            ) : (
              <div className={sStyles.emptyState}>
                <div className={sStyles.emptyStateIcon}>🍿</div>
                <h4>No active subscriptions</h4>
                <p>Track your Spotify, Netflix, gym, or software subscriptions to automate your monthly runway.</p>
                <button
                  type="button"
                  className={sStyles.emptyStateBtn}
                  onClick={() => openAddModal('subscription')}
                >
                  + Add Your First Subscription
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'income' && (
        <div>
          <div className={sStyles.groupHeader}>
            <div>
              <h3 className={sStyles.groupTitle}>Recurring Income</h3>
              <div className={sStyles.groupSub}>Expected steady cashflow like salary, retainers, and dividends</div>
            </div>
            <button
              type="button"
              className={sStyles.btnAddCompact}
              onClick={() => openAddModal('income')}
            >
              + Add Income Rule
            </button>
          </div>
          
          <div className={sStyles.listLayout}>
            {recurringIncome.length > 0 ? (
              recurringIncome.map(renderRowItem)
            ) : (
              <div className={sStyles.emptyState}>
                <div className={sStyles.emptyStateIcon}>💰</div>
                <h4>No recurring income added</h4>
                <p>Add your bi-weekly salary or regular client retainer to calculate your free spending cash.</p>
                <button
                  type="button"
                  className={sStyles.emptyStateBtn}
                  onClick={() => openAddModal('income')}
                >
                  + Add Salary / Recurring Income
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 1-CLICK ADD RECURRING MODAL */}
      {showAddModal && typeof document !== 'undefined' && createPortal(
        <div className={sStyles.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div className={sStyles.modalCard} onClick={e => e.stopPropagation()}>
            <div className={sStyles.modalHeader}>
              <div>
                <div className={sStyles.modalEyebrow}>New Recurring Rule</div>
                <h3 className={sStyles.modalTitle}>Add Recurring Item</h3>
              </div>
              <button
                type="button"
                className={sStyles.modalClose}
                onClick={() => setShowAddModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className={sStyles.modalBody}>
              {/* Type Switcher */}
              <div className={sStyles.segmentedTypeWrap}>
                <button
                  type="button"
                  className={`${sStyles.segmentedTypeBtn} ${addForm.kind === 'bill' ? sStyles.segmentedTypeBtnActive : ''}`}
                  onClick={() => setAddForm(f => ({ ...f, kind: 'bill' }))}
                >
                  📄 Bill
                </button>
                <button
                  type="button"
                  className={`${sStyles.segmentedTypeBtn} ${addForm.kind === 'subscription' ? sStyles.segmentedTypeBtnActive : ''}`}
                  onClick={() => setAddForm(f => ({ ...f, kind: 'subscription' }))}
                >
                  🍿 Subscription
                </button>
                <button
                  type="button"
                  className={`${sStyles.segmentedTypeBtn} ${addForm.kind === 'income' ? sStyles.segmentedTypeBtnActive : ''}`}
                  onClick={() => setAddForm(f => ({ ...f, kind: 'income' }))}
                >
                  💰 Income
                </button>
              </div>

              <div className={sStyles.field}>
                <label className={sStyles.fieldLabel} htmlFor="recurring-name">Name / Description</label>
                <input
                  id="recurring-name"
                  className={sStyles.fieldInput}
                  type="text"
                  value={addForm.name}
                  onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={addForm.kind === 'income' ? 'e.g. Monthly Salary, Freelance Retainer' : addForm.kind === 'bill' ? 'e.g. Meralco, PLDT, Rent' : 'e.g. Netflix, Spotify, iCloud'}
                  required
                  autoFocus
                />
              </div>

              <div className={sStyles.field}>
                <label className={sStyles.fieldLabel} htmlFor="recurring-amount">Amount ({s})</label>
                <input
                  id="recurring-amount"
                  className={sStyles.fieldInputBig}
                  type="number"
                  step="any"
                  min="0"
                  value={addForm.amount}
                  onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className={sStyles.fieldRow}>
                <div className={sStyles.field}>
                  <label className={sStyles.fieldLabel} htmlFor="recurring-freq">Frequency</label>
                  <select
                    id="recurring-freq"
                    className={sStyles.fieldInput}
                    value={addForm.freq}
                    onChange={e => setAddForm(f => ({ ...f, freq: e.target.value }))}
                  >
                    {RECUR_OPTIONS.filter(o => o.value).map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {addForm.kind === 'bill' && (
                  <div className={sStyles.field}>
                    <label className={sStyles.fieldLabel} htmlFor="recurring-due">Due Day (1-31)</label>
                    <input
                      id="recurring-due"
                      className={sStyles.fieldInput}
                      type="number"
                      min="1"
                      max="31"
                      value={addForm.due}
                      onChange={e => setAddForm(f => ({ ...f, due: e.target.value }))}
                      required
                    />
                  </div>
                )}
              </div>

              <div className={sStyles.field}>
                <label className={sStyles.fieldLabel} htmlFor="recurring-account">Linked Account</label>
                <select
                  id="recurring-account"
                  className={sStyles.fieldInput}
                  value={addForm.accountId}
                  onChange={e => setAddForm(f => ({ ...f, accountId: e.target.value }))}
                >
                  <option value="">Unlinked (Cashflow only)</option>
                  {(data?.accounts || []).map(acc => (
                    <option key={acc._id} value={acc._id}>
                      {acc.name} ({acc.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className={sStyles.modalActions}>
                <button
                  type="button"
                  className={sStyles.btnSecondary}
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAdd}
                  className={sStyles.btnPrimary}
                >
                  {savingAdd ? 'Saving...' : '+ Add Recurring'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* EDIT RECURRING MODAL */}
      {editingTx && typeof document !== 'undefined' && createPortal(
        <div className={sStyles.modalOverlay} onClick={() => setEditingTx(null)}>
          <div className={sStyles.modalCard} onClick={e => e.stopPropagation()}>
            <div className={sStyles.modalHeader}>
              <div>
                <div className={sStyles.modalEyebrow}>Edit Rule</div>
                <h3 className={sStyles.modalTitle}>
                  Edit {editingTx.type === 'income' ? 'Income' : 'Subscription'}
                </h3>
              </div>
              <button
                type="button"
                className={sStyles.modalClose}
                onClick={() => setEditingTx(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className={sStyles.modalBody}>
              <div className={sStyles.field}>
                <label className={sStyles.fieldLabel} htmlFor="edit-name">Name / Description</label>
                <input
                  id="edit-name"
                  className={sStyles.fieldInput}
                  type="text"
                  value={editForm.desc}
                  onChange={e => setEditForm(f => ({ ...f, desc: e.target.value }))}
                  placeholder="e.g. Netflix or Salary"
                  required
                  autoFocus
                />
              </div>

              <div className={sStyles.field}>
                <label className={sStyles.fieldLabel} htmlFor="edit-amount">Amount ({s})</label>
                <input
                  id="edit-amount"
                  className={sStyles.fieldInputBig}
                  type="number"
                  step="any"
                  min="0"
                  value={editForm.amount}
                  onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className={sStyles.field}>
                <label className={sStyles.fieldLabel} htmlFor="edit-freq">Frequency</label>
                <select
                  id="edit-freq"
                  className={sStyles.fieldInput}
                  value={editForm.recur}
                  onChange={e => setEditForm(f => ({ ...f, recur: e.target.value }))}
                >
                  {RECUR_OPTIONS.filter(o => o.value).map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className={sStyles.field}>
                <label className={sStyles.fieldLabel} htmlFor="edit-account">Linked Account</label>
                <select
                  id="edit-account"
                  className={sStyles.fieldInput}
                  value={editForm.accountId}
                  onChange={e => setEditForm(f => ({ ...f, accountId: e.target.value }))}
                >
                  <option value="">Unlinked (Cashflow only)</option>
                  {(data?.accounts || []).map(acc => (
                    <option key={acc._id} value={acc._id}>
                      {acc.name} ({acc.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className={sStyles.modalActions}>
                <button
                  type="button"
                  className={sStyles.btnSecondary}
                  onClick={() => setEditingTx(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className={sStyles.btnPrimary}
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
