import { useEffect, useMemo, useState } from 'react'
import { fsAddTransaction } from '../lib/firestore'
import { notifyApp } from '../lib/appFeedback'
import { sanitizeTransactionSubcategory } from '../lib/transactionOptions'
import { fmt, formatDisplayDate, today } from '../lib/utils'
import styles from './GroceryMode.module.css'

const GROCERY_CATEGORIES = ['Food & Dining', 'Shopping', 'Other']

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

function createDraft(seed = {}) {
  return {
    id: seed.id || '',
    name: seed.name || seed.desc || '',
    amount: seed.amount ? String(seed.amount) : '',
  }
}

export default function GroceryMode({ user, profile = {}, accounts = [], symbol, defaultDate, onClose }) {
  const s = symbol || '₱'
  const defaultAccountId = accounts[0]?._id || ''
  const [tripName, setTripName] = useState('Grocery trip')
  const [tripDate, setTripDate] = useState(defaultDate || today())
  const [tripCategory, setTripCategory] = useState('Food & Dining')
  const [accountId, setAccountId] = useState(defaultAccountId)
  const [items, setItems] = useState([])
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const total = useMemo(
    () => roundMoney(items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)),
    [items],
  )
  const selectedAccount = accounts.find(account => account._id === accountId) || null
  const tripWillAffectCurrentBalance = Boolean(accountId && tripDate && tripDate <= today())
  const accountHint = !accounts.length
    ? 'Add an account first if you want grocery trips to move your current balances automatically.'
    : !accountId
      ? 'No account selected. This grocery total will stay in the ledger only and will not change current account balances.'
      : tripWillAffectCurrentBalance
        ? `${selectedAccount?.name || 'Selected account'} will update right away because this date is today or earlier.`
        : `${selectedAccount?.name || 'Selected account'} is linked, but current balances will wait until this date arrives.`

  useEffect(() => {
    if (!accountId && defaultAccountId) setAccountId(defaultAccountId)
  }, [accountId, defaultAccountId])

  function openManualDraft() {
    setDraft(createDraft())
  }

  function openEditDraft(item) {
    setDraft(createDraft(item))
  }

  function saveDraft() {
    if (!draft?.amount || Number(draft.amount) <= 0) return

    const nextItem = {
      id: draft.id || `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: draft.name?.trim() || `Item ${items.length + 1}`,
      amount: roundMoney(draft.amount),
    }

    setItems(current => {
      if (draft.id) {
        return current.map(item => item.id === draft.id ? nextItem : item)
      }
      return [...current, nextItem]
    })
    setDraft(null)
  }

  function removeItem(id) {
    setItems(current => current.filter(item => item.id !== id))
    if (draft?.id === id) setDraft(null)
  }

  async function handleImport() {
    if (!items.length || total <= 0) return

    setSaving(true)
    setError('')
    try {
      await fsAddTransaction(user.uid, 'expenses', {
        desc: tripName.trim() || `Grocery trip (${items.length} items)`,
        amount: total,
        date: tripDate,
        cat: tripCategory,
        subcat: sanitizeTransactionSubcategory('expense', tripCategory, tripCategory === 'Food & Dining' ? 'Groceries / Palengke' : tripCategory === 'Shopping' ? 'Household' : 'Miscellaneous'),
        presetKey: '',
        recur: '',
        type: 'expense',
        accountId,
        accountBalanceLinked: Boolean(accountId),
        source: 'grocery-mode',
        items: items.map(item => ({
          name: item.name,
          amount: roundMoney(item.amount),
        })),
      }, accounts)
      setDone(true)
      window.setTimeout(() => {
        onClose?.()
      }, 650)
    } catch {
      notifyApp({ title: 'Grocery trip not saved', message: 'Could not save this grocery trip right now. Try again.', tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Grocery mode</div>
          <div className={styles.title}>Build one grocery list before checkout.</div>
          <div className={styles.sub}>
            Add items manually, review the total, and save the trip as one grocery expense.
          </div>
        </div>
        <button className={styles.close} onClick={onClose}>✕</button>
      </div>

      <div className={styles.summaryCard}>
        <div className={styles.summaryTop}>
          <div>
            <div className={styles.summaryLabel}>Running total</div>
            <div className={styles.summaryValue}>{fmt(total, s)}</div>
          </div>
          <div className={styles.summaryMeta}>
            <div className={styles.summaryMetaVal}>{items.length}</div>
            <div className={styles.summaryMetaLabel}>items</div>
          </div>
        </div>
        <div className={styles.summaryHint}>
          Add items as you shop. When you are done, Takda saves one grocery expense with the item list attached.
        </div>
      </div>

      <div className={styles.tripGrid}>
        <label className={styles.field}>
          <span>Trip name</span>
          <input value={tripName} onChange={event => setTripName(event.target.value)} placeholder="Weekly grocery run" />
        </label>
        <label className={styles.field}>
          <span>Date</span>
          <div className={styles.dateFieldWrap}>
            <div className={styles.dateFieldDisplay}>
              {formatDisplayDate(tripDate)}
            </div>
            <input
              type="date"
              className={styles.dateFieldNative}
              value={tripDate}
              aria-label="Trip date"
              onChange={event => {
                setTripDate(event.target.value)
                setError('')
              }}
            />
          </div>
        </label>
        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span>Trip category</span>
          <select value={tripCategory} onChange={event => setTripCategory(event.target.value)}>
            {GROCERY_CATEGORIES.map(option => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span>Account</span>
          <select value={accountId} onChange={event => setAccountId(event.target.value)}>
            <option value="">No account selected</option>
            {accounts.map(account => (
              <option key={account._id} value={account._id}>
                {account.name} · {account.type}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.accountNote}>{accountHint}</div>

      {error && <div className={styles.formError} role="alert">{error}</div>}

      <div className={styles.actionRow}>
        <button className={styles.secondaryBtn} onClick={openManualDraft}>+ Add item</button>
      </div>

      {draft && (
        <div className={styles.draftCard}>
          <div className={styles.draftTitle}>{draft.id ? 'Edit item' : 'New item'}</div>
          <div className={styles.tripGrid}>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span>Item name</span>
              <input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} placeholder="e.g. Rice, milk, eggs" />
            </label>
            <label className={styles.field}>
              <span>Price</span>
              <input type="number" min="0" step="0.01" value={draft.amount} onChange={event => setDraft(current => ({ ...current, amount: event.target.value }))} placeholder="0.00" />
            </label>
          </div>
          <div className={styles.draftActions}>
            <button className={styles.ghostBtn} onClick={() => setDraft(null)}>Cancel</button>
            <button className={styles.primaryBtn} onClick={saveDraft} disabled={!draft.amount || Number(draft.amount) <= 0}>
              {draft.id ? 'Save item' : 'Add item'}
            </button>
          </div>
        </div>
      )}

      <div className={styles.itemsCard}>
        <div className={styles.itemsHeader}>
          <div className={styles.itemsTitle}>Trip items</div>
          <div className={styles.itemsSub}>{items.length ? `${items.length} item${items.length === 1 ? '' : 's'} in this trip` : 'No items yet'}</div>
        </div>
        {items.length ? (
          <div className={styles.itemList}>
            {items.map(item => (
              <div key={item.id} className={styles.itemRow}>
                <div>
                  <div className={styles.itemName}>{item.name}</div>
                  <div className={styles.itemHint}>Ready to include in the grocery total</div>
                </div>
                <div className={styles.itemActions}>
                  <div className={styles.itemAmount}>{fmt(item.amount, s)}</div>
                  <button className={styles.inlineBtn} onClick={() => openEditDraft(item)}>Edit</button>
                  <button className={styles.inlineBtn} onClick={() => removeItem(item.id)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            Add an item to start this trip.
          </div>
        )}
      </div>

      <div className={styles.footerDock}>
        <button className={styles.importBtn} onClick={handleImport} disabled={saving || done || !items.length || total <= 0}>
          {done ? '✓ Saved to calendar' : saving ? 'Saving...' : `Save grocery trip · ${fmt(total, s)}`}
        </button>
      </div>
    </div>
  )
}
