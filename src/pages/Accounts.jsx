import { useEffect, useMemo, useRef, useState } from 'react'
import { fsAdd, fsDeleteAccountAndUnlinkTransactions, fsSyncDueLinkedTransactions, fsUpdate } from '../lib/firestore'
import { getAccountSignedBalance, shouldAffectCurrentAccountBalance } from '../lib/finance'
import { getTakdaTotalBalanceNow } from '../lib/balanceSystem'
import { getIncludedPortfolioValue } from '../lib/portfolio'
import { confirmApp, notifyApp } from '../lib/appFeedback'
import { displayValue, fmt, maskMoney, validateAmount } from '../lib/utils'
import { safeScrollIntoView } from '../lib/ui'
import styles from './Page.module.css'
import accStyles from './Accounts.module.css'

const ACCOUNT_TYPES = ['Cash', 'Bank', 'E-wallet', 'Credit Card', 'Investment', 'Other']
const ACCOUNT_ICONS = { Cash: '💵', Bank: '🏦', 'E-wallet': '📱', 'Credit Card': '💳', Investment: '📈', Other: '🏷' }
const COLORS = [
  { name: 'Green', value: '#22d87a' },
  { name: 'Blue', value: '#6eb5ff' },
  { name: 'Amber', value: '#ffb347' },
  { name: 'Red', value: '#ff5370' },
  { name: 'Purple', value: '#b48eff' },
  { name: 'Teal', value: '#2dd4bf' },
  { name: 'Pink', value: '#f472b6' },
  { name: 'Gray', value: '#9090b0' },
]

const EMPTY_FORM = { name: '', type: 'Cash', balance: '', color: '#22d87a', notes: '' }

