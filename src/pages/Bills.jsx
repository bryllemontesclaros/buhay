import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { deleteField } from 'firebase/firestore'
import { fsAdd, fsDel, fsMarkBillPaid, fsUpdate } from '../lib/firestore'
import { confirmApp, confirmDeleteApp, notifyApp } from '../lib/appFeedback'
import { getBillPeriodInfo } from '../lib/bills'
import { findBillPresetByLabel, getBillPresetByKey, getBillPresetGroups, getBillQuickItems, getTransactionSubcategories } from '../lib/transactionOptions'
import { fmt, formatDisplayDate, RECUR_OPTIONS, today, playTick } from '../lib/utils'
import styles from './Page.module.css'
import bStyles from './Bills.module.css'

const BILL_FREQS = RECUR_OPTIONS.filter(option => option.value !== '' && option.value !== 'daily')

function createBillForm() {
  return {
    name: '',
    amount: '',
    due: '',
    cat: 'Bills',
    subcat: getTransactionSubcategories('expense', 'Bills')[0],
    presetKey: '',
    freq: 'monthly',
    accountId: '',
  }
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

export default function Bills({ user, data, symbol, billPaymentTarget = null }) {
  const s = symbol || '₱'
  const [form, setForm] = useState(createBillForm())
  const [paymentBill, setPaymentBill] = useState(null)
  const [paymentForm, setPaymentForm] = useState({ amount: '', date: today(), accountId: '' })
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [handledTargetAt, setHandledTargetAt] = useState(0)
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
  const billsWithStatus = useMemo(() => (data?.bills || []).map(bill => ({
    ...bill,
    period: getBillPeriodInfo(bill),
  })), [data?.bills])
  const sortedBillsWithStatus = useMemo(() => {
    return [...billsWithStatus].sort((left, right) => {
      const leftRank = getBillStatusRank(left.period?.status)
      const rightRank = getBillStatusRank(right.period?.status)
      if (leftRank !== rightRank) return leftRank - rightRank
      return String(left.period?.dueDate || '').localeCompare(String(right.period?.dueDate || ''))
    })
  }, [billsWithStatus])
  const actionBills = useMemo(
    () => sortedBillsWithStatus.filter(bill => !bill.period?.paid).slice(0, 3),
    [sortedBillsWithStatus],
  )
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

  function applyPreset(preset) {
    if (!preset || preset.isCustom) {
      setForm(current => ({ ...current, presetKey: '', cat: 'Bills' }))
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
    if (!form.name.trim() || !form.amount || !form.due) {
      notifyApp({ title: 'Bill needs details', message: 'Add a bill name, amount, and due day before saving.', tone: 'warning' })
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      notifyApp({ title: 'Check bill amount', message: 'Bill amount must be greater than zero.', tone: 'warning' })
      return
    }
    if (!Number.isFinite(due) || due < 1 || due > 31) {
      notifyApp({ title: 'Check due day', message: 'Due day must be between 1 and 31.', tone: 'warning' })
      return
    }

    await fsAdd(user.uid, 'bills', {
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
    })

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
    const confirmed = await confirmApp({
      title: 'Undo paid status?',
      message: `This will mark ${bill.name} unpaid for ${formatDisplayDate(period.dueDate)}. The expense transaction already created will stay in History unless you delete it there.`,
      confirmLabel: 'Undo paid',
      cancelLabel: 'Keep paid',
      tone: 'danger',
    })
    if (!confirmed) return

    await fsUpdate(user.uid, 'bills', bill._id, {
      [`paidPeriods.${period.key}`]: deleteField(),
      paid: false,
      paidAt: null,
      lastPaidPeriod: '',
      lastPaidExpenseId: '',
    })
  }

  useEffect(() => {
    if (!billPaymentTarget?.billId) return
    if (handledTargetAt === billPaymentTarget.at) return
    const target = (data?.bills || []).find(bill => bill._id === billPaymentTarget.billId)
    if (!target) return
    openPayment(target)
    setHandledTargetAt(billPaymentTarget.at)
  }, [billPaymentTarget?.at, billPaymentTarget?.billId, data?.bills, handledTargetAt])

  const paymentPeriod = paymentBill ? getBillPeriodInfo(paymentBill) : null
  const paymentAccountName = paymentForm.accountId ? accountNameById.get(paymentForm.accountId) || 'Selected account' : ''

  return (
    <>
      <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>Bills</div>
        <div className={styles.sub}>Plan recurring bills here, then mark a period paid only when money actually leaves an account.</div>
      </div>

      <div className={styles.trustGrid}>
        <div className={styles.trustCard}>
          <span>Monthly commitment</span>
          <strong>{fmt(billTrustStats.monthlyCommitment, s)}</strong>
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

      <div className={styles.formCard}>
        <div className={styles.cardTitle}>Pay now</div>
        <p style={{ color: 'var(--text3)', marginTop: 0 }}>
          Open the next due bill from here, then save the payment only when the money really moved.
        </p>
        {!actionBills.length ? (
          <div className={styles.helper}>Nothing is waiting for payment right now. Add a recurring bill below when you need one.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {actionBills.map(bill => (
              <button
                key={bill._id}
                type="button"
                className={styles.trustCard}
                onClick={() => openPayment(bill)}
                style={{ textAlign: 'left', cursor: 'pointer', gap: 6 }}
              >
                <span>{bill.period?.status === 'overdue' ? 'Overdue now' : bill.period?.status === 'due' ? 'Due now' : 'Up next'}</span>
                <strong>{bill.name}</strong>
                <small>
                  {formatDisplayDate(bill.period?.dueDate)} · {fmt(bill.amount, s)}
                  {bill.accountId ? ` · ${accountNameById.get(bill.accountId) || 'Linked account'}` : ' · Choose account when paying'}
                </small>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.formCard}>
        <div className={styles.cardTitle}>Add bill</div>
        <p style={{ color: 'var(--text3)', marginTop: 0 }}>
          The pay-from account is optional. Takda will not subtract anything until you mark a bill period as paid.
        </p>

        <div className={styles.formGroup}>
          <label>What bill is this for?</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
            {quickPresets.map(item => (
              <button
                key={item.key}
                type="button"
                className={styles.chip}
                onClick={() => item.isCustom ? applyPreset(null) : applyPreset(item)}
                style={form.presetKey === item.key ? { borderColor: 'var(--amber)', background: 'var(--amber-glow)', color: 'var(--amber)' } : {}}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className={styles.helper}>
            {selectedPreset && !selectedPreset.isCustom
              ? `${selectedPreset.label} auto-fills Bills -> ${selectedPreset.subcat}.`
              : 'Choose a familiar biller, or keep it custom.'}
          </div>
        </div>

        <div className={`${styles.formRow} ${styles.col2}`}>
          <div className={styles.formGroup}>
            <label>Bill name</label>
            <input placeholder="e.g. Meralco" value={form.name} onChange={e => handleNameChange(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label>Amount ({s})</label>
            <input type="number" min="0" placeholder="0.00" value={form.amount} onChange={e => set('amount', e.target.value)} />
          </div>
        </div>

        <div className={`${styles.formRow} ${styles.col2}`}>
          <div className={styles.formGroup}>
            <label>Due day (1-31)</label>
            <input type="number" min={1} max={31} placeholder="e.g. 15" value={form.due} onChange={e => set('due', e.target.value)} />
          </div>
        </div>

        <details className={styles.advancedBox}>
          <summary className={styles.advancedSummary}>
            <span>More options</span>
            <small>Bill type, frequency, default account</small>
          </summary>
          <div className={`${styles.formRow} ${styles.col2} ${styles.advancedBody}`}>
            <div className={styles.formGroup}>
              <label>Browse bill presets</label>
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
              <label>Frequency</label>
              <select value={form.freq} onChange={e => set('freq', e.target.value)}>
                {BILL_FREQS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
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
              <div className={styles.helper}>
                {accounts.length ? 'This is only the default. You can change the account every time you pay.' : 'Add accounts first if you want bill payments to update balances automatically.'}
              </div>
            </div>
          </div>
        </details>

        <div className={styles.formRow}>
          <button className={styles.btnAdd} onClick={handleAdd}>Add bill</button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Bills</div>
        <div className={`${styles.tableWrap} ${bStyles.desktopTableOnly}`}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Account</th>
                <th>Due</th>
                <th>Frequency</th>
                <th>Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!billsWithStatus.length
                ? <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text3)', padding: '2rem' }}>No bills yet. Add one above to start your bill plan.</td></tr>
                : sortedBillsWithStatus.map(row => (
                  <tr key={row._id}>
                    <td style={{ color: 'var(--text)' }}>{row.name}</td>
                    <td><span className={`${styles.badge} ${styles.badgeBill}`}>{row.subcat || row.cat}</span></td>
                    <td style={{ color: 'var(--text2)' }}>
                      {row.accountId ? (accountNameById.get(row.accountId) || 'Missing account') : 'Choose when paying'}
                    </td>
                    <td>
                      <div>Day {row.due}</div>
                      <div style={{ color: 'var(--text3)', fontSize: 11 }}>{formatDisplayDate(row.period.dueDate)}</div>
                    </td>
                    <td>{BILL_FREQS.find(option => option.value === row.freq)?.label || row.freq}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>{fmt(row.amount, s)}</td>
                    <td>
                      <span style={{ ...getStatusStyle(row.period.status), borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>
                        {row.period.label}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {row.period.paid ? (
                        <button className={styles.btnGhost} onClick={() => handleUndoPaid(row)}>Undo</button>
                      ) : (
                        <button className={styles.btnAdd} style={{ width: 'auto', minHeight: 38, padding: '8px 12px' }} onClick={() => openPayment(row)}>
                          {row.period.status === 'overdue' ? 'Pay overdue' : 'Mark paid'}
                        </button>
                      )}
                      <button className={styles.delBtn} onClick={async () => { if (await confirmDeleteApp(row.name)) await fsDel(user.uid, 'bills', row._id) }}>x</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className={bStyles.mobileCardList}>
          {!billsWithStatus.length ? (
            <div className={styles.helper} style={{ textAlign: 'center', padding: '2rem' }}>
              No bills yet. Add one above to start your bill plan.
            </div>
          ) : (
            sortedBillsWithStatus.map(row => {
              const statusPeriod = row.period || {}
              return (
                <div key={row._id} className={bStyles.billCard}>
                  <div className={bStyles.billCardHeader}>
                    <div className={bStyles.billCardTitle}>
                      <h4>{row.name}</h4>
                      <span>{row.subcat || row.cat}</span>
                    </div>
                  </div>
                  <div className={bStyles.billCardDetails}>
                    <div className={bStyles.detailItem}>
                      <label>Account</label>
                      <span>{row.accountId ? (accountNameById.get(row.accountId) || 'Missing account') : 'Choose when paying'}</span>
                    </div>
                    <div className={bStyles.detailItem}>
                      <label>Due Date</label>
                      <span>Day {row.due} ({formatDisplayDate(statusPeriod.dueDate)})</span>
                    </div>
                    <div className={bStyles.detailItem}>
                      <label>Frequency</label>
                      <span>{BILL_FREQS.find(option => option.value === row.freq)?.label || row.freq}</span>
                    </div>
                    <div className={bStyles.detailItem}>
                      <label>Status</label>
                      <span style={{ ...getStatusStyle(statusPeriod.status), borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 700, width: 'fit-content' }}>
                        {statusPeriod.label}
                      </span>
                    </div>
                  </div>
                  <div className={bStyles.billCardFooter}>
                    <div className={bStyles.billCardPrice}>
                      <span>Amount</span>
                      <strong>{fmt(row.amount, s)}</strong>
                    </div>
                    <div className={bStyles.billCardActions}>
                      {statusPeriod.paid ? (
                        <button type="button" className={bStyles.undoBtn} onClick={() => handleUndoPaid(row)}>Undo</button>
                      ) : (
                        <button type="button" className={bStyles.payBtn} onClick={() => openPayment(row)}>
                          {statusPeriod.status === 'overdue' ? 'Pay overdue' : 'Mark paid'}
                        </button>
                      )}
                      <button type="button" className={bStyles.delBtn} onClick={async () => { if (await confirmDeleteApp(row.name)) await fsDel(user.uid, 'bills', row._id) }}>×</button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
      </div>
      
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
                <input
                  type="date"
                  value={paymentForm.date}
                  onChange={event => setPaymentForm(current => ({ ...current, date: event.target.value }))}
                />
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
