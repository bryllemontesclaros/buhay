import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { fsAdd, fsDeleteAccountAndUnlinkTransactions, fsSyncDueLinkedTransactions, fsTransferAccounts, fsUpdate } from '../lib/firestore'
import { getAccountSignedBalance, shouldAffectCurrentAccountBalance } from '../lib/finance'
import { getTakdaTotalBalanceNow } from '../lib/balanceSystem'
import { confirmApp, notifyApp } from '../lib/appFeedback'
import { displayValue, fmt, maskMoney, today, validateAmount } from '../lib/utils'
import styles from './Page.module.css'
import accStyles from './Accounts.module.css'

const ACCOUNT_TYPES = ['Bank', 'E-wallet', 'Cash', 'Investment', 'Other']
const ACCOUNT_ICONS = { Bank: '🏦', 'E-wallet': '📱', Cash: '💵', Investment: '📈', Other: '🏷' }
const TYPE_COLORS = {
  Bank: '#3b82f6',
  'E-wallet': '#10b981',
  Cash: '#f59e0b',
  Investment: '#8b5cf6',
  Other: '#06b6d4',
}

const COLORS = [
  { name: 'Green', value: '#22d87a' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Amber', value: '#ffb347' },
  { name: 'Red', value: '#ff5370' },
  { name: 'Purple', value: '#b48eff' },
  { name: 'Teal', value: '#2dd4bf' },
  { name: 'Pink', value: '#f472b6' },
  { name: 'Gray', value: '#9090b0' },
]

const EMPTY_FORM = { name: '', type: 'Bank', balance: '', creditLimit: '', color: '#3b82f6', notes: '' }

export default function Accounts({ user, data, profile = {}, symbol, privacyMode = false, onTogglePrivacy = () => {}, hideHeader = false }) {
  const s = symbol || '₱'
  const accounts = (data.accounts || []).filter(a => a.type !== 'Credit Card')
  const allAccounts = data.accounts || []
  
  const [syncingDueEntries, setSyncingDueEntries] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editAccount, setEditAccount] = useState(null)
  const [showModal, setShowModal] = useState(false)

  // 1-Click Quick Adjust Balance State
  const [adjustTarget, setAdjustTarget] = useState(null)
  const [adjustNewBalance, setAdjustNewBalance] = useState('')
  const [adjustSaving, setAdjustSaving] = useState(false)

  // 1-Click Inter-Account Transfer State
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferSaving, setTransferSaving] = useState(false)
  const [transferForm, setTransferForm] = useState({
    fromAccountId: '',
    toAccountId: '',
    amount: '',
    date: today(),
    desc: 'Transfer',
  })

  function setField(key, value) {
    setForm(current => ({ ...current, [key]: value }))
  }

  function openAdd() {
    setEditAccount(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(account) {
    setEditAccount(account)
    setForm({
      name: account.name,
      type: account.type || 'Bank',
      balance: account.balance,
      creditLimit: account.creditLimit || '',
      color: account.color || TYPE_COLORS[account.type] || '#3b82f6',
      notes: account.notes || '',
    })
    setShowModal(true)
  }

  function closeEditor() {
    setShowModal(false)
    setEditAccount(null)
    setForm(EMPTY_FORM)
  }

  // Quick Adjust Modal Open/Close
  function openQuickAdjust(account) {
    setAdjustTarget(account)
    setAdjustNewBalance(String(account.balance ?? ''))
  }

  function closeQuickAdjust() {
    setAdjustTarget(null)
    setAdjustNewBalance('')
  }

  // Quick Transfer Modal Open/Close
  function openQuickTransfer(sourceAccount = null) {
    const fromId = sourceAccount?._id || (accounts[0]?._id || '')
    const toId = accounts.find(a => a._id !== fromId)?._id || ''
    setTransferForm({
      fromAccountId: fromId,
      toAccountId: toId,
      amount: '',
      date: today(),
      desc: 'Transfer',
    })
    setShowTransferModal(true)
  }

  function closeQuickTransfer() {
    setShowTransferModal(false)
    setTransferSaving(false)
  }

  async function handleSaveAccount() {
    if (!form.name || form.balance === '') {
      notifyApp({ title: 'Account needs details', message: 'Add an account name and balance before saving.', tone: 'warning' })
      return
    }
    const amountError = validateAmount(Number(form.balance) || 0, 'Balance')
    if (amountError && Number(form.balance) !== 0) {
      notifyApp({ title: 'Check balance', message: amountError, tone: 'warning' })
      return
    }
    const payload = {
      name: form.name.trim(),
      type: form.type,
      balance: parseFloat(form.balance) || 0,
      color: form.color || TYPE_COLORS[form.type] || '#3b82f6',
      notes: form.notes ? form.notes.trim() : '',
    }
    try {
      if (editAccount) {
        await fsUpdate(user.uid, 'accounts', editAccount._id, payload)
        notifyApp({ title: 'Account updated', message: `${payload.name} saved successfully.`, tone: 'success' })
      } else {
        await fsAdd(user.uid, 'accounts', payload)
        notifyApp({ title: 'Account created', message: `${payload.name} added to your accounts.`, tone: 'success' })
      }
      closeEditor()
    } catch (err) {
      notifyApp({ title: 'Save failed', message: err.message || 'Could not save account.', tone: 'error' })
    }
  }

  async function handleAdjustSubmit(e) {
    if (e) e.preventDefault()
    if (!adjustTarget) return
    const newBal = parseFloat(adjustNewBalance)
    if (isNaN(newBal)) {
      notifyApp({ title: 'Check balance', message: 'Enter a valid number for the balance.', tone: 'warning' })
      return
    }
    setAdjustSaving(true)
    try {
      await fsUpdate(user.uid, 'accounts', adjustTarget._id, { balance: newBal })
      const diff = newBal - (Number(adjustTarget.balance) || 0)
      notifyApp({
        title: 'Balance updated',
        message: `${adjustTarget.name} adjusted to ${fmt(newBal, s)} (${diff >= 0 ? '+' : ''}${fmt(diff, s)} difference).`,
        tone: 'success',
      })
      closeQuickAdjust()
    } catch (err) {
      notifyApp({ title: 'Update failed', message: err.message || 'Could not update balance.', tone: 'error' })
    } finally {
      setAdjustSaving(false)
    }
  }

  async function handleTransferSubmit(e) {
    if (e) e.preventDefault()
    const amount = Number(transferForm.amount) || 0
    if (amount <= 0) {
      notifyApp({ title: 'Check amount', message: 'Enter a transfer amount greater than zero.', tone: 'warning' })
      return
    }
    if (!transferForm.fromAccountId || !transferForm.toAccountId) {
      notifyApp({ title: 'Select accounts', message: 'Both source and destination accounts are required.', tone: 'warning' })
      return
    }
    if (transferForm.fromAccountId === transferForm.toAccountId) {
      notifyApp({ title: 'Invalid accounts', message: 'Source and destination accounts must be different.', tone: 'warning' })
      return
    }
    setTransferSaving(true)
    try {
      await fsTransferAccounts(user.uid, transferForm, allAccounts)
      const fromAcc = accounts.find(a => a._id === transferForm.fromAccountId)
      const toAcc = accounts.find(a => a._id === transferForm.toAccountId)
      notifyApp({
        title: 'Transfer successful',
        message: `Transferred ${fmt(amount, s)} from ${fromAcc?.name || 'account'} to ${toAcc?.name || 'account'}.`,
        tone: 'success',
      })
      closeQuickTransfer()
    } catch (err) {
      notifyApp({ title: 'Transfer failed', message: err.message || 'Could not process transfer.', tone: 'error' })
    } finally {
      setTransferSaving(false)
    }
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
      notifyApp({
        title: 'Account deleted',
        message: `${name} has been removed.`,
        tone: 'success',
      })
    } catch {
      notifyApp({ title: 'Account not deleted', message: 'Could not delete this account right now.', tone: 'error' })
    }
  }

  const money = value => displayValue(privacyMode, fmt(value, s), maskMoney(s))
  const totalBalance = getTakdaTotalBalanceNow(allAccounts, data.debts || [])

  const liquidTotal = accounts
    .filter(account => ['Cash', 'Bank', 'E-wallet'].includes(account.type))
    .reduce((sum, account) => sum + Math.max(0, Number(account.balance) || 0), 0)

  const investmentTotal = accounts
    .filter(account => account.type === 'Investment')
    .reduce((sum, account) => sum + Math.max(0, Number(account.balance) || 0), 0)

  const accountsWithMeta = useMemo(() => {
    return accounts.map(account => {
      const signedBalance = getAccountSignedBalance(account)
      const tone = account.color || TYPE_COLORS[account.type] || '#3b82f6'
      const share = liquidTotal > 0 && signedBalance > 0
        ? Math.round((signedBalance / liquidTotal) * 100)
        : 0
      return {
        ...account,
        signedBalance,
        tone,
        share,
        isDebt: signedBalance < 0,
      }
    })
  }, [accounts, liquidTotal])

  // Liquidity distribution segments
  const allocationSegments = useMemo(() => {
    if (!liquidTotal && !investmentTotal) return []
    const base = liquidTotal + investmentTotal
    const types = ['Bank', 'E-wallet', 'Cash', 'Investment']
    return types.map(t => {
      const total = accounts
        .filter(a => a.type === t)
        .reduce((sum, a) => sum + Math.max(0, Number(a.balance) || 0), 0)
      const pct = base > 0 ? (total / base) * 100 : 0
      return {
        type: t,
        total,
        pct: Math.round(pct),
        color: TYPE_COLORS[t] || '#3b82f6',
        icon: ACCOUNT_ICONS[t] || '🏷',
      }
    }).filter(s => s.total > 0)
  }, [accounts, liquidTotal, investmentTotal])

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
        message: 'Could not apply due linked entries right now.',
        tone: 'error',
      })
    } finally {
      setSyncingDueEntries(false)
    }
  }

  const mainContent = (
    <>
      {!hideHeader && (
        <div className={styles.pageHero}>
          <div className={styles.pageHeader}>
            <div className={styles.pageEyebrow}>Accounts</div>
            <div className={styles.pageTitle}>Keep each account clear and current.</div>
            <div className={styles.pageSub}>
              Cash, bank, and wallet balances work best when every account has an accurate real-world balance.
            </div>
          </div>
        </div>
      )}

      {/* LIQUIDITY RADAR HERO CARD */}
      <div className={accStyles.radarHeroCard}>
        <div className={accStyles.radarHeroTop}>
          <div className={accStyles.radarHeroCopy}>
            <span className={accStyles.radarHeroLabel}>Total Liquid Balance</span>
            <div className={accStyles.radarHeroVal}>{money(liquidTotal)}</div>
          </div>
          <div className={accStyles.radarHeroActions}>
            <button
              type="button"
              className={accStyles.btnHeroSecondary}
              onClick={() => openQuickTransfer()}
              disabled={accounts.length < 2}
              title={accounts.length < 2 ? 'Need at least 2 accounts to transfer' : 'Transfer between accounts'}
            >
              ⇄ Transfer
            </button>
            <button type="button" className={accStyles.btnHeroPrimary} onClick={openAdd}>
              + Add Account
            </button>
          </div>
        </div>

        {/* ALLOCATION PROGRESS STRIP */}
        {allocationSegments.length > 0 && (
          <div className={accStyles.allocationSection}>
            <div className={accStyles.allocationTrack}>
              {allocationSegments.map(seg => (
                <div
                  key={seg.type}
                  className={accStyles.allocationFill}
                  style={{ width: `${seg.pct}%`, background: seg.color }}
                  title={`${seg.type}: ${fmt(seg.total, s)} (${seg.pct}%)`}
                />
              ))}
            </div>
            <div className={accStyles.allocationLegend}>
              {allocationSegments.map(seg => (
                <div key={seg.type} className={accStyles.allocationPill}>
                  <span className={accStyles.allocationDot} style={{ background: seg.color }} />
                  <span className={accStyles.allocationType}>{seg.icon} {seg.type}</span>
                  <strong className={accStyles.allocationAmount}>{money(seg.total)}</strong>
                  <span className={accStyles.allocationPct}>{seg.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
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

      {/* ACCOUNT CARDS GRID */}
      <div className={accStyles.toolbar}>
        <div className={accStyles.toolbarTitle}>
          Active Accounts ({accounts.length})
        </div>
      </div>

      {!accounts.length ? (
        <div className={accStyles.emptyCard}>
          <div className={accStyles.emptyIcon}>🏦</div>
          <div className={accStyles.emptyTitle}>No accounts yet</div>
          <div className={accStyles.emptyBody}>Add your bank, e-wallet, or physical cash balance to start tracking with real numbers.</div>
          <button type="button" className={accStyles.btnHeroPrimary} onClick={openAdd} style={{ marginTop: 12 }}>
            + Add Your First Account
          </button>
        </div>
      ) : (
        <div className={accStyles.accountsGrid}>
          {accountsWithMeta.map(account => (
            <div
              key={account._id}
              className={accStyles.accountCard}
              style={{ '--account-tone': account.tone }}
            >
              <div className={accStyles.accountTop}>
                <div className={accStyles.accountLeading}>
                  <div className={accStyles.accountIcon} style={{ background: `color-mix(in srgb, ${account.tone} 18%, var(--surface2))` }}>
                    {ACCOUNT_ICONS[account.type] || '🏷'}
                  </div>
                  <div className={accStyles.accountInfo}>
                    <div className={accStyles.accountName}>{account.name}</div>
                    <div className={accStyles.accountType}>
                      <span className={accStyles.typeDot} style={{ background: account.tone }} />
                      {account.type}
                      {account.share > 0 && (
                        <span className={accStyles.sharePill}>{account.share}% of cash</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className={accStyles.accountActions}>
                  <button
                    type="button"
                    className={accStyles.cardActionBtn}
                    onClick={() => openEdit(account)}
                    title="Edit account details"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    className={`${accStyles.cardActionBtn} ${accStyles.cardActionBtnDanger}`}
                    onClick={() => handleDel(account._id, account.name)}
                    title="Delete account"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className={accStyles.accountBalanceBox}>
                <div className={accStyles.accountBalanceLabel}>Available Balance</div>
                <div className={`${accStyles.accountBalance} ${account.isDebt ? accStyles.accountBalanceDebt : ''}`}>
                  {money(account.signedBalance)}
                </div>
              </div>

              {account.notes && <div className={accStyles.accountNotes}>“{account.notes}”</div>}

              {/* CARD BOTTOM QUICK ACTIONS */}
              <div className={accStyles.cardFooterActions}>
                <button
                  type="button"
                  className={accStyles.btnCardAction}
                  onClick={() => openQuickAdjust(account)}
                  title="Reconcile / adjust current balance"
                >
                  ⚡ Adjust Balance
                </button>
                <button
                  type="button"
                  className={accStyles.btnCardActionSecondary}
                  onClick={() => openQuickTransfer(account)}
                  disabled={accounts.length < 2}
                  title="Transfer money from this account"
                >
                  ⇄ Transfer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 1-CLICK QUICK ADJUST BALANCE MODAL */}
      {adjustTarget && typeof document !== 'undefined' && createPortal(
        <div className={accStyles.modalOverlay} onClick={closeQuickAdjust}>
          <div className={accStyles.modalCard} onClick={e => e.stopPropagation()}>
            <div className={accStyles.modalHeader}>
              <div>
                <div className={accStyles.modalEyebrow}>⚡ Quick Reconcile</div>
                <div className={accStyles.modalTitle}>Adjust {adjustTarget.name}</div>
              </div>
              <button type="button" className={accStyles.modalClose} onClick={closeQuickAdjust}>✕</button>
            </div>

            <form onSubmit={handleAdjustSubmit} className={accStyles.modalBody}>
              <div className={accStyles.adjustCurrentStrip}>
                <span className={accStyles.adjustCurrentLabel}>Current recorded balance:</span>
                <strong className={accStyles.adjustCurrentVal}>{money(adjustTarget.balance)}</strong>
              </div>

              <div className={accStyles.field}>
                <label className={accStyles.fieldLabel} htmlFor="adjust-bal-input">
                  Actual current balance in real life ({s})
                </label>
                <input
                  id="adjust-bal-input"
                  type="number"
                  step="any"
                  className={accStyles.fieldInputBig}
                  placeholder="0.00"
                  value={adjustNewBalance}
                  onChange={e => setAdjustNewBalance(e.target.value)}
                  autoFocus
                />
              </div>

              {adjustNewBalance !== '' && !isNaN(parseFloat(adjustNewBalance)) && (
                <div className={accStyles.adjustDiffStrip}>
                  <span>Difference:</span>
                  <strong className={parseFloat(adjustNewBalance) - Number(adjustTarget.balance) >= 0 ? accStyles.diffPositive : accStyles.diffNegative}>
                    {parseFloat(adjustNewBalance) - Number(adjustTarget.balance) >= 0 ? '+' : ''}
                    {fmt(parseFloat(adjustNewBalance) - Number(adjustTarget.balance), s)}
                  </strong>
                </div>
              )}

              <div className={accStyles.modalActions}>
                <button type="button" className={accStyles.btnSecondary} onClick={closeQuickAdjust}>
                  Cancel
                </button>
                <button type="submit" className={accStyles.btnPrimary} disabled={adjustSaving}>
                  {adjustSaving ? 'Updating…' : 'Save Balance'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 1-CLICK INTER-ACCOUNT TRANSFER MODAL */}
      {showTransferModal && typeof document !== 'undefined' && createPortal(
        <div className={accStyles.modalOverlay} onClick={closeQuickTransfer}>
          <div className={accStyles.modalCard} onClick={e => e.stopPropagation()}>
            <div className={accStyles.modalHeader}>
              <div>
                <div className={accStyles.modalEyebrow}>⇄ Inter-Account Transfer</div>
                <div className={accStyles.modalTitle}>Move Money</div>
              </div>
              <button type="button" className={accStyles.modalClose} onClick={closeQuickTransfer}>✕</button>
            </div>

            <form onSubmit={handleTransferSubmit} className={accStyles.modalBody}>
              <div className={accStyles.transferGrid}>
                <div className={accStyles.field}>
                  <label className={accStyles.fieldLabel} htmlFor="transfer-from">From Account</label>
                  <select
                    id="transfer-from"
                    className={accStyles.fieldInput}
                    value={transferForm.fromAccountId}
                    onChange={e => setTransferForm(prev => ({ ...prev, fromAccountId: e.target.value }))}
                  >
                    {accounts.map(a => (
                      <option key={a._id} value={a._id} disabled={a._id === transferForm.toAccountId}>
                        {ACCOUNT_ICONS[a.type] || '🏷'} {a.name} ({fmt(a.balance, s)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className={accStyles.transferArrowWrap}>➔</div>

                <div className={accStyles.field}>
                  <label className={accStyles.fieldLabel} htmlFor="transfer-to">To Account</label>
                  <select
                    id="transfer-to"
                    className={accStyles.fieldInput}
                    value={transferForm.toAccountId}
                    onChange={e => setTransferForm(prev => ({ ...prev, toAccountId: e.target.value }))}
                  >
                    {accounts.map(a => (
                      <option key={a._id} value={a._id} disabled={a._id === transferForm.fromAccountId}>
                        {ACCOUNT_ICONS[a.type] || '🏷'} {a.name} ({fmt(a.balance, s)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={accStyles.field}>
                <label className={accStyles.fieldLabel} htmlFor="transfer-amount">Amount ({s})</label>
                <input
                  id="transfer-amount"
                  type="number"
                  step="any"
                  min="0.01"
                  className={accStyles.fieldInputBig}
                  placeholder="0.00"
                  value={transferForm.amount}
                  onChange={e => setTransferForm(prev => ({ ...prev, amount: e.target.value }))}
                  autoFocus
                />
              </div>

              <div className={accStyles.field}>
                <label className={accStyles.fieldLabel} htmlFor="transfer-date">Date</label>
                <input
                  id="transfer-date"
                  type="date"
                  className={accStyles.fieldInput}
                  value={transferForm.date}
                  onChange={e => setTransferForm(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>

              <div className={accStyles.field}>
                <label className={accStyles.fieldLabel} htmlFor="transfer-desc">Note (Optional)</label>
                <input
                  id="transfer-desc"
                  type="text"
                  className={accStyles.fieldInput}
                  placeholder="e.g. ATM cash withdrawal, wallet reload"
                  value={transferForm.desc}
                  onChange={e => setTransferForm(prev => ({ ...prev, desc: e.target.value }))}
                />
              </div>

              <div className={accStyles.modalActions}>
                <button type="button" className={accStyles.btnSecondary} onClick={closeQuickTransfer}>
                  Cancel
                </button>
                <button type="submit" className={accStyles.btnPrimary} disabled={transferSaving}>
                  {transferSaving ? 'Transferring…' : 'Complete Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* NEW / EDIT ACCOUNT MODAL */}
      {showModal && typeof document !== 'undefined' && createPortal(
        <div className={accStyles.modalOverlay} onClick={closeEditor}>
          <div className={accStyles.modalCard} onClick={e => e.stopPropagation()}>
            <div className={accStyles.modalHeader}>
              <div>
                <div className={accStyles.modalEyebrow}>{editAccount ? 'Editing Account' : 'New Account'}</div>
                <div className={accStyles.modalTitle}>{editAccount ? `Update ${editAccount.name}` : 'Add New Account'}</div>
              </div>
              <button type="button" className={accStyles.modalClose} onClick={closeEditor}>✕</button>
            </div>

            <div className={accStyles.modalBody}>
              <div className={accStyles.field}>
                <label className={accStyles.fieldLabel} htmlFor="account-name">Account Name</label>
                <input
                  id="account-name"
                  className={accStyles.fieldInput}
                  placeholder="e.g. BDO Savings, GCash"
                  value={form.name}
                  onChange={e => setField('name', e.target.value)}
                  autoFocus
                />
              </div>

              <div className={accStyles.field}>
                <label className={accStyles.fieldLabel} htmlFor="account-type">Account Type</label>
                <select
                  id="account-type"
                  className={accStyles.fieldInput}
                  value={form.type}
                  onChange={e => {
                    const newType = e.target.value
                    setField('type', newType)
                    if (!editAccount) {
                      setField('color', TYPE_COLORS[newType] || '#3b82f6')
                    }
                  }}
                >
                  {ACCOUNT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {ACCOUNT_ICONS[type] || '🏷'} {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className={accStyles.field}>
                <label className={accStyles.fieldLabel} htmlFor="account-balance">Starting Balance ({s})</label>
                <input
                  id="account-balance"
                  className={accStyles.fieldInputBig}
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={form.balance}
                  onChange={e => setField('balance', e.target.value)}
                />
              </div>

              <div className={accStyles.field}>
                <label className={accStyles.fieldLabel} htmlFor="account-notes">Notes / Purpose</label>
                <input
                  id="account-notes"
                  className={accStyles.fieldInput}
                  placeholder="e.g. Daily spending, Payroll"
                  value={form.notes}
                  onChange={e => setField('notes', e.target.value)}
                />
              </div>

              <div className={accStyles.colorSection}>
                <div className={accStyles.fieldLabel}>Theme Color</div>
                <div className={accStyles.colorGrid}>
                  {COLORS.map(color => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setField('color', color.value)}
                      className={`${accStyles.colorBtn} ${form.color === color.value ? accStyles.colorBtnActive : ''}`}
                      style={{ '--swatch': color.value }}
                      title={color.name}
                      aria-pressed={form.color === color.value}
                    />
                  ))}
                </div>
              </div>

              <div className={accStyles.modalActions}>
                <button type="button" className={accStyles.btnSecondary} onClick={closeEditor}>
                  Cancel
                </button>
                <button type="button" className={accStyles.btnPrimary} onClick={handleSaveAccount}>
                  {editAccount ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )

  return hideHeader ? mainContent : <div className={styles.page}>{mainContent}</div>
}
