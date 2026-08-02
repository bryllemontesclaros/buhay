import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { deleteField } from 'firebase/firestore'
import { fsAdd, fsDel, fsDeleteTransaction, fsMarkBillPaid, fsUpdate } from '../lib/firestore'
import { confirmApp, confirmDeleteApp, notifyApp } from '../lib/appFeedback'
import { getBillPeriodInfo, getVirtualBills } from '../lib/bills'
import { findBillPresetByLabel, getBillPresetByKey, getBillPresetGroups, getBillQuickItems, getTransactionSubcategories } from '../lib/transactionOptions'
import { fmt, formatDisplayDate, RECUR_OPTIONS, today, playTick, displayValue, maskMoney } from '../lib/utils'
import { Button } from '../components/ui/Button'
import styles from './Page.module.css'
import bStyles from './Bills.module.css'

const BILL_FREQS = RECUR_OPTIONS.filter(option => option.value !== '' && option.value !== 'daily')

function createBillForm() {
  return {
    name: '',
    amount: '',
    due: '',
    dueMonth: '',
    cat: 'Bills',
    subcat: getTransactionSubcategories('expense', 'Bills')[0],
    presetKey: '',
    freq: 'monthly',
    accountId: '',
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function getBillDueLabel(bill) {
  const freq = bill.freq || 'monthly'
  const due = Number(bill.due)
  const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  
  if (freq === 'weekly' || freq === 'bi-weekly') {
    return weekDays[due] || `Day ${due}`
  }
  if (freq === 'yearly') {
    const monthName = MONTHS[Number(bill.dueMonth) || 0] || 'Jan'
    return `${monthName} ${due}`
  }
  return `Day ${due}`
}

function getStatusStyle(status) {
  if (status === 'paid') return { background: 'var(--accent-glow)', color: 'var(--accent)' }
  if (status === 'overdue') return { background: 'var(--red-dim)', color: 'var(--red)' }
  if (status === 'due' || status === 'soon') return { background: 'var(--amber-dim)', color: 'var(--amber)' }
  return { background: 'var(--blue-dim)', color: 'var(--blue)' }
}

function getBillStatusRank(status = '') {
  return {
    overdue: 0,
    due: 1,
    soon: 2,
    upcoming: 3,
    paid: 4,
  }[status] ?? 9
}

function getMonthlyEquivalent(amount, freq = 'monthly') {
  const numericAmount = Number(amount) || 0
  if (!numericAmount) return 0
  switch (freq) {
    case 'weekly': return (numericAmount * 52) / 12
    case 'bi-weekly': return (numericAmount * 26) / 12
    case 'tri-weekly': return (numericAmount * (365 / 21)) / 12
    case 'quad-weekly': return (numericAmount * (365 / 28)) / 12
    case 'semi-monthly': return (numericAmount * 24) / 12
    case 'yearly': return numericAmount / 12
    case 'monthly':
    default:
      return numericAmount
  }
}

let globalHandledTargetAt = 0

export default function Bills({ user, data, symbol, privacyMode = false, billPaymentTarget = null, embedded = false }) {
  const s = symbol || '₱'
  const money = value => displayValue(privacyMode, fmt(value, s), maskMoney(s))
  const [form, setForm] = useState(createBillForm())
  const [paymentBill, setPaymentBill] = useState(null)
  const [paymentForm, setPaymentForm] = useState({ amount: '', date: today(), accountId: '' })
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  const accounts = Array.isArray(data?.accounts) ? data.accounts : []

  const accountNameById = useMemo(() => {
    const map = new Map()
    accounts.forEach(acc => {
      if (acc?._id) map.set(acc._id, acc.name || 'Account')
    })
    return map
  }, [accounts])
  const quickPresets = useMemo(() => getBillQuickItems(), [])
  const presetGroups = useMemo(() => getBillPresetGroups(), [])
  const subcategories = useMemo(() => getTransactionSubcategories('expense', 'Bills'), [])
  const selectedPreset = useMemo(() => getBillPresetByKey(form.presetKey), [form.presetKey])
  const allBillsList = useMemo(() => [
    ...(data?.bills || []),
    ...getVirtualBills(data)
  ], [data?.bills, data?.debts, data?.accounts])

  const billsWithStatus = useMemo(() => allBillsList.map(bill => ({
    ...bill,
    period: getBillPeriodInfo(bill),
  })), [allBillsList])
  const sortedBillsWithStatus = useMemo(() => {
    return [...billsWithStatus].sort((left, right) => {
      const leftRank = getBillStatusRank(left.period?.status)
      const rightRank = getBillStatusRank(right.period?.status)
      if (leftRank !== rightRank) return leftRank - rightRank
      return String(left.period?.dueDate || '').localeCompare(String(right.period?.dueDate || ''))
    })
  }, [billsWithStatus])

  const overdueBills = useMemo(() => sortedBillsWithStatus.filter(b => b.period?.status === 'overdue'), [sortedBillsWithStatus])
  const dueSoonBills = useMemo(() => sortedBillsWithStatus.filter(b => b.period?.status === 'due' || b.period?.status === 'soon'), [sortedBillsWithStatus])
  const upcomingBills = useMemo(() => sortedBillsWithStatus.filter(b => b.period?.status === 'upcoming'), [sortedBillsWithStatus])
  const paidBills = useMemo(() => sortedBillsWithStatus.filter(b => b.period?.status === 'paid'), [sortedBillsWithStatus])
  const billTrustStats = useMemo(() => {
    const stats = billsWithStatus.reduce((summary, bill) => {
      const monthly = getMonthlyEquivalent(bill.amount, bill.freq)
      const status = bill.period?.status || ''
      return {
        monthlyCommitment: summary.monthlyCommitment + monthly,
        overdue: summary.overdue + (status === 'overdue' ? 1 : 0),
        dueSoon: summary.dueSoon + (status === 'due' || status === 'soon' ? 1 : 0),
        paid: summary.paid + (bill.period?.paid ? 1 : 0),
        linked: summary.linked + (bill.accountId ? 1 : 0),
      }
    }, { monthlyCommitment: 0, overdue: 0, dueSoon: 0, paid: 0, linked: 0 })

    return {
      ...stats,
      total: billsWithStatus.length,
    }
  }, [billsWithStatus])

  function set(key, value) {
    setForm(current => ({ ...current, [key]: value }))
  }

  const billNameInputRef = useRef(null)

  function applyPreset(preset) {
    if (!preset || preset.isCustom) {
      setForm(current => ({ ...current, name: '', presetKey: 'other', cat: 'Bills' }))
      setTimeout(() => {
        if (billNameInputRef.current) billNameInputRef.current.focus()
      }, 50)
      return
    }
    setForm(current => ({
      ...current,
      name: preset.desc || preset.label,
      cat: 'Bills',
      subcat: preset.subcat,
      presetKey: preset.key,
    }))
  }

  function handleSubcategoryChange(value) {
    setForm(current => ({
      ...current,
      cat: 'Bills',
      subcat: value,
      presetKey: '',
    }))
  }

  function handleNameChange(value) {
    const matchedPreset = findBillPresetByLabel(value)
    setForm(current => {
      if (!matchedPreset || matchedPreset.isCustom) {
        return { ...current, name: value, presetKey: '' }
      }
      return {
        ...current,
        name: value,
        cat: 'Bills',
        subcat: matchedPreset.subcat,
        presetKey: matchedPreset.key,
      }
    })
  }

  async function handleAdd() {
    const amount = Number(form.amount)
    const due = Number(form.due)
    const freq = form.freq || 'monthly'

    if (!form.name.trim() || !form.amount || form.due === '') {
      notifyApp({ title: 'Bill needs details', message: 'Add a bill name, amount, and due day before saving.', tone: 'warning' })
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      notifyApp({ title: 'Check bill amount', message: 'Bill amount must be greater than zero.', tone: 'warning' })
      return
    }

    if (freq === 'weekly' || freq === 'bi-weekly') {
      if (!Number.isFinite(due) || due < 0 || due > 6) {
        notifyApp({ title: 'Check weekday', message: 'Please select a valid weekday.', tone: 'warning' })
        return
      }
    } else {
      if (!Number.isFinite(due) || due < 1 || due > 31) {
        notifyApp({ title: 'Check due day', message: 'Due day must be between 1 and 31.', tone: 'warning' })
        return
      }
    }

    const payload = {
      name: form.name.trim(),
      amount,
      due: parseInt(form.due, 10),
      cat: 'Bills',
      subcat: form.subcat,
      presetKey: form.presetKey || '',
      freq: form.freq,
      paid: false,
      paidPeriods: {},
      type: 'bill',
      accountId: form.accountId || '',
    }

    if (freq === 'yearly') {
      payload.dueMonth = parseInt(form.dueMonth || '0', 10)
    }

    await fsAdd(user.uid, 'bills', payload)
    setForm(createBillForm())
  }

  function openPayment(bill) {
    playTick()
    setPaymentBill(bill)
    setPaymentForm({
      amount: String(Number(bill.amount) || ''),
      date: today(),
      accountId: bill.accountId || accounts[0]?._id || '',
    })
  }

  function closePayment() {
    setPaymentBill(null)
    setPaymentForm({ amount: '', date: today(), accountId: '' })
  }

  async function handleMarkPaid() {
    playTick()
    if (!paymentBill) return
    const amount = Number(paymentForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      notifyApp({ title: 'Check payment amount', message: 'Payment amount must be greater than zero.', tone: 'warning' })
      return
    }
    if (!paymentForm.date) {
      notifyApp({ title: 'Payment date needed', message: 'Choose the date this bill was paid.', tone: 'warning' })
      return
    }

    setPaymentSaving(true)
    try {
      await fsMarkBillPaid(user.uid, paymentBill, {
        amount,
        date: paymentForm.date,
        accountId: paymentForm.accountId,
        source: 'bill-payment',
      }, accounts)
      notifyApp({
        title: 'Bill marked paid',
        message: `${paymentBill.name} was saved as an expense${paymentForm.accountId ? ' and applied to the selected account' : ''}.`,
        tone: 'success',
      })
      closePayment()
    } catch {
      notifyApp({ title: 'Payment not saved', message: 'Could not save this payment right now. Check your connection and try again.', tone: 'error' })
    } finally {
      setPaymentSaving(false)
    }
  }

  async function handleUndoPaid(bill) {
    playTick()
    const period = getBillPeriodInfo(bill)
    const paidPeriodRecord = bill.paidPeriods ? bill.paidPeriods[period.key] : null
    const expenseId = paidPeriodRecord ? paidPeriodRecord.expenseId : ''

    const confirmed = await confirmApp({
      title: 'Undo paid status?',
      message: `This will mark ${bill.name} unpaid for ${formatDisplayDate(period.dueDate)} and delete the corresponding expense from History.`,
      confirmLabel: 'Undo paid & Delete Expense',
      cancelLabel: 'Keep paid',
      tone: 'danger',
    })
    if (!confirmed) return

    if (expenseId) {
      const expenseObj = (data.expenses || []).find(e => e._id === expenseId)
      if (expenseObj) {
        await fsDeleteTransaction(user.uid, 'expenses', expenseObj, data.accounts)
      }
    }

    await fsUpdate(user.uid, 'bills', bill._id, {
      [`paidPeriods.${period.key}`]: deleteField(),
      paid: false,
      paidAt: null,
      lastPaidPeriod: '',
      lastPaidExpenseId: '',
    })

    notifyApp({ title: 'Bill unpaid', message: 'Bill status was undone and its transaction removed.', tone: 'success' })
  }

  useEffect(() => {
    if (!billPaymentTarget?.billId) return
    if (globalHandledTargetAt === billPaymentTarget.at) return
    const allBills = [...(data?.bills || []), ...getVirtualBills(data)]
    const target = allBills.find(bill => bill._id === billPaymentTarget.billId)
    if (!target) return
    openPayment(target)
    globalHandledTargetAt = billPaymentTarget.at
  }, [billPaymentTarget?.at, billPaymentTarget?.billId, data])

  const paymentPeriod = paymentBill ? getBillPeriodInfo(paymentBill) : null
  const paymentAccountName = paymentForm.accountId ? accountNameById.get(paymentForm.accountId) || 'Selected account' : ''

  const renderBillCard = (row) => {
    const statusPeriod = row.period || {}
    const isPaid = statusPeriod.paid
    const statusStyle = getStatusStyle(statusPeriod.status)
    const dueLabel = getBillDueLabel(row)
    
    return (
      <div key={row._id} className={`${bStyles.billCard} ${isPaid ? bStyles.billCardPaid : ''}`}>
        <div className={bStyles.billCardHeader}>
          <div>
            <h4 className={bStyles.billCardTitle}>{row.name}</h4>
            <span className={bStyles.billCardSubcat}>{row.subcat || row.cat}</span>
          </div>
          <span style={{ ...statusStyle, borderRadius: 20, padding: '4px 10px', fontSize: 10, fontWeight: 700 }}>
            {statusPeriod.label}
          </span>
        </div>
        <div className={bStyles.billCardBody}>
          <div className={bStyles.billCardDetail}>
            <span className={bStyles.detailLabel}>Account</span>
            <span className={bStyles.detailValue}>
              {row.accountId ? (accountNameById.get(row.accountId) || 'Missing account') : 'Choose when paying'}
            </span>
          </div>
          <div className={bStyles.billCardDetail}>
            <span className={bStyles.detailLabel}>Due Date</span>
            <span className={bStyles.detailValue}>
              {dueLabel} ({formatDisplayDate(statusPeriod.dueDate)})
            </span>
          </div>
          <div className={bStyles.billCardDetail}>
            <span className={bStyles.detailLabel}>Frequency</span>
            <span className={bStyles.detailValue}>
              {BILL_FREQS.find(option => option.value === row.freq)?.label || row.freq}
            </span>
          </div>
        </div>
        <div className={bStyles.billCardFooter}>
          <div className={bStyles.billCardPrice}>
            <span className={bStyles.detailLabel}>Amount</span>
            <strong className={bStyles.billCardAmount}>{money(row.amount)}</strong>
          </div>
          <div className={bStyles.billCardActions}>
            {isPaid ? (
              <button type="button" className={bStyles.undoBtn} onClick={() => handleUndoPaid(row)}>Undo</button>
            ) : (
              <button type="button" className={bStyles.payBtn} onClick={() => openPayment(row)}>
                {statusPeriod.status === 'overdue' ? 'Pay overdue' : 'Mark paid'}
              </button>
            )}
            {!row.isVirtual && (
              <button type="button" className={bStyles.delBtn} onClick={async () => { if (await confirmDeleteApp(row.name)) await fsDel(user.uid, 'bills', row._id) }}>×</button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className={embedded ? '' : styles.page}>
        {!embedded && (
          <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className={styles.title}>Bills</div>
              <div className={styles.sub}>Plan recurring bills here, then mark a period paid only when money actually leaves an account.</div>
            </div>
            <Button type="button" variant="primary" onClick={() => setShowDrawer(true)}>
              + Add Bill
            </Button>
          </div>
        )}
        
        {embedded && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ color: 'var(--text2)', fontSize: '14px' }}>
              Plan recurring bills, then mark them paid when money leaves an account.
            </div>
            <Button type="button" variant="primary" onClick={() => setShowDrawer(true)}>
              + Add Bill
            </Button>
          </div>
        )}

        <div className={styles.trustGrid}>
          <div className={styles.trustCard}>
            <span>Monthly commitment</span>
            <strong>{money(billTrustStats.monthlyCommitment)}</strong>
            <small>Monthly equivalent across all active recurring bills.</small>
          </div>
          <div className={styles.trustCard}>
            <span>Needs attention</span>
            <strong>{billTrustStats.overdue ? `${billTrustStats.overdue} overdue` : `${billTrustStats.dueSoon} due soon`}</strong>
            <small>{billTrustStats.overdue ? 'Overdue bills can still be marked paid.' : 'Due and upcoming bills are ready to review.'}</small>
          </div>
          <div className={styles.trustCard}>
            <span>Account defaults</span>
            <strong>{billTrustStats.linked}/{billTrustStats.total || 0}</strong>
            <small>Default pay-from accounts are optional and can be changed on payment.</small>
          </div>
          <div className={styles.trustCard}>
            <span>Payment rule</span>
            <strong>Paid creates expense</strong>
            <small>Marking paid creates one History expense. Account movement happens only if an account is selected.</small>
          </div>
        </div>

        <div className={bStyles.prioritySections}>
          {overdueBills.length > 0 && (
            <div className={bStyles.prioritySection}>
              <h3 className={bStyles.sectionHeader} style={{ color: 'var(--red)' }}>🔴 Overdue</h3>
              <div className={bStyles.billsGrid}>
                {overdueBills.map(renderBillCard)}
              </div>
            </div>
          )}

          {dueSoonBills.length > 0 && (
            <div className={bStyles.prioritySection}>
              <h3 className={bStyles.sectionHeader} style={{ color: 'var(--amber)' }}>⏳ Due Soon</h3>
              <div className={bStyles.billsGrid}>
                {dueSoonBills.map(renderBillCard)}
              </div>
            </div>
          )}

          {upcomingBills.length > 0 && (
            <div className={bStyles.prioritySection}>
              <h3 className={bStyles.sectionHeader} style={{ color: 'var(--blue)' }}>📅 Upcoming</h3>
              <div className={bStyles.billsGrid}>
                {upcomingBills.map(renderBillCard)}
              </div>
            </div>
          )}

          {paidBills.length > 0 && (
            <div className={bStyles.prioritySection}>
              <h3 className={bStyles.sectionHeader} style={{ color: 'var(--accent)' }}>✅ Paid</h3>
              <div className={bStyles.billsGrid}>
                {paidBills.map(renderBillCard)}
              </div>
            </div>
          )}

          {sortedBillsWithStatus.length === 0 && (
            <div className={bStyles.emptyState}>
              <h4>No active bills yet</h4>
              <div style={{ marginTop: '16px' }}>
                <Button type="button" variant="primary" onClick={() => setShowDrawer(true)}>+ Add Bill</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showDrawer && createPortal(
        <div className={bStyles.drawerOverlay} onClick={() => setShowDrawer(false)}>
          <div className={bStyles.drawerModal} onClick={e => e.stopPropagation()}>
            <div className={bStyles.drawerHeader}>
              <h3>Add Recurring Bill</h3>
              <button className={bStyles.drawerClose} onClick={() => setShowDrawer(false)}>✕</button>
            </div>
            <div className={bStyles.drawerBody}>
              <div className={styles.formGroup}>
                <label>What bill is this for?</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                  {quickPresets.map(item => {
                    const isSelected = form.presetKey === item.key || (item.isCustom && form.presetKey === 'other')
                    return (
                      <button
                        key={item.key}
                        type="button"
                        className={styles.chip}
                        onClick={() => item.isCustom ? applyPreset(null) : applyPreset(item)}
                        style={isSelected ? { borderColor: 'var(--amber)', background: 'var(--amber-glow)', color: 'var(--amber)' } : {}}
                      >
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Bill name</label>
                <input ref={billNameInputRef} placeholder="e.g. Meralco" value={form.name} onChange={e => handleNameChange(e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label>Amount ({s})</label>
                <input type="number" min="0" placeholder="0.00" value={form.amount} onChange={e => set('amount', e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label>Frequency</label>
                <select value={form.freq} onChange={e => {
                  const nextFreq = e.target.value
                  let defaultDue = '15'
                  if (nextFreq === 'weekly' || nextFreq === 'bi-weekly') {
                    defaultDue = '5'
                  }
                  setForm(current => ({ ...current, freq: nextFreq, due: defaultDue, dueMonth: nextFreq === 'yearly' ? '0' : '' }))
                }}>
                  {BILL_FREQS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div className={styles.formGroup}>
                {form.freq === 'weekly' || form.freq === 'bi-weekly' ? (
                  <>
                    <label>Due day of week</label>
                    <select value={form.due} onChange={e => set('due', e.target.value)}>
                      <option value="0">Sunday</option>
                      <option value="1">Monday</option>
                      <option value="2">Tuesday</option>
                      <option value="3">Wednesday</option>
                      <option value="4">Thursday</option>
                      <option value="5">Friday</option>
                      <option value="6">Saturday</option>
                    </select>
                  </>
                ) : form.freq === 'yearly' ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <label>Due Month</label>
                      <select value={form.dueMonth || '0'} onChange={e => set('dueMonth', e.target.value)}>
                        {MONTHS.map((m, idx) => (
                          <option key={m} value={String(idx)}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ width: '80px' }}>
                      <label>Day (1-31)</label>
                      <input type="number" min={1} max={31} value={form.due} onChange={e => set('due', e.target.value)} />
                    </div>
                  </div>
                ) : (
                  <>
                    <label>Due day of month (1-31)</label>
                    <input type="number" min={1} max={31} placeholder="e.g. 15" value={form.due} onChange={e => set('due', e.target.value)} />
                  </>
                )}
              </div>
              <div className={styles.formGroup}>
                <label>Browse presets</label>
                <select
                  value={form.presetKey || 'other-custom'}
                  onChange={event => {
                    const preset = getBillPresetByKey(event.target.value)
                    if (!preset || preset.isCustom) {
                      applyPreset(null)
                      return
                    }
                    applyPreset(preset)
                  }}
                >
                  <option value="other-custom">Custom bill</option>
                  {presetGroups.map(group => (
                    <optgroup key={group.label} label={group.label}>
                      {group.items.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Bill type</label>
                <select value={form.subcat} onChange={e => handleSubcategoryChange(e.target.value)}>
                  {subcategories.map(option => <option key={option}>{option}</option>)}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Default pay-from account</label>
                <select value={form.accountId} onChange={e => set('accountId', e.target.value)}>
                  <option value="">Choose when paying</option>
                  {accounts.map(acc => (
                    <option key={acc._id} value={acc._id}>
                      {acc.name} - {acc.type}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={bStyles.drawerFooter}>
              <button className={styles.btnGhost} onClick={() => setShowDrawer(false)} style={{ flex: 1 }}>Cancel</button>
              <button className={styles.btnAdd} onClick={handleAdd} style={{ flex: 2, margin: 0 }}>Add Bill</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {paymentBill && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Mark ${paymentBill.name} paid`}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 700,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '24px 16px',
            background: 'rgba(8, 12, 18, 0.22)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
          }}
          onClick={event => {
            if (event.target === event.currentTarget) closePayment()
          }}
        >
          <div style={{ margin: 'auto 0', width: '100%', display: 'flex', justifyContent: 'center' }}>
            <div className={styles.formCard} style={{ width: 'min(500px, 100%)', margin: 0, padding: 24, backgroundColor: 'var(--surface)', borderRadius: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, margin: '0 0 16px', color: 'var(--text)' }}>
                Mark {paymentBill.name} paid
              </h2>

              <div className={styles.formGroup}>
                <label>Amount ({s})</label>
                <input
                  type="number"
                  min="0"
                  value={paymentForm.amount}
                  onChange={event => setPaymentForm(current => ({ ...current, amount: event.target.value }))}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Payment date</label>
                <div className={styles.dateFieldWrap}>
                  <div className={styles.dateFieldDisplay}>
                    {paymentForm.date ? formatDisplayDate(paymentForm.date) : 'Choose date'}
                  </div>
                  <input
                    type="date"
                    className={styles.dateFieldNative}
                    value={paymentForm.date}
                    onChange={event => setPaymentForm(current => ({ ...current, date: event.target.value }))}
                  />
                </div>
                <div className={styles.helper}>Due for this period: {formatDisplayDate(paymentPeriod?.dueDate)}</div>
              </div>
              <div className={styles.formGroup}>
                <label>Pay from account</label>
                <select
                  value={paymentForm.accountId}
                  onChange={event => setPaymentForm(current => ({ ...current, accountId: event.target.value }))}
                >
                  <option value="">No account movement</option>
                  {accounts.map(acc => (
                    <option key={acc._id} value={acc._id}>
                      {acc.name} - {acc.type}
                    </option>
                  ))}
                </select>
                <div className={styles.helper}>
                  {paymentAccountName ? `This will deduct ${s}${paymentForm.amount || 0} from ${paymentAccountName} and record the expense in your history.` : 'This will record the expense in your history without affecting your account balances.'}
                </div>
              </div>
              <div className={styles.formRow} style={{ justifyContent: 'flex-end', marginTop: 32 }}>
                <button type="button" className={styles.btnGhost} onClick={closePayment} disabled={paymentSaving}>Cancel</button>
                <button type="button" className={styles.btnAdd} style={{ width: 'auto', padding: '0 24px' }} onClick={handleMarkPaid} disabled={paymentSaving}>
                  {paymentSaving ? 'Saving...' : 'Save payment'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
