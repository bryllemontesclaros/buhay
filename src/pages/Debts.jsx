import { useEffect, useMemo, useRef, useState } from 'react'
import { fsAdd, fsDel, fsUpdate, fsAddTransaction, fsDeleteAccountAndUnlinkTransactions, fsTransferAccounts } from '../lib/firestore'
import { calculatePayoffSchedule } from '../lib/debts'
import { confirmApp, notifyApp } from '../lib/appFeedback'
import { displayValue, fmt, maskMoney, playTick, today, getMonthKey } from '../lib/utils'
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
  statementDate: '',
  color: 'var(--red)',
  contactName: '',
  notes: '',
  accountId: '',
  creditLimit: '',
}

export default function Debts({ user, data, symbol, privacyMode = false }) {
  const s = symbol || '₱'
  const debts = data.debts || []
  
  const [extraBudget, setExtraBudget] = useState(0)
  const [strategy, setStrategy] = useState('avalanche')
  const [form, setForm] = useState(EMPTY_FORM)
  const [payments, setPayments] = useState({})
  const [paymentSources, setPaymentSources] = useState({})
  const [isEditing, setIsEditing] = useState(false)
  const [editDebt, setEditDebt] = useState(null)
  const [showDrawer, setShowDrawer] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [expandedHistory, setExpandedHistory] = useState({})
  const [activeMilestone, setActiveMilestone] = useState(null)
  
  const getDebtTransactions = useMemo(() => {
    const income = (data.income || []).map(tx => ({ ...tx, type: 'income' }))
    const expenses = (data.expenses || []).map(tx => ({ ...tx, type: 'expense' }))
    const transfers = (data.transfers || []).map(tx => ({ ...tx, type: 'transfer' }))
    const all = [...income, ...expenses, ...transfers]

    return (debt) => {
      const nameLower = (debt.name || '').toLowerCase()
      const accId = debt.accountId
      
      return all.filter(tx => {
        if (accId) {
          if (tx.type === 'transfer') {
            if (tx.fromAccountId === accId || tx.toAccountId === accId) return true
          } else {
            if (tx.accountId === accId) return true
          }
        }
        if (tx.desc && tx.desc.toLowerCase().includes(nameLower)) return true
        return false
      }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    }
  }, [data.income, data.expenses, data.transfers])

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
    const linkedAcc = debt.accountId ? (data.accounts || []).find(a => a._id === debt.accountId) : null
    setEditDebt(debt)
    setForm({
      name: debt.name || '',
      type: debt.type || 'Credit Card',
      balance: debt.accountId
        ? Math.abs(Number(linkedAcc?.balance) || 0)
        : (debt.balance || ''),
      originalAmount: debt.originalAmount || '',
      interestRate: debt.interestRate || '',
      minPayment: debt.minPayment || '',
      dueDate: debt.dueDate || '',
      statementDate: debt.statementDate || '',
      color: debt.color || 'var(--red)',
      contactName: debt.contactName || '',
      notes: debt.notes || '',
      accountId: debt.accountId || '',
      creditLimit: linkedAcc ? (linkedAcc.creditLimit || '') : '',
    })
    setShowModal(true)
  }

  function closeEditor() {
    setShowModal(false)
    setEditDebt(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave() {
    if (!form.name || form.balance === '' || form.minPayment === '') {
      notifyApp({
        title: 'Debt needs details',
        message: 'Add a name, balance, and minimum monthly payment before saving.',
        tone: 'warning',
      })
      return
    }

    const balanceVal = parseFloat(form.balance) || 0
    const originalVal = parseFloat(form.originalAmount) || balanceVal
    const rateVal = parseFloat(form.interestRate) || 0
    const minVal = parseFloat(form.minPayment) || 0
    const limitVal = parseFloat(form.creditLimit) || 0

    if (form.type !== 'Credit Card' && balanceVal <= 0) {
      notifyApp({ title: 'Check balance', message: 'Current balance must be greater than zero.', tone: 'warning' })
      return
    }
    if (form.type === 'Credit Card' && balanceVal < 0) {
      notifyApp({ title: 'Check balance', message: 'Current amount owed cannot be negative.', tone: 'warning' })
      return
    }
    if (form.type !== 'Credit Card' && minVal <= 0) {
      notifyApp({ title: 'Check minimum payment', message: 'Minimum payment must be greater than zero.', tone: 'warning' })
      return
    }
    if (form.type === 'Credit Card') {
      if (balanceVal > 0 && minVal <= 0) {
        notifyApp({ title: 'Check minimum payment', message: 'Minimum payment must be greater than zero when you have an outstanding balance.', tone: 'warning' })
        return
      }
      if (minVal < 0) {
        notifyApp({ title: 'Check minimum payment', message: 'Minimum payment cannot be negative.', tone: 'warning' })
        return
      }
    }

    try {
      if (form.type === 'Credit Card') {
        if (editDebt) {
          let accId = editDebt.accountId
          if (editDebt.isSynthesized) {
            await fsUpdate(user.uid, 'accounts', accId, {
              name: form.name,
              balance: -Math.abs(balanceVal),
              creditLimit: limitVal,
              color: form.color,
              notes: form.notes || '',
            })
            await fsAdd(user.uid, 'debts', {
              name: form.name,
              type: 'Credit Card',
              balance: balanceVal,
              originalAmount: originalVal,
              interestRate: rateVal,
              minPayment: minVal,
              dueDate: form.dueDate,
              statementDate: form.statementDate,
              color: form.color,
              notes: form.notes || '',
              accountId: accId,
            })
            notifyApp({ title: 'Credit Card updated', message: `${form.name} changes have been saved.`, tone: 'success' })
          } else if (!accId) {
            const accRef = await fsAdd(user.uid, 'accounts', {
              name: form.name,
              type: 'Credit Card',
              balance: -Math.abs(balanceVal),
              creditLimit: limitVal,
              color: form.color,
              notes: form.notes || '',
            })
            accId = accRef.id
            await fsUpdate(user.uid, 'debts', editDebt._id, {
              name: form.name,
              type: 'Credit Card',
              balance: balanceVal,
              originalAmount: originalVal,
              interestRate: rateVal,
              minPayment: minVal,
              dueDate: form.dueDate,
              statementDate: form.statementDate,
              color: form.color,
              notes: form.notes || '',
              accountId: accId,
            })
            notifyApp({ title: 'Credit Card updated', message: `${form.name} changes have been saved.`, tone: 'success' })
          } else {
            await fsUpdate(user.uid, 'accounts', accId, {
              name: form.name,
              balance: -Math.abs(balanceVal),
              creditLimit: limitVal,
              color: form.color,
              notes: form.notes || '',
            })
            await fsUpdate(user.uid, 'debts', editDebt._id, {
              name: form.name,
              type: 'Credit Card',
              balance: balanceVal,
              originalAmount: originalVal,
              interestRate: rateVal,
              minPayment: minVal,
              dueDate: form.dueDate,
              statementDate: form.statementDate,
              color: form.color,
              notes: form.notes || '',
              accountId: accId,
            })
            notifyApp({ title: 'Credit Card updated', message: `${form.name} changes have been saved.`, tone: 'success' })
          }
        } else {
          const accRef = await fsAdd(user.uid, 'accounts', {
            name: form.name,
            type: 'Credit Card',
            balance: -Math.abs(balanceVal),
            creditLimit: limitVal,
            color: form.color,
            notes: form.notes || '',
          })
          await fsAdd(user.uid, 'debts', {
            name: form.name,
            type: 'Credit Card',
            balance: balanceVal,
            originalAmount: originalVal,
            interestRate: rateVal,
            minPayment: minVal,
            dueDate: form.dueDate,
            statementDate: form.statementDate,
            color: form.color,
            notes: form.notes || '',
            accountId: accRef.id,
          })
          notifyApp({ title: 'Credit Card added', message: `${form.name} has been added.`, tone: 'success' })
        }
      } else {
        const payload = {
          name: form.name,
          type: form.type,
          balance: balanceVal,
          originalAmount: originalVal,
          interestRate: rateVal,
          minPayment: minVal,
          dueDate: form.dueDate,
          statementDate: form.statementDate,
          color: form.color,
          contactName: form.contactName || '',
          notes: form.notes || '',
          accountId: '',
        }
        if (editDebt) {
          if (editDebt.accountId) {
            await fsDel(user.uid, 'accounts', editDebt.accountId)
          }
          await fsUpdate(user.uid, 'debts', editDebt._id, payload)
          notifyApp({ title: 'Debt updated', message: `${form.name} changes have been saved.`, tone: 'success' })
        } else {
          await fsAdd(user.uid, 'debts', payload)
          notifyApp({ title: 'Debt added', message: `${form.name} has been added.`, tone: 'success' })
        }
      }
      closeEditor()
    } catch {
      notifyApp({ title: 'Operation failed', message: 'Could not save details. Try again.', tone: 'error' })
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
      const debt = mappedDebts.find(d => d._id === id)
      if (debt?.isSynthesized) {
        await fsDeleteAccountAndUnlinkTransactions(user.uid, debt.accountId, data)
      } else {
        await fsDel(user.uid, 'debts', id)
        if (debt && debt.accountId) {
          await fsDeleteAccountAndUnlinkTransactions(user.uid, debt.accountId, data)
        }
      }
      notifyApp({ title: 'Debt deleted', message: `${name} has been removed.`, tone: 'success' })
    } catch {
      notifyApp({ title: 'Delete failed', message: 'Could not remove this debt. Try again.', tone: 'error' })
    }
  }

  const accounts = data.accounts || []
  const creditCardAccounts = accounts.filter(a => a.type === 'Credit Card')

  const mappedDebts = useMemo(() => {
    const existingDebtAccIds = new Set(debts.map(d => d.accountId).filter(Boolean))

    const baseDebts = debts.map(d => {
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

    const synthesizedDebts = accounts
      .filter(a => a.type === 'Credit Card' && !existingDebtAccIds.has(a._id))
      .map(a => ({
        _id: `synth_${a._id}`,
        name: a.name,
        type: 'Credit Card',
        balance: Math.abs(Number(a.balance) || 0),
        originalAmount: Math.abs(Number(a.balance) || 0),
        interestRate: 0,
        minPayment: 0,
        dueDate: '',
        statementDate: '',
        color: a.color || 'var(--red)',
        notes: a.notes || '',
        accountId: a._id,
        isSynthesized: true,
      }))

    return [...baseDebts, ...synthesizedDebts]
  }, [debts, accounts])

  const creditCards = useMemo(() => mappedDebts.filter(d => d.type === 'Credit Card'), [mappedDebts])
  const loansAndOthers = useMemo(() => mappedDebts.filter(d => d.type !== 'Credit Card'), [mappedDebts])

  async function handlePayment(debt) {
    const prevBalance = debt.balance || 0
    const original = debt.originalAmount || prevBalance || 0
    const value = parseFloat(payments[debt._id] || 0)
    const fromAccountId = paymentSources[debt._id]
    const monthKey = getMonthKey(today())
    const paymentRecord = { date: today(), amount: value }

    if (!Number.isFinite(value) || value <= 0) {
      notifyApp({ title: 'Check payment', message: 'Add a payment amount greater than zero.', tone: 'warning' })
      return
    }

    try {
      if (debt.accountId) {
        if (!fromAccountId) {
          notifyApp({ title: 'Select account', message: 'Please select a cash/bank account to pay from.', tone: 'warning' })
          return
        }
        await fsTransferAccounts(user.uid, {
          desc: `Debt Payment: ${debt.name}`,
          amount: value,
          date: today(),
          fromAccountId: fromAccountId,
          toAccountId: debt.accountId,
          source: 'debt-payment'
        }, data.accounts || [])
        if (!debt.isSynthesized) {
          await fsUpdate(user.uid, 'debts', debt._id, { [`paidPeriods.${monthKey}`]: paymentRecord })
        }
      } else {
        const newBalance = Math.max(0, (debt.balance || 0) - value)
        await fsUpdate(user.uid, 'debts', debt._id, { 
          balance: newBalance,
          [`paidPeriods.${monthKey}`]: paymentRecord
        })
      }

      const newBalance = Math.max(0, prevBalance - value)
      let milestoneReached = null

      if (prevBalance > 0 && newBalance === 0) {
        milestoneReached = '100% Paid Off! 🎉'
      } else if (original > 0) {
        const prevPctPaid = Math.round(((original - prevBalance) / original) * 100)
        const newPctPaid = Math.round(((original - newBalance) / original) * 100)

        if (prevPctPaid < 75 && newPctPaid >= 75) {
          milestoneReached = '75% Paid Off! 🚀'
        } else if (prevPctPaid < 50 && newPctPaid >= 50) {
          milestoneReached = '50% Paid Off! ⭐'
        }
      }

      if (milestoneReached) {
        setActiveMilestone({ label: milestoneReached, debtName: debt.name })
      }

      setPayments(current => ({ ...current, [debt._id]: '' }))
      setPaymentSources(current => ({ ...current, [debt._id]: '' }))
      notifyApp({
        title: 'Payment logged',
        message: `Paid ${fmt(value, s)} toward ${debt.name}.`,
        tone: 'success',
      })
    } catch {
      notifyApp({ title: 'Payment failed', message: 'Could not record transfer. Try again.', tone: 'error' })
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

  const renderCard = (debt) => {
    const balance = Number(debt.balance) || 0
    const original = Number(debt.originalAmount) || balance
    const pctPaid = original > 0 ? Math.min(100, Math.round(((original - balance) / original) * 100)) : 0
    const isCleared = balance === 0
    const debtTx = getDebtTransactions(debt)

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
            <div className={dStyles.detailsLabel}>Statement Day</div>
            <div className={dStyles.detailsValue}>{debt.statementDate ? `Day ${debt.statementDate}` : '—'}</div>
          </div>
          <div className={dStyles.debtCol}>
            <div className={dStyles.detailsLabel}>Due Day</div>
            <div className={dStyles.detailsValue}>{debt.dueDate ? `Day ${debt.dueDate}` : '—'}</div>
          </div>

          {debt.type === 'Credit Card' && (
            <>
              <div className={dStyles.debtCol}>
                <div className={dStyles.detailsLabel}>Limit</div>
                <div className={dStyles.detailsValue}>
                  {(() => {
                    const linkedAcc = debt.accountId ? accounts.find(a => a._id === debt.accountId) : null
                    const limit = linkedAcc ? (Number(linkedAcc.creditLimit) || 0) : (Number(debt.creditLimit) || 0)
                    return money(limit)
                  })()}
                </div>
              </div>
              <div className={dStyles.debtCol}>
                <div className={dStyles.detailsLabel}>Available</div>
                <div className={dStyles.detailsValue}>
                  {(() => {
                    const linkedAcc = debt.accountId ? accounts.find(a => a._id === debt.accountId) : null
                    const limit = linkedAcc ? (Number(linkedAcc.creditLimit) || 0) : (Number(debt.creditLimit) || 0)
                    return money(Math.max(0, limit - balance))
                  })()}
                </div>
              </div>
              <div className={dStyles.debtCol}>
                <div className={dStyles.detailsLabel}>Utilization</div>
                <div className={dStyles.detailsValue}>
                  {(() => {
                    const linkedAcc = debt.accountId ? accounts.find(a => a._id === debt.accountId) : null
                    const limit = linkedAcc ? (Number(linkedAcc.creditLimit) || 0) : (Number(debt.creditLimit) || 0)
                    const util = limit > 0 ? Math.min(100, Math.round((balance / limit) * 100)) : 0
                    return `${util}%`
                  })()}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Progress bar / Utilization Bar */}
        {!isCleared && (
          debt.type === 'Credit Card' ? (
            (() => {
              const linkedAcc = debt.accountId ? accounts.find(a => a._id === debt.accountId) : null
              const limit = linkedAcc ? (Number(linkedAcc.creditLimit) || 0) : (Number(debt.creditLimit) || 0)
              const utilization = limit > 0 ? Math.min(100, Math.round((balance / limit) * 100)) : 0
              
              const barColor = utilization < 30
                ? 'var(--accent)'
                : utilization <= 70
                  ? 'var(--amber)'
                  : 'var(--red)'
                  
              return (
                <div className={dStyles.progressBlock}>
                  <div className={dStyles.progressMeta}>
                    <span>Credit Utilization</span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {utilization > 30 && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--amber)', fontWeight: 'bold' }}>⚠️ High</span>
                      )}
                      <span style={{ color: barColor, fontWeight: 700 }}>{utilization}%</span>
                    </div>
                  </div>
                  <div className={dStyles.progressBar}>
                    <div
                      className={dStyles.progressFill}
                      style={{ width: `${utilization}%`, background: barColor }}
                    />
                  </div>
                </div>
              )
            })()
          ) : (
            original > 0 && (
              <div className={dStyles.progressBlock}>
                <div className={dStyles.progressMeta}>
                  <span>{pctPaid}% paid off</span>
                  <span>{money(original - balance)} paid</span>
                </div>
                <div className={dStyles.progressBar}>
                  <div className={dStyles.progressFill} style={{ width: `${pctPaid}%` }} />
                </div>
              </div>
            )
          )
        )}

        {/* Payment actions */}
        {!isCleared && (
          <div className={dStyles.paymentActions} style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'stretch' }}>
            {debt.accountId && (
              <select
                className={dStyles.paymentInput}
                value={paymentSources[debt._id] || ''}
                onChange={event => setPaymentSources(current => ({ ...current, [debt._id]: event.target.value }))}
              >
                <option value="">Pay from account...</option>
                {(data.accounts || []).filter(a => a.type !== 'Credit Card').map(a => (
                  <option key={a._id} value={a._id}>{a.name} ({fmt(a.balance, s)})</option>
                ))}
              </select>
            )}
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <input
                type="number"
                className={dStyles.paymentInput}
                min="0"
                inputMode="decimal"
                style={{ flex: 1, minWidth: 0 }}
                placeholder={`Amount (${s})`}
                value={payments[debt._id] || ''}
                onChange={event => setPayments(current => ({ ...current, [debt._id]: event.target.value }))}
                onKeyDown={event => {
                  if (event.key === 'Enter') handlePayment(debt)
                }}
              />
              <button
                type="button"
                className={dStyles.payBtn}
                style={{ width: 'auto', flexShrink: 0 }}
                onClick={() => { playTick(); handlePayment(debt); }}
              >
                Pay
              </button>
            </div>
          </div>
        )}

        {isCleared && (
          <div className={dStyles.clearedBanner}>
            <span>🎉 This debt is completely paid off!</span>
          </div>
        )}

        {/* Transaction History Section */}
        <div className={dStyles.historySection}>
          <button
            type="button"
            className={dStyles.historyToggle}
            onClick={() => {
              playTick()
              setExpandedHistory(prev => ({ ...prev, [debt._id]: !prev[debt._id] }))
            }}
          >
            <span>{expandedHistory[debt._id] ? '▼ Hide Transaction History' : '▶ Show Transaction History'}</span>
            <span className={dStyles.historyBadge}>{debtTx.length}</span>
          </button>

          {expandedHistory[debt._id] && (
            <div className={dStyles.historyList}>
              {debtTx.length === 0 ? (
                <div className={dStyles.emptyHistory}>No recorded transactions for this debt.</div>
              ) : (
                <div className={dStyles.historyTable}>
                  {debtTx.map(tx => {
                    const isPayment = (tx.type === 'transfer' && tx.toAccountId === debt.accountId) || 
                                      (tx.type === 'income' && tx.accountId === debt.accountId) ||
                                      (tx.desc && tx.desc.toLowerCase().includes('payment'))
                    const amtSign = isPayment ? '-' : '+'
                    const amtColor = isPayment ? 'var(--accent)' : 'var(--red)'
                    
                    return (
                      <div key={tx._id} className={dStyles.historyRow}>
                        <div className={dStyles.historyMetaCol}>
                          <div className={dStyles.historyDate}>{tx.date}</div>
                          <div className={dStyles.historyDesc}>{tx.desc}</div>
                          {tx.cat && <div className={dStyles.historyCategory}>{tx.cat} {tx.subcat ? `› ${tx.subcat}` : ''}</div>}
                        </div>
                        <div className={dStyles.historyAmountCol} style={{ color: amtColor }}>
                          {amtSign}{money(tx.amount)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }
  return (
    <div className={styles.page}>
      {/* Hero Header */}
      <div className={styles.pageHero}>
        <div className={styles.pageHeader}>
          <div className={styles.pageEyebrow}>Plan · Debts</div>
          <div className={styles.pageTitle}>Take command of what you owe.</div>
          <div className={styles.pageSub}>
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
      <div id="takda-debts-summary" className={dStyles.totalCard}>
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

            {schedule.error ? (
              <div className={dStyles.deficitWarningCard}>
                <h4>⚠️ Underfunded Payoff Deficit</h4>
                <p>Your current monthly minimum payments and extra budget are insufficient to cover interest accumulation.</p>
                <p>Increase your Extra Monthly Payment slider until the budget exceeds the monthly interest to see your payoff timeline projection.</p>
              </div>
            ) : (
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
            )}
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
            <div className={dStyles.formRowFull}>
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
            </div>

            <div className={dStyles.formRowTwoCol}>
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

              {form.type === 'Credit Card' ? (
                <div className={dStyles.field}>
                  <label className={dStyles.fieldLabel} htmlFor="debt-limit">Credit Limit ({s})</label>
                  <input
                    id="debt-limit"
                    className={dStyles.fieldInput}
                    type="number"
                    min="0"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={form.creditLimit}
                    onChange={event => set('creditLimit', event.target.value)}
                  />
                </div>
              ) : form.type === 'Informal' ? (
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
              ) : (
                <div className={dStyles.fieldEmptyPlaceholder} />
              )}
            </div>

            <div className={dStyles.formRowTwoCol}>
              <div className={dStyles.field}>
                <label className={dStyles.fieldLabel} htmlFor="debt-balance">
                  {form.type === 'Credit Card' ? `Current Amount Owed (${s})` : `Current Balance (${s})`}
                </label>
                <input
                  id="debt-balance"
                  className={dStyles.fieldInput}
                  type="number"
                  min="0"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={form.balance}
                  onChange={event => set('balance', event.target.value)}
                />
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
            </div>

            <div className={dStyles.formRowTwoCol}>
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
            </div>

            <div className={dStyles.formRowTwoCol}>
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
              <div className={dStyles.field}>
                <label className={dStyles.fieldLabel} htmlFor="debt-statement">Statement Day</label>
                <input
                  id="debt-statement"
                  className={dStyles.fieldInput}
                  type="number"
                  min="1"
                  max="31"
                  placeholder="e.g. 5"
                  value={form.statementDate}
                  onChange={event => set('statementDate', event.target.value)}
                />
              </div>
            </div>
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
        <div className={dStyles.sectionsWrapper}>
          {creditCards.length > 0 && (
            <div className={dStyles.sectionBlock}>
              <h3 className={dStyles.listSectionTitle}>💳 Credit Cards</h3>
              <div className={dStyles.debtsGrid}>
                {creditCards.map(renderCard)}
              </div>
            </div>
          )}

          {loansAndOthers.length > 0 && (
            <div className={dStyles.sectionBlock}>
              <h3 className={dStyles.listSectionTitle}>📁 Loans & Debts</h3>
              <div className={dStyles.debtsGrid}>
                {loansAndOthers.map(renderCard)}
              </div>
            </div>
          )}
        </div>
      )}

      {activeMilestone && (
        <div className={dStyles.celebrationOverlay} onClick={() => setActiveMilestone(null)}>
          <div className={dStyles.celebrationModal}>
            <div className={dStyles.confettiWrapper}>
              {Array.from({ length: 30 }).map((_, idx) => (
                <div key={idx} className={dStyles.confettiPiece} style={{
                  '--left': `${Math.random() * 100}%`,
                  '--delay': `${Math.random() * 2}s`,
                  '--bg': ['#ff5370', '#22d87a', '#ffb627', '#00e5ff'][idx % 4],
                  '--duration': `${1.5 + Math.random() * 1.5}s`
                }} />
              ))}
            </div>
            <h2>Milestone Reached!</h2>
            <div className={dStyles.milestoneLabel}>{activeMilestone.label}</div>
            <p>You have made major progress paying off <strong>{activeMilestone.debtName}</strong>. Keep going!</p>
            <button className={dStyles.primaryButton} onClick={() => setActiveMilestone(null)}>Awesome</button>
          </div>
        </div>
      )}
    </div>
  )
}
