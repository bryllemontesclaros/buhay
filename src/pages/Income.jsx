import { useEffect, useMemo, useState } from 'react'
import { fsAddTransaction, fsDeleteTransaction } from '../lib/firestore'
import {
  getDefaultTransactionDraft,
  getPresetByKey,
  getPresetGroups,
  getQuickItems,
  getSuggestedDescription,
  getTransactionCategories,
  getTransactionSubcategories,
  sanitizeTransactionCategory,
  sanitizeTransactionSubcategory,
} from '../lib/transactionOptions'
import { confirmDeleteApp, notifyApp } from '../lib/appFeedback'
import { fmt, today, RECUR_OPTIONS, validateAmount } from '../lib/utils'
import styles from './Page.module.css'

function getIncomeDraft(accounts = []) {
  return {
    ...getDefaultTransactionDraft('income'),
    date: today(),
    accountId: accounts?.[0]?._id || '',
  }
}

export default function Income({ user, data, symbol }) {
  const s = symbol || '₱'
  const [form, setForm] = useState(() => getIncomeDraft(data.accounts))
  const [showPresetBrowser, setShowPresetBrowser] = useState(false)

  const quickPresets = getQuickItems('income')
  const presetGroups = getPresetGroups('income')
  const categories = getTransactionCategories('income')
  const subcategories = getTransactionSubcategories('income', form.cat)
  const selectedPreset = useMemo(() => getPresetByKey('income', form.presetKey), [form.presetKey])
  const visibleQuickPresets = useMemo(() => {
    const limited = quickPresets.slice(0, 6)
    if (!selectedPreset || selectedPreset.isCustom || limited.some(item => item.key === selectedPreset.key)) return limited
    return [...limited.slice(0, 5), selectedPreset]
  }, [quickPresets, selectedPreset])

  function setField(key, value) {
    setForm(current => ({ ...current, [key]: value }))
  }

  useEffect(() => {
    if (!form.accountId && data.accounts?.[0]?._id) {
      setForm(current => ({ ...current, accountId: data.accounts[0]._id }))
    }
  }, [data.accounts, form.accountId])

  function clearPreset() {
    const nextCat = 'Other'
    const nextSubcat = sanitizeTransactionSubcategory('income', nextCat, 'Miscellaneous')
    setForm(current => ({
      ...current,
      presetKey: '',
      cat: nextCat,
      subcat: nextSubcat,
      desc: current.desc ? current.desc : getSuggestedDescription('income', nextCat, nextSubcat),
    }))
    setShowPresetBrowser(false)
  }

  function applyPreset(nextPresetKey) {
    const preset = getPresetByKey('income', nextPresetKey)
    if (!preset || preset.isCustom) {
      clearPreset()
      return
    }
    setForm(current => ({
      ...current,
      presetKey: preset.key,
      desc: preset.desc || preset.label,
      cat: preset.cat,
      subcat: preset.subcat,
    }))
    setShowPresetBrowser(false)
  }

  function handleCategoryChange(value) {
    const nextCat = sanitizeTransactionCategory('income', value)
    const nextSubcat = getTransactionSubcategories('income', nextCat)[0]
    setForm(current => ({
      ...current,
      presetKey: '',
      cat: nextCat,
      subcat: nextSubcat,
      desc: current.desc || getSuggestedDescription('income', nextCat, nextSubcat),
    }))
  }

  function handleSubcategoryChange(value) {
    const nextSubcat = sanitizeTransactionSubcategory('income', form.cat, value)
    setForm(current => ({
      ...current,
      presetKey: '',
      subcat: nextSubcat,
      desc: current.desc || getSuggestedDescription('income', current.cat, nextSubcat),
    }))
  }

  async function handleAdd() {
    if (!form.desc || !form.amount || !form.date) {
      notifyApp({ title: 'Income needs details', message: 'Add a description, amount, and date before saving.', tone: 'warning' })
      return
    }
    const err = validateAmount(form.amount)
    if (err) {
      notifyApp({ title: 'Check amount', message: err, tone: 'warning' })
      return
    }

    await fsAddTransaction(
      user.uid,
      'income',
      { ...form, amount: parseFloat(form.amount), type: 'income', accountBalanceLinked: Boolean(form.accountId) },
      data.accounts,
    )

    setForm(current => ({
      ...getIncomeDraft(data.accounts),
      accountId: current.accountId,
      date: current.date,
    }))
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>Income</div>
        <div className={styles.sub}>Track pay, freelance work, business income, and other inflows.</div>
      </div>
      <div className={styles.formCard}>
        <div className={styles.cardTitle}>Add income</div>

        <div className={styles.formGroup} style={{ marginBottom: 12 }}>
          <label>What did you receive?</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {visibleQuickPresets.map(item => (
              <button
                key={item.key}
                type="button"
                className={styles.chip}
                style={form.presetKey === item.key ? { borderColor: 'var(--accent)', background: 'var(--accent-glow)', color: 'var(--accent)' } : {}}
                onClick={() => {
                  if (item.isCustom) clearPreset()
                  else applyPreset(item.key)
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          <div className={styles.presetToggleRow}>
            <button
              type="button"
              className={`${styles.presetToggle} ${showPresetBrowser ? styles.presetToggleActive : ''}`}
              onClick={() => setShowPresetBrowser(current => !current)}
              aria-expanded={showPresetBrowser}
            >
              {showPresetBrowser ? 'Hide presets' : 'More presets'}
            </button>
          </div>
          {showPresetBrowser && (
            <select value={form.presetKey || 'other-custom'} onChange={event => {
              if (event.target.value === 'other-custom') clearPreset()
              else applyPreset(event.target.value)
            }}>
              {presetGroups.map(group => (
                <optgroup key={group.label} label={group.label}>
                  {group.items.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
                </optgroup>
              ))}
              <option value="other-custom">Other / custom</option>
            </select>
          )}
          <div className={styles.presetHint} style={{ marginTop: 8 }}>
            {selectedPreset
              ? `${selectedPreset.label} auto-fills ${selectedPreset.cat} → ${selectedPreset.subcat}.`
              : 'Pick a familiar income source, or keep this as a custom entry.'}
          </div>
        </div>

        <div className={`${styles.formRow} ${styles.col3}`}>
          <div className={styles.formGroup}><label>Description</label><input placeholder="e.g. Client payment" value={form.desc} onChange={e => setField('desc', e.target.value)} /></div>
          <div className={styles.formGroup}><label>Amount ({s})</label><input type="number" min="0" placeholder="0.00" value={form.amount} onChange={e => setField('amount', e.target.value)} /></div>
          <div className={styles.formGroup}><label>Date</label><input type="date" value={form.date} onChange={e => setField('date', e.target.value)} /></div>
        </div>
        <div className={`${styles.formRow} ${styles.col3}`}>
          <div className={styles.formGroup}><label>Category</label>
            <select value={form.cat} onChange={e => handleCategoryChange(e.target.value)}>
              {categories.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className={styles.formGroup}><label>Subcategory</label>
            <select value={form.subcat} onChange={e => handleSubcategoryChange(e.target.value)}>
              {subcategories.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className={styles.formGroup}><label>Account</label>
            <select value={form.accountId} onChange={e => setField('accountId', e.target.value)}>
              <option value="">No account selected</option>
              {(data.accounts || []).map(account => <option key={account._id} value={account._id}>{account.name} · {account.type}</option>)}
            </select>
          </div>
        </div>
        <div className={`${styles.formRow} ${styles.col3}`}>
          <div className={styles.formGroup}><label>Recurrence</label>
            <select value={form.recur} onChange={e => setField('recur', e.target.value)}>
              {RECUR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className={styles.formGroup} style={{ justifyContent: 'flex-end' }}>
            <button className={styles.btnAdd} onClick={handleAdd}>Add income</button>
          </div>
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.cardTitle}>Income entries</div>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>Description</th><th>Category</th><th>Date</th><th>Recurrence</th><th>Amount</th><th></th></tr></thead>
            <tbody>
              {!data.income.length
                ? <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: '2rem' }}>No income yet.</td></tr>
                : data.income.map(r => (
                  <tr key={r._id}>
                    <td style={{ color: 'var(--text)' }}>{r.desc}</td>
                    <td><span className={`${styles.badge} ${styles.badgeIncome}`}>{[r.cat, r.subcat].filter(Boolean).join(' · ')}</span></td>
                    <td>{r.date}</td>
                    <td>{r.recur ? <span className={`${styles.badge} ${styles.badgeRecurring}`}>{RECUR_OPTIONS.find(o => o.value === r.recur)?.label || r.recur}</span> : '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{fmt(r.amount, s)}</td>
                    <td><button className={styles.delBtn} onClick={async () => { if (await confirmDeleteApp(r.desc)) await fsDeleteTransaction(user.uid, 'income', r, data.accounts) }}>✕</button></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