export default function Accounts({ user, data, profile = {}, symbol, privacyMode = false, onTogglePrivacy = () => {} }) {
  const s = symbol || '₱'
  const accounts = data.accounts || []
  const [syncingDueEntries, setSyncingDueEntries] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editAccount, setEditAccount] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const editorRef = useRef(null)

  function set(key, value) {
    setForm(current => ({ ...current, [key]: value }))
  }

  function openAdd() {
    setEditAccount(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(account) {
    setEditAccount(account)
    setForm({ name: account.name, type: account.type, balance: account.balance, color: account.color || '#22d87a', notes: account.notes || '' })
    setShowModal(true)
  }

  function closeEditor() {
    setShowModal(false)
    setEditAccount(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave() {
    if (!form.name || form.balance === '') {
      notifyApp({ title: 'Account needs details', message: 'Add an account name and balance before saving.', tone: 'warning' })
      return
    }
    const amountError = validateAmount(Number(form.balance) || 0, 'Balance')
    if (amountError && Number(form.balance) !== 0) {
      notifyApp({ title: 'Check balance', message: amountError, tone: 'warning' })
      return
    }
    const payload = { name: form.name, type: form.type, balance: parseFloat(form.balance) || 0, color: form.color, notes: form.notes }
    if (editAccount) {
      await fsUpdate(user.uid, 'accounts', editAccount._id, payload)
    } else {
      await fsAdd(user.uid, 'accounts', payload)
    }
    closeEditor()
  }

  async function handleDel(id, name) {
    const linkedCount = [...(data.income || []), ...(data.expenses || [])]
      .filter(tx => tx.accountId === id).length
    const confirmed = await confirmApp({
      title: linkedCount ? 'Delete account and unlink entries?' : 'Delete account?',
      message: linkedCount
        ? `${name} is used by ${linkedCount} transaction${linkedCount === 1 ? '' : 's'}. Deleting it will keep those entries in history but remove their account link so they do not point to a missing account.`
        : `Delete ${name}? This cannot be undone.`,
      confirmLabel: linkedCount ? 'Delete and unlink' : 'Delete',
      cancelLabel: 'Keep account',
      tone: 'danger',
    })
    if (!confirmed) return
    try {
      await fsDeleteAccountAndUnlinkTransactions(user.uid, id, data)
      if (linkedCount) {
        notifyApp({
          title: 'Account deleted',
          message: `${linkedCount} transaction${linkedCount === 1 ? '' : 's'} stayed in history without the old account link.`,
          tone: 'success',
        })
      }
    } catch {
      notifyApp({ title: 'Account not deleted', message: 'Could not delete this account right now. Check your connection and try again.', tone: 'error' })
    }
  }

  const accountsWithMeta = accounts.map(account => {
    const signedBalance = getAccountSignedBalance(account)
    const tone = account.color || '#22d87a'
    return {
      ...account,
      signedBalance,
      tone,
      isDebt: signedBalance < 0,
    }
  })
  const portfolioIncludedValue = getIncludedPortfolioValue(data.portfolioHoldings || [])
  const totalBalance = getTakdaTotalBalanceNow(accounts, data.portfolioHoldings || [], data.debts || [])
  const liquidTotal = accountsWithMeta
    .filter(account => ['Cash', 'Bank', 'E-wallet'].includes(account.type))
    .reduce((sum, account) => sum + account.signedBalance, 0)
  const debtTotal = Math.abs(
    accountsWithMeta
      .filter(account => account.signedBalance < 0)
      .reduce((sum, account) => sum + account.signedBalance, 0),
  )
  const accountTypeCount = new Set(accountsWithMeta.map(account => account.type)).size
  const primaryAccount = [...accountsWithMeta]
    .sort((a, b) => Math.abs(b.signedBalance) - Math.abs(a.signedBalance))[0] || null
  const portfolioBase = accountsWithMeta.reduce((sum, account) => sum + Math.abs(account.signedBalance), 0)
  const primaryShare = primaryAccount && portfolioBase > 0
    ? Math.max(8, Math.min(100, Math.round((Math.abs(primaryAccount.signedBalance) / portfolioBase) * 100)))
    : 0
  const money = value => displayValue(privacyMode, fmt(value, s), maskMoney(s))
  const balanceFieldLabel = form.type === 'Credit Card' ? `Current amount owed (${s})` : `Balance now (${s})`
  const privacyHint = privacyMode ? 'Privacy mode on. Tap to reveal values.' : 'Tap to hide values on this page.'
  const accountCountLabel = portfolioIncludedValue
    ? `${accounts.length} account${accounts.length !== 1 ? 's' : ''} + included portfolio`
    : `${accounts.length} account${accounts.length !== 1 ? 's' : ''} right now`

  const dueLinkedEntries = useMemo(() => {
    if (!user?.uid || !accounts.length) return []
    const income = Array.isArray(data.income) ? data.income : []
    const expenses = Array.isArray(data.expenses) ? data.expenses : []
    return [
      ...income.map(tx => ({ ...tx, type: 'income' })),
      ...expenses.map(tx => ({ ...tx, type: 'expense' })),
    ].filter(tx => !tx?.accountBalanceApplied && shouldAffectCurrentAccountBalance(tx))
  }, [accounts.length, data.expenses, data.income, user?.uid])

  async function applyDueLinkedEntries() {
    if (!user?.uid || !dueLinkedEntries.length || syncingDueEntries) return
    setSyncingDueEntries(true)
    try {
      const appliedCount = await fsSyncDueLinkedTransactions(user.uid, dueLinkedEntries, accounts)
      notifyApp({
        title: 'Balances updated',
        message: appliedCount
          ? `${appliedCount} due entr${appliedCount === 1 ? 'y was' : 'ies were'} applied to account balances.`
          : 'No due entries were pending.',
        tone: 'success',
      })
    } catch {
      notifyApp({
        title: 'Could not sync balances',
        message: 'Buhay could not apply due linked entries right now. Check your connection and try again.',
        tone: 'error',
      })
    } finally {
      setSyncingDueEntries(false)
    }
  }

  useEffect(() => {
    if (showModal && editorRef.current) {
      safeScrollIntoView(editorRef.current, { behavior: 'smooth', block: 'start' })
    }
  }, [showModal, editAccount?._id])

  return (
    <div className={`${styles.page} ${accStyles.accountsPage}`}>
      <div className={accStyles.heroSection}>
        <div className={accStyles.heroCopy}>
          <div className={accStyles.pageEyebrow}>Accounts</div>
          <div className={accStyles.pageTitle}>Keep each account clear and current.</div>
          <div className={accStyles.pageSub}>
            Cash, bank, wallet, and credit balances work best when each account has a clear role and only reflects real activity.
          </div>
        </div>

        <div
          className={accStyles.heroAside}
          style={{ '--account-tone': primaryAccount?.tone || 'var(--accent)' }}
        >
          <div className={accStyles.heroAsideLabel}>{primaryAccount ? 'Largest account' : 'Accounts snapshot'}</div>
          <div className={accStyles.heroAsideValue}>
            {primaryAccount ? primaryAccount.name : 'No accounts yet'}
          </div>
          <div className={accStyles.heroAsideTrack}>
            <div className={accStyles.heroAsideFill} style={{ width: `${primaryShare}%` }} />
          </div>
          <div className={accStyles.heroAsideMeta}>
            {primaryAccount
              ? `${primaryAccount.type} · ${money(primaryAccount.signedBalance)} · ${displayValue(privacyMode, `${primaryShare}% of balances`, 'Share hidden')}`
              : 'Add your first real balance below'}
          </div>
        </div>
      </div>

      <div className={accStyles.totalCard}>
        <div className={accStyles.totalLabel}>Total balance now</div>
        <div className={accStyles.totalVal}>{money(totalBalance)}</div>
        <div className={accStyles.totalSub}>{accountCountLabel}</div>
      </div>

      {dueLinkedEntries.length > 0 && (
        <div className={accStyles.syncNotice} role="status" aria-live="polite">
          <div className={accStyles.syncNoticeCopy}>
            <div className={accStyles.syncNoticeTitle}>Balances need a quick apply</div>
            <div className={accStyles.syncNoticeMeta}>
              {dueLinkedEntries.length} paid entr{dueLinkedEntries.length === 1 ? 'y is' : 'ies are'} due but not applied to account totals yet.
            </div>
          </div>
          <button
            type="button"
            className={accStyles.primaryButton}
            onClick={applyDueLinkedEntries}
            disabled={syncingDueEntries}
          >
            {syncingDueEntries ? 'Applying…' : 'Apply now'}
          </button>
        </div>
      )}

      <div className={accStyles.summaryGrid}>
        <div className={accStyles.summaryCard}>
          <div className={accStyles.summaryLabel}>Liquid funds</div>
          <div className={`${accStyles.summaryValue} ${accStyles.summaryValueAccent}`}>{money(liquidTotal)}</div>
          <div className={accStyles.summaryMeta}>Cash, bank, and wallet balances</div>
        </div>
        <div className={accStyles.summaryCard}>
          <div className={accStyles.summaryLabel}>Debt to cover</div>
          <div className={`${accStyles.summaryValue} ${accStyles.summaryValueRed}`}>{money(debtTotal)}</div>
          <div className={accStyles.summaryMeta}>
            {debtTotal > 0 ? 'Negative or credit balances' : 'No debt balances right now'}
          </div>
        </div>
        <div className={accStyles.summaryCard}>
          <div className={accStyles.summaryLabel}>Account mix</div>
          <div className={accStyles.summaryValue}>{accountTypeCount}</div>
          <div className={accStyles.summaryMeta}>
            {accountTypeCount ? `${accountTypeCount} type${accountTypeCount !== 1 ? 's' : ''} in use` : 'No account types yet'}
          </div>
        </div>
      </div>

      <div className={accStyles.toolbar}>
        <div className={accStyles.toolbarCopy}>
          <div className={accStyles.toolbarTitle}>Account list</div>
          <div className={accStyles.toolbarMeta}>
            {accounts.length
              ? 'Edit balances carefully. Account changes affect the baseline Takda uses across balances, history, and forecasts.'
              : 'Start with the account you use most so Takda begins from a real balance, not a guess.'}
          </div>
        </div>
        <button type="button" className={accStyles.primaryButton} onClick={openAdd}>Add account</button>
      </div>

      {showModal && (
        <div ref={editorRef} className={accStyles.editorCard}>
          <div className={accStyles.editorHeader}>
            <div>
              <div className={accStyles.editorEyebrow}>{editAccount ? 'Editing account' : 'New account'}</div>
              <div className={accStyles.editorTitle}>{editAccount ? 'Update this account' : 'Add an account'}</div>
              <div className={accStyles.editorSub}>
                {editAccount ? `Updating ${editAccount.name}` : 'Create an account without leaving this page.'}
              </div>
            </div>
            <button type="button" onClick={closeEditor} className={accStyles.editorClose}>Close</button>
          </div>

          <div className={accStyles.editorGrid}>
            <div className={accStyles.field}>
              <label className={accStyles.fieldLabel} htmlFor="account-name">Account name</label>
              <input
                id="account-name"
                className={accStyles.fieldInput}
                placeholder="e.g. BDO Savings"
                value={form.name}
                onChange={event => set('name', event.target.value)}
              />
            </div>

            <div className={accStyles.field}>
              <label className={accStyles.fieldLabel} htmlFor="account-type">Type</label>
              <select
                id="account-type"
                className={accStyles.fieldInput}
                value={form.type}
                onChange={event => set('type', event.target.value)}
              >
                {ACCOUNT_TYPES.map(type => <option key={type}>{type}</option>)}
              </select>
            </div>

            <div className={accStyles.field}>
              <label className={accStyles.fieldLabel} htmlFor="account-balance">{balanceFieldLabel}</label>
              <input
                id="account-balance"
                className={accStyles.fieldInput}
                type="number"
                min="0"
                inputMode="decimal"
                placeholder="0.00"
                value={form.balance}
                onChange={event => set('balance', event.target.value)}
              />
            </div>
          </div>

          <details className={accStyles.advancedBox}>
            <summary className={accStyles.advancedSummary}>
              <span>More options</span>
              <small>Notes and card color</small>
            </summary>
            <div className={accStyles.advancedBody}>
              <div className={accStyles.field}>
                <label className={accStyles.fieldLabel} htmlFor="account-notes">Notes</label>
                <input
                  id="account-notes"
                  className={accStyles.fieldInput}
                  placeholder="e.g. Emergency only"
                  value={form.notes}
                  onChange={event => set('notes', event.target.value)}
                />
              </div>

              <div className={accStyles.colorSection}>
                <div className={accStyles.fieldLabel}>Color</div>
                <div className={accStyles.colorGrid}>
                  {COLORS.map(color => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => set('color', color.value)}
                      className={`${accStyles.colorBtn} ${form.color === color.value ? accStyles.colorBtnActive : ''}`}
                      style={{ '--swatch': color.value }}
                      title={color.name}
                      aria-pressed={form.color === color.value}
                    />
                  ))}
                </div>
              </div>
            </div>
          </details>

          <div className={accStyles.editorActions}>
            <button type="button" onClick={closeEditor} className={accStyles.secondaryButton}>Cancel</button>
            <button type="button" onClick={handleSave} className={accStyles.primaryButton}>
              {editAccount ? 'Save changes' : 'Add account'}
            </button>
          </div>
        </div>
      )}

      {!accounts.length ? (
        <div className={accStyles.emptyCard}>
          <div className={accStyles.emptyTitle}>No accounts yet</div>
          <div className={accStyles.emptyBody}>Add one above so Buhay starts from a real balance and the rest of Takda stays easier to trust.</div>
        </div>
      ) : (
        <div className={accStyles.accountsGrid}>
          {accountsWithMeta.map(account => (
            <div
              key={account._id}
              className={`${accStyles.accountCard} ${editAccount?._id === account._id ? accStyles.accountCardEditing : ''}`}
              style={{ '--account-tone': account.tone }}
            >
              <div className={accStyles.accountTop}>
                <div className={accStyles.accountLeading}>
                  <div className={accStyles.accountIcon}>
                    {ACCOUNT_ICONS[account.type] || '🏷'}
                  </div>
                  <div className={accStyles.accountInfo}>
                    <div className={accStyles.accountName}>{account.name}</div>
                    <div className={accStyles.accountType}>
                      <span className={accStyles.typeDot} />
                      {account.type}
                    </div>
                  </div>
                </div>
                <div className={accStyles.accountActions}>
                  <button type="button" className={accStyles.cardAction} onClick={() => openEdit(account)}>Edit</button>
                  <button type="button" className={`${accStyles.cardAction} ${accStyles.cardActionDanger}`} onClick={() => handleDel(account._id, account.name)}>Delete</button>
                </div>
              </div>

              <div className={accStyles.accountBalanceLabel}>{account.isDebt ? 'Current owed' : 'Available balance'}</div>
              <div className={`${accStyles.accountBalance} ${account.isDebt ? accStyles.accountBalanceDebt : ''}`}>
                {money(account.signedBalance)}
              </div>

              <div className={accStyles.accountFooter}>
                <div className={accStyles.accountState}>
                  {account.isDebt ? 'Debt account' : 'Asset account'}
                </div>
                {editAccount?._id === account._id && <div className={accStyles.editingPill}>Editing</div>}
              </div>

              {account.notes && <div className={accStyles.accountNotes}>{account.notes}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
