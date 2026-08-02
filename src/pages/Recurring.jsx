import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { fsUpdateTransaction } from '../lib/firestore'
import { confirmApp, notifyApp } from '../lib/appFeedback'
import { RECUR_OPTIONS, fmt, playTick, formatDisplayDate, displayValue, maskMoney } from '../lib/utils'
import styles from './Page.module.css'
import sStyles from './Recurring.module.css'
import { getVirtualBills } from '../lib/bills'
import Bills from './Bills'
import Subscriptions from './Subscriptions'

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
    setActiveTab(tab)
    localStorage.setItem('takda_recurring_tab', tab)
  }

  // --- Aggregate Recurring Transactions ---
  // Any transaction (expense or income) with a `recur` field set is tracked here
  const { calendarBills, subscriptions, recurringIncome, totals } = useMemo(() => {
    const allTx = [...(data?.income || []), ...(data?.expenses || [])]
    const chains = {}
    
    allTx.forEach(tx => {
      const chainId = tx.recurrenceSourceId || tx._id
      if (!chains[chainId]) chains[chainId] = []
      chains[chainId].push(tx)
    })
    
    const active = []
    Object.values(chains).forEach(chain => {
      // Sort by actual date descending to find the latest
      chain.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      const latest = chain[0]
      // Only include if it has an active recur rule
      if (latest.recur) {
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
    
    // Add manual bills to obligations
    if (data?.bills) {
      data.bills.forEach(bill => {
        obligationsMonthly += getMonthlyEquivalent(bill.amount, bill.freq)
      })
    }
    
    // Sort each group by amount descending
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
      }
    }
  }, [data?.income, data?.expenses, data?.bills])

  async function handleStopRecurrence(tx) {
    playTick()
    const confirmed = await confirmApp({
      title: 'Stop recurring?',
      message: `Stop the recurring rule for ${tx.desc || tx.cat}? This won't delete past records, but the auto-engine will stop generating future cycles.`,
      confirmLabel: 'Stop recurring',
      cancelLabel: 'Keep active',
      tone: 'danger',
    })
    if (!confirmed) return

    try {
      const col = tx.type === 'income' ? 'income' : 'expenses'
      await fsUpdateTransaction(user.uid, col, tx, { recur: '' }, data.accounts)
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

  const renderRowItem = (tx) => {
    const freqLabel = RECUR_OPTIONS.find(o => o.value === tx.recur)?.label || tx.recur
    const isIncome = tx.type === 'income'
    const occurrenceDate = getRecurringOccurrenceKey(tx) || tx.date
    
    return (
      <div key={tx._id} className={sStyles.rowItem}>
        <div className={sStyles.rowTop}>
          <div className={sStyles.rowLeft}>
            <div className={`${sStyles.iconWrap} ${isIncome ? sStyles.iconIncome : sStyles.iconExpense}`}>
              {isIncome ? '💰' : '🔄'}
            </div>
            <div className={sStyles.rowInfo}>
              <h4 className={sStyles.rowTitle} title={tx.desc || tx.cat}>{tx.desc || tx.cat}</h4>
              <div className={sStyles.rowMeta}>
                <span className={`${sStyles.badge} ${isIncome ? sStyles.badgeIncome : sStyles.badgeExpense}`}>
                  {isIncome ? 'Income' : 'Expense'}
                </span>
                <span className={`${sStyles.badge} ${sStyles.badgeFreq}`}>{freqLabel}</span>
              </div>
            </div>
          </div>
          <div className={`${sStyles.rowAmount} ${isIncome ? sStyles.amountIncome : sStyles.amountExpense}`}>
            {isIncome ? '+' : '-'}{money(tx.amount)}
          </div>
        </div>
        
        <div className={sStyles.rowBottom}>
          <div className={sStyles.lastRecorded}>
            <span role="img" aria-label="calendar">📅</span> 
            Last: {formatDisplayDate(occurrenceDate)}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button type="button" className={sStyles.editBtn} onClick={() => handleEditRecurrence(tx)}>
              Edit
            </button>
            <button type="button" className={sStyles.stopBtn} onClick={() => handleStopRecurrence(tx)}>
              Stop
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
      <div className={styles.header}>
        <div className={styles.title}>Recurring</div>
        <div className={styles.sub}>
          Manage all your recurring obligations and income.
        </div>
      </div>

      <div className={sStyles.summaryStrip}>
        <div className={sStyles.summaryCard}>
          <div className={sStyles.summaryLabel}>
            Monthly Obligations
          </div>
          <div className={sStyles.summaryValue}>
            {money(totals.obligations)}
          </div>
        </div>
        <div className={sStyles.summaryCard}>
          <div className={sStyles.summaryLabel}>
            Monthly Income
          </div>
          <div className={sStyles.summaryValue + ' ' + sStyles.summaryValuePositive}>
            {money(totals.income)}
          </div>
        </div>
        <div className={sStyles.summaryCard}>
          <div className={sStyles.summaryLabel}>
            Net Cash Flow
          </div>
          <div className={`${sStyles.summaryValue} ${totals.net >= 0 ? sStyles.summaryValuePositive : ''}`}>
            {totals.net >= 0 ? '+' : ''}{money(totals.net)}
          </div>
        </div>
      </div>

      <div className={sStyles.tabsWrap}>
        <div className={sStyles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'bills'}
            className={`${sStyles.tab} ${activeTab === 'bills' ? sStyles.tabActive : ''}`}
            onClick={() => handleTabChange('bills')}
          >
            Bills
            <span className={sStyles.tabCount}>{totalBillsCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'subscriptions'}
            className={`${sStyles.tab} ${activeTab === 'subscriptions' ? sStyles.tabActive : ''}`}
            onClick={() => handleTabChange('subscriptions')}
          >
            Subscriptions
            <span className={sStyles.tabCount}>{subscriptions.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'income'}
            className={`${sStyles.tab} ${activeTab === 'income' ? sStyles.tabActive : ''}`}
            onClick={() => handleTabChange('income')}
          >
            Income
            <span className={sStyles.tabCount}>{recurringIncome.length}</span>
          </button>
        </div>
      </div>

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
            <h3 className={sStyles.groupTitle}>Subscriptions & Services</h3>
            <span className={sStyles.groupDesc}>Recurring memberships and software</span>
          </div>
          
          <div className={sStyles.listLayout}>
            {subscriptions.length > 0 ? (
              subscriptions.map(renderRowItem)
            ) : (
              <div className={sStyles.emptyState}>
                <div className={sStyles.emptyStateIcon}>🔄</div>
                <h4>No active subscriptions</h4>
                <p>Any recurring expense from your calendar that isn't a bill will appear here.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'income' && (
        <div>
          <div className={sStyles.groupHeader}>
            <h3 className={sStyles.groupTitle}>Recurring Income</h3>
            <span className={sStyles.groupDesc}>Expected income like salary or retainers</span>
          </div>
          
          <div className={sStyles.listLayout}>
            {recurringIncome.length > 0 ? (
              recurringIncome.map(renderRowItem)
            ) : (
              <div className={sStyles.emptyState}>
                <div className={sStyles.emptyStateIcon}>💰</div>
                <h4>No active recurring income</h4>
                <p>Add your salary to the calendar as a recurring income to see it here.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Recurring Transaction Modal */}
      {editingTx && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            overflowY: 'auto',
          }}
          onClick={() => setEditingTx(null)}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '440px',
              padding: '24px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Edit Recurring {editingTx.type === 'income' ? 'Income' : 'Subscription'}</h3>
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text2)', fontSize: '20px', cursor: 'pointer' }}
              >✕</button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className={styles.formGroup}>
                <label>Name / Description</label>
                <input
                  type="text"
                  value={editForm.desc}
                  onChange={e => setEditForm(f => ({ ...f, desc: e.target.value }))}
                  placeholder="e.g. Netflix or Salary"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Amount ({s})</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={editForm.amount}
                  onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Frequency</label>
                <select
                  value={editForm.recur}
                  onChange={e => setEditForm(f => ({ ...f, recur: e.target.value }))}
                >
                  {RECUR_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Account</label>
                <select
                  value={editForm.accountId}
                  onChange={e => setEditForm(f => ({ ...f, accountId: e.target.value }))}
                >
                  <option value="">Unlinked (Cashflow)</option>
                  {(data?.accounts || []).map(acc => (
                    <option key={acc._id} value={acc._id}>
                      {acc.name} ({acc.type})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'var(--accent)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    opacity: savingEdit ? 0.7 : 1,
                  }}
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
