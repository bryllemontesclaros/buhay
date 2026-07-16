import { useEffect, useMemo, useState } from 'react'
import { fsAddTransaction } from '../lib/firestore'
import {
  findPresetByLabel,
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
import { formatDisplayDate, RECUR_OPTIONS, today } from '../lib/utils'
import styles from './QuickAdd.module.css'

function normalizeAmountInput(value) {
  const cleaned = value.replace(/[^\d.]/g, '')
  if (!cleaned) return ''

  const parts = cleaned.split('.')
  const integerPart = (parts[0] || '0').replace(/^0+(?=\d)/, '') || '0'
  const decimalPart = parts.slice(1).join('').slice(0, 2)

  if (parts.length > 1 || cleaned.endsWith('.')) return `${integerPart}.${decimalPart}`
  return integerPart
}



export default function QuickAdd({ user, profile = {}, accounts = [], symbol, onClose, onTypeChange, defaultType = 'expense', defaultDate, initialEntry = null }) {
  const s = symbol || '₱'
  const initialType = initialEntry?.type || defaultType
  const initialDraft = getDefaultTransactionDraft(initialType)
  const initialCat = sanitizeTransactionCategory(initialType, initialEntry?.cat || initialDraft.cat)
  const initialSubcat = sanitizeTransactionSubcategory(initialType, initialCat, initialEntry?.subcat || initialDraft.subcat)
  const initialMatchedPreset =
    getPresetByKey(initialType, initialEntry?.presetKey || '')
    || findPresetByLabel(initialType, initialEntry?.desc || '')
  const initialPresetKey = initialMatchedPreset && !initialMatchedPreset.isCustom && initialMatchedPreset.cat === initialCat && initialMatchedPreset.subcat === initialSubcat
    ? initialMatchedPreset.key
    : ''
  const initialDesc = initialEntry
    ? (initialEntry.desc || getSuggestedDescription(initialType, initialCat, initialSubcat, initialPresetKey))
    : initialDraft.desc
  const defaultAccountId = accounts[0]?._id || ''
  const [type, setType] = useState(initialType)
  const [amount, setAmount] = useState(initialEntry?.amount ? String(initialEntry.amount) : '')
  const [desc, setDesc] = useState(initialDesc)
  const [cat, setCat] = useState(initialCat)
  const [subcat, setSubcat] = useState(initialSubcat)
  const [presetKey, setPresetKey] = useState(initialPresetKey)
  const [descTouched, setDescTouched] = useState(Boolean(initialEntry?.desc))
  const [entryDate, setEntryDate] = useState(initialEntry?.date || defaultDate || today())
  const [recur, setRecur] = useState(initialEntry?.recur || '')
  const [accountId, setAccountId] = useState(initialEntry?.accountId || defaultAccountId)
  const [paymentStatus, setPaymentStatus] = useState(initialEntry?.paymentStatus || 'paid')
  const [showPresetBrowser, setShowPresetBrowser] = useState(Boolean(initialPresetKey))
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const isIncome = type === 'income'
  const selectedAccount = accounts.find(account => account._id === accountId) || null


  const quickPresets = getQuickItems(type)
  const presetGroups = getPresetGroups(type)
  const categories = getTransactionCategories(type)
  const subcategories = getTransactionSubcategories(type, cat)
  const selectedPreset = getPresetByKey(type, presetKey)
  const visibleQuickPresets = useMemo(() => {
    if (showPresetBrowser) return quickPresets
    const limited = quickPresets.slice(0, 6)
    if (!presetKey || limited.some(item => item.key === presetKey)) return limited
    const selected = quickPresets.find(item => item.key === presetKey)
    return selected ? [...limited.slice(0, 5), selected] : limited
  }, [presetKey, quickPresets, showPresetBrowser])


  useEffect(() => {
    if (!accountId && defaultAccountId) setAccountId(defaultAccountId)
  }, [accountId, defaultAccountId])

  useEffect(() => {
    onTypeChange?.(type)
  }, [onTypeChange, type])

  function clearPresetSelection(nextType = type, nextCat = 'Other', nextSubcat = 'Miscellaneous') {
    const resolvedCat = sanitizeTransactionCategory(nextType, nextCat)
    const resolvedSubcat = sanitizeTransactionSubcategory(nextType, resolvedCat, nextSubcat)
    setPresetKey('')
    setShowPresetBrowser(false)
    setCat(resolvedCat)
    setSubcat(resolvedSubcat)
    if (!descTouched) setDesc(getSuggestedDescription(nextType, resolvedCat, resolvedSubcat))
    setError('')
  }

  function applyPresetSelection(nextPresetKey) {
    const preset = getPresetByKey(type, nextPresetKey)
    if (!preset || preset.isCustom) {
      clearPresetSelection(type, 'Other', 'Miscellaneous')
      return
    }
    setShowPresetBrowser(false)
    setPresetKey(preset.key)
    setCat(preset.cat)
    setSubcat(preset.subcat)
    setDesc(preset.desc || preset.label)
    setDescTouched(false)
    setError('')
  }

  function handleCategoryChange(event) {
    const nextCat = sanitizeTransactionCategory(type, event.target.value)
    const nextSubcat = getTransactionSubcategories(type, nextCat)[0]
    setPresetKey('')
    setCat(nextCat)
    setSubcat(nextSubcat)
    if (!descTouched) setDesc(getSuggestedDescription(type, nextCat, nextSubcat))
    setError('')
  }

  function handleSubcategoryChange(event) {
    const nextSubcat = sanitizeTransactionSubcategory(type, cat, event.target.value)
    setPresetKey('')
    setSubcat(nextSubcat)
    if (!descTouched) setDesc(getSuggestedDescription(type, cat, nextSubcat))
    setError('')
  }

  function switchType(nextType) {
    if (nextType === type) return
    const nextDraft = getDefaultTransactionDraft(nextType)
    setType(nextType)
    setCat(nextDraft.cat)
    setSubcat(nextDraft.subcat)
    setPresetKey('')
    setShowPresetBrowser(false)
    setDesc(nextDraft.desc)
    setDescTouched(false)
    setError('')
  }

  function handleAmountChange(event) {
    setAmount(normalizeAmountInput(event.target.value))
    setError('')
  }



  // Numpad input
  function numPress(val) {
    setError('')
    if (val === 'C') { setAmount(''); return }
    if (val === '⌫') { setAmount(a => a.slice(0, -1)); return }
    if (val === '.' && amount.includes('.')) return
    if (amount === '0' && val !== '.') {
      setAmount(normalizeAmountInput(String(val)))
      return
    }
    setAmount(current => normalizeAmountInput(`${current}${val}`))
  }

  async function handleSave() {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Enter an amount greater than 0 before saving this entry.')
      return
    }
    if (!entryDate) {
      setError('Pick a date before saving this entry.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const col = type === 'income' ? 'income' : 'expenses'
      const trimmedDesc = desc.trim()
      await fsAddTransaction(user.uid, col, {
        desc: trimmedDesc,
        amount: parseFloat(amount),
        date: entryDate,
        cat,
        subcat,
        presetKey,
        recur,
        type,
        paymentStatus,
        accountId,
        accountBalanceLinked: Boolean(accountId),
      }, accounts)

      setDone(true)
      setTimeout(() => {
        const resetDraft = getDefaultTransactionDraft(type)
        setAmount('')
        setDesc(resetDraft.desc)
        setCat(resetDraft.cat)
        setSubcat(resetDraft.subcat)
        setPresetKey('')
        setDescTouched(false)
        setRecur('')
        setPaymentStatus('paid')
        setAccountId(defaultAccountId)
        if (!defaultDate) setEntryDate(today())
        setDone(false)
        setSaving(false)
        if (onClose) onClose()
      }, 600)
    } catch {
      setSaving(false)
      setDone(false)
      setError('Could not save this entry right now. Check your connection and try again.')
    }
  }
  const color = isIncome ? 'var(--accent)' : 'var(--red)'
  const bgColor = isIncome ? 'var(--accent-glow)' : 'var(--red-dim)'



  return (
    <div className={styles.wrap}>
      <div className={styles.sectionLabel}>Entry type</div>
      <div className={styles.typeRow}>
        <button
          className={`${styles.typeTab} ${!isIncome ? styles.typeTabExpense : ''}`}
          onClick={() => switchType('expense')}
          aria-pressed={!isIncome}
        >
          − Expense
        </button>
        <button
          className={`${styles.typeTab} ${isIncome ? styles.typeTabIncome : ''}`}
          onClick={() => switchType('income')}
          aria-pressed={isIncome}
        >
          + Income
        </button>
      </div>

      <div className={styles.sectionLabel}>Amount</div>
      <div className={styles.amountDisplay} style={{ color, borderColor: color, background: bgColor }}>
        <span className={styles.currencySign}>{s}</span>
        <input
          className={styles.amountInput}
          inputMode="decimal"
          aria-label="Amount"
          placeholder="0"
          value={amount}
          onChange={handleAmountChange}
        />
      </div>

      <div className={styles.utilityRow}>
        <button
          type="button"
          className={`${styles.morePresetsBtn} ${showPresetBrowser ? styles.morePresetsBtnActive : ''}`}
          onClick={() => setShowPresetBrowser(current => !current)}
          aria-expanded={showPresetBrowser}
        >
          {showPresetBrowser ? 'Hide presets' : 'More presets'}
        </button>
      </div>

      <div className={styles.sectionLabel}>{isIncome ? 'What did you receive?' : 'What did you pay for?'}</div>
      <div className={styles.quickCats}>
        {visibleQuickPresets.map(item => (
          <button
            key={item.key}
            className={`${styles.quickCat} ${presetKey === item.key ? styles.quickCatActive : ''}`}
            style={presetKey === item.key ? { borderColor: color, background: bgColor, color } : {}}
            onClick={() => {
              if (item.isCustom) clearPresetSelection(type, 'Other', 'Miscellaneous')
              else applyPresetSelection(item.key)
            }}
            aria-pressed={presetKey === item.key}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      {showPresetBrowser && (
        <label className={styles.metaField}>
          <span className={styles.fieldLabel}>Browse presets</span>
          <select
            className={styles.fieldControl}
            value={presetKey || 'other-custom'}
            onChange={event => {
              if (event.target.value === 'other-custom') clearPresetSelection(type, 'Other', 'Miscellaneous')
              else applyPresetSelection(event.target.value)
            }}
          >
            {presetGroups.map(group => (
              <optgroup key={group.label} label={group.label}>
                {group.items.map(option => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value="other-custom">Other / custom</option>
          </select>
        </label>
      )}
      <div className={styles.sectionLabel}>Details</div>
      <div className={styles.descRow}>
        <input
          className={styles.descInput}
          placeholder={isIncome ? 'Payer or note (optional)' : 'Merchant, biller, or note (optional)'}
          value={desc}
          onChange={e => {
            setDesc(e.target.value)
            setDescTouched(true)
            setError('')
          }}
        />
      </div>

      <div className={styles.metaGrid}>
        <label className={styles.metaField}>
          <span className={styles.fieldLabel}>Date</span>
          <div className={styles.dateFieldWrap}>
            <div className={`${styles.fieldControl} ${styles.dateFieldDisplay}`}>
              {formatDisplayDate(entryDate)}
            </div>
            <input
              type="date"
              className={`${styles.fieldControl} ${styles.dateFieldNative}`}
              value={entryDate}
              aria-label="Date"
              onChange={event => {
                setEntryDate(event.target.value)
                setError('')
              }}
            />
          </div>
        </label>
        <label className={styles.metaField}>
          <span className={styles.fieldLabel}>Account</span>
          <select
            className={styles.fieldControl}
            value={accountId}
            onChange={event => {
              setAccountId(event.target.value)
              setError('')
            }}
          >
            <option value="">No account selected</option>
            {accounts.map(account => (
              <option key={account._id} value={account._id}>
                {account.name} · {account.type}
              </option>
            ))}
          </select>
        </label>
      </div>

      <details className={styles.advancedBox}>
        <summary className={styles.advancedSummary}>
          <span>More options</span>
          <small>Payment status, category, subcategory, recurrence</small>
        </summary>
        <div className={styles.advancedGrid}>
          <label className={styles.metaField}>
            <span className={styles.fieldLabel}>Payment status</span>
            <select
              className={styles.fieldControl}
              value={paymentStatus}
              onChange={event => {
                setPaymentStatus(event.target.value)
                setError('')
              }}
            >
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </label>
          <label className={styles.metaField}>
            <span className={styles.fieldLabel}>Category</span>
            <select
              className={styles.fieldControl}
              value={cat}
              onChange={handleCategoryChange}
            >
              {categories.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className={styles.metaField}>
            <span className={styles.fieldLabel}>Subcategory</span>
            <select
              className={styles.fieldControl}
              value={subcat}
              onChange={handleSubcategoryChange}
            >
              {subcategories.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className={`${styles.metaField} ${styles.metaFieldFull}`}>
            <span className={styles.fieldLabel}>Recurrence</span>
            <select
              className={styles.fieldControl}
              value={recur}
              onChange={event => {
                setRecur(event.target.value)
                setError('')
              }}
            >
              {RECUR_OPTIONS.map(option => <option key={option.value || 'none'} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
      </details>


      {error && <div className={styles.formError}>{error}</div>}

      {/* NUMPAD */}
      <div className={styles.numpad}>
        {[7,8,9,'C',4,5,6,'⌫',1,2,3,'.',0,'00',''].map((k, i) => (
          k === '' ? <div key={i} /> :
          <button
            key={i}
            className={`${styles.numKey} ${k === 'C' ? styles.numKeyClear : ''} ${k === '⌫' ? styles.numKeyBack : ''}`}
            onClick={() => numPress(k)}
          >
            {k}
          </button>
        ))}
      </div>

      <div className={styles.saveDock}>
        <button
          className={styles.saveBtn}
          style={{ background: done ? 'var(--accent)' : color, color: isIncome || done ? '#0a0a0f' : '#fff' }}
          onClick={handleSave}
          disabled={done || saving || !entryDate || !amount || Number.parseFloat(amount) <= 0}
        >
          {done ? '✓ Saved!' : saving ? 'Saving...' : `${isIncome ? '+ Add Income' : '− Add Expense'} · ${s}${amount || '0'}`}
        </button>
      </div>
    </div>
  )
}
