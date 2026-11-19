import { useEffect, useMemo, useState } from 'react'
import { fsAddTransaction, fsDeleteTransaction } from '../lib/firestore'
import { getDefaultTransactionDraft } from '../lib/transactionOptions'
import { getBillingCycleOptions } from '../lib/billingCycles'
import { confirmDeleteApp, notifyApp } from '../lib/appFeedback'
import { fmt, today, RECUR_OPTIONS, validateAmount } from '../lib/utils'
import styles from './Page.module.css'

function getExpenseDraft(accounts = []) {
  return {
    ...getDefaultTransactionDraft('expense'),
    date: today(),
    accountId: accounts?.[0]?._id || '',
    billingCycle: 'auto',
  }
}

export default function Expenses({ user, data, symbol }) {
  const s = symbol || '₱'
  const [form, setForm] = useState(() => getExpenseDraft(data.accounts))

  const selectedAccount = useMemo(() => {
    return (data.accounts || []).find(a => a._id === form.accountId) || null
  }, [data.accounts, form.accountId])

  const isCreditCard = selectedAccount?.type === 'Credit Card'

  const billingCycleOptions = useMemo(() => {
    if (!isCreditCard || !selectedAccount) return []
    return getBillingCycleOptions(selectedAccount, form.date || today(), today(), data.debts || [])
  }, [isCreditCard, selectedAccount, form.date, data.debts])


  function setField(key, value) {
    setForm(current => ({ ...current, [key]: value }))
  }

  useEffect(() => {
    if (!form.accountId && data.accounts?.[0]?._id) {
      setForm(current => ({ ...current, accountId: data.accounts[0]._id }))
    }
  }, [data.accounts, form.accountId])

  async function handleAdd() {
    if (!form.desc || !form.amount || !form.date) {
      notifyApp({ title: 'Expense needs details', message: 'Add a description, amount, and date before saving.', tone: 'warning' })
      return
    }
    const err = validateAmount(form.amount)
    if (err) {
      notifyApp({ title: 'Check amount', message: err, tone: 'warning' })
      return
    }

    await fsAddTransaction(
      user.uid,
      'expenses',
      {
        ...form,
        amount: parseFloat(form.amount),
        type: 'expense',
        accountBalanceLinked: Boolean(form.accountId),
        ...(isCreditCard ? { billingCycle: form.billingCycle || 'auto' } : {}),
      },
      data.accounts,
    )

    setForm(current => ({
      ...getExpenseDraft(data.accounts),
      accountId: current.accountId,
      date: current.date,
    }))
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>Purchases & Expenses</div>
        <div className={styles.sub}>Track purchases and everyday spending.</div>
      </div>
      <div className={styles.formCard}>
        <div className={styles.cardTitle}>Add expense</div>

        <div className={`${styles.formRow} ${styles.col3}`}>
          <div className={styles.formGroup}><label>Name</label><input placeholder="Name" value={form.desc} onChange={e => setField('desc', e.target.value)} /></div>
          <div className={styles.formGroup}><label>Amount ({s})</label><input type="number" min="0" placeholder="0.00" value={form.amount} onChange={e => setField('amount', e.target.value)} /></div>
          <div className={styles.formGroup}><label>Date</label><input type="date" value={form.date} onChange={e => setField('date', e.target.value)} /></div>
        </div>
        <div className={`${styles.formRow} ${styles.col3}`}>
          <div className={styles.formGroup}><label>Account</label>
            <select value={form.accountId} onChange={e => setField('accountId', e.target.value)}>
              <option value="">No account selected</option>
              {(data.accounts || []).map(account => <option key={account._id} value={account._id}>{account.name} · {account.type}</option>)}
            </select>
          </div>
        </div>
        <div className={`${styles.formRow} ${isCreditCard && billingCycleOptions.length > 0 ? styles.col3 : styles.col2}`}>
          <div className={styles.formGroup}><label>Recurrence</label>
            <select value={form.recur} onChange={e => setField('recur', e.target.value)}>
              {RECUR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {isCreditCard && billingCycleOptions.length > 0 && (
            <div className={styles.formGroup}><label>💳 Billing Statement</label>
              <select value={form.billingCycle || 'auto'} onChange={e => setField('billingCycle', e.target.value)}>
                {billingCycleOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}
          <div className={styles.formGroup} style={{ justifyContent: 'flex-end' }}>
            <button className={styles.btnAdd} onClick={handleAdd}>Add expense</button>
          </div>
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.cardTitle}>Expense entries</div>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>Description</th><th>Category</th><th>Date</th><th>Recurrence</th><th>Amount</th><th></th></tr></thead>
            <tbody>
              {!data.expenses.length
                ? <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: '2rem' }}>No expenses yet.</td></tr>
                : data.expenses.map(r => (
                  <tr key={r._id}>
                    <td style={{ color: 'var(--text)' }}>{r.desc}</td>
                    <td><span className={`${styles.badge} ${styles.badgeExpense}`}>{[r.cat, r.subcat].filter(Boolean).join(' · ')}</span></td>
                    <td>{r.date}</td>
                    <td>{r.recur ? <span className={`${styles.badge} ${styles.badgeRecurring}`}>{RECUR_OPTIONS.find(o => o.value === r.recur)?.label || r.recur}</span> : '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--red)' }}>{fmt(r.amount, s)}</td>
                    <td><button className={styles.delBtn} onClick={async () => { if (await confirmDeleteApp(r.desc)) await fsDeleteTransaction(user.uid, 'expenses', r, data.accounts) }}>✕</button></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
