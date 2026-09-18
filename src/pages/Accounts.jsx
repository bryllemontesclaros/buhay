import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  fsAdd,
  fsDeleteAccountAndUnlinkTransactions,
  fsSyncDueLinkedTransactions,
  fsTransferAccounts,
  fsTransferFiatToCrypto,
  fsTransferCryptoToFiat,
  fsUpdate,
} from '../lib/firestore'
import { getAccountSignedBalance, shouldAffectCurrentAccountBalance } from '../lib/finance'
import { getTakdaTotalBalanceNow } from '../lib/balanceSystem'
import { confirmApp, notifyApp } from '../lib/appFeedback'
import { displayValue, fmt, maskMoney, today, validateAmount } from '../lib/utils'
import { getCachedPrices } from '../lib/crypto'
import styles from './Page.module.css'
import accStyles from './Accounts.module.css'
import SwipeableCard from '../components/SwipeableCard'
import QuickAdjustModal from '../components/modals/QuickAdjustModal'
import TransferModal from '../components/modals/TransferModal'
import AccountEditorModal from '../components/modals/AccountEditorModal'

import { ACCOUNT_TYPES, ACCOUNT_ICONS, TYPE_COLORS, COLORS } from '../lib/accountConstants'

const EMPTY_FORM = { name: '', type: 'Bank', balance: '', creditLimit: '', color: '#3b82f6', notes: '' }

export default function Accounts({ user, data, profile = {}, symbol, privacyMode = false, onTogglePrivacy = () => {}, hideHeader = false }) {
  const s = symbol || '₱'
  const accounts = (data.accounts || []).filter(a => a.type !== 'Credit Card')
  const allAccounts = data.accounts || []
  const holdings = useMemo(() => Array.isArray(data?.portfolioHoldings) ? data.portfolioHoldings.filter(Boolean) : [], [data?.portfolioHoldings])
  const cryptoPriceMap = useMemo(() => {
    const cached = getCachedPrices()
    return cached?.data || {}
  }, [holdings])
  
  const [syncingDueEntries, setSyncingDueEntries] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editAccount, setEditAccount] = useState(null)
  const [showModal, setShowModal] = useState(false)

  // 1-Click Quick Adjust Balance State
  const [adjustTarget, setAdjustTarget] = useState(null)
  const [adjustNewBalance, setAdjustNewBalance] = useState('')
  const [adjustLogToHistory, setAdjustLogToHistory] = useState(true)
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
    setAdjustLogToHistory(true)
  }

  function closeQuickAdjust() {
    setAdjustTarget(null)
    setAdjustNewBalance('')
    setAdjustLogToHistory(true)
  }

  // Quick Transfer Modal Open/Close
  function openQuickTransfer(sourceAccount = null) {
    const fromId = sourceAccount?._id || (accounts[0]?._id || '')
    let toId = accounts.find(a => a._id !== fromId)?._id || ''
    if (!toId) {
      if (holdings.length > 0) {
        toId = `crypto:${holdings[0]._id}`
      } else {
        toId = 'new_crypto:bitcoin'
      }
    }
    setTransferForm({
      fromAccountId: fromId,
      toAccountId: toId,
      amount: '',
      date: today(),
      desc: '',
      tokenQty: '',
      customTokenQty: '',
    })
    setShowTransferModal(true)
  }

  function closeQuickTransfer() {
    setShowTransferModal(false)
    setTransferSaving(false)
  }

  function swapTransferDirection() {
    setTransferForm(prev => ({
      ...prev,
      fromAccountId: prev.toAccountId,
      toAccountId: prev.fromAccountId,
    }))
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
      const diff = newBal - (Number(adjustTarget.balance) || 0)
      await fsUpdate(user.uid, 'accounts', adjustTarget._id, { balance: newBal })

      // Optional smart reconciliation transaction logging
      if (adjustLogToHistory && diff !== 0) {
        const isPositive = diff > 0
        const col = isPositive ? 'income' : 'expenses'
        await fsAdd(user.uid, col, {
          name: `${adjustTarget.name} Reconcile Adjustment`,
          amount: Math.abs(diff),
          category: 'Adjustment',
          date: today(),
          accountId: adjustTarget._id,
          accountBalanceLinked: true,
          accountBalanceApplied: true,
          notes: `Automatic ledger adjustment from balance reconciliation (${fmt(adjustTarget.balance, s)} → ${fmt(newBal, s)})`,
        })
      }

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
    const fromId = String(transferForm.fromAccountId || '')
    const toId = String(transferForm.toAccountId || '')

    const isFromCrypto = fromId.startsWith('crypto:')
    const isToCrypto = toId.startsWith('crypto:') || toId.startsWith('new_crypto:')

    if (!fromId || !toId) {
      notifyApp({ title: 'Select source and target', message: 'Both source and destination are required.', tone: 'warning' })
      return
    }
    if (fromId === toId) {
      notifyApp({ title: 'Invalid selection', message: 'Source and destination must be different.', tone: 'warning' })
      return
    }

    setTransferSaving(true)
    try {
      if (isToCrypto) {
        // CASE A: Bank -> Crypto (Buy / On-ramp)
        const fiatAmount = Number(transferForm.amount) || 0
        if (fiatAmount <= 0) {
          notifyApp({ title: 'Check amount', message: 'Enter a transfer amount greater than zero.', tone: 'warning' })
          setTransferSaving(false)
          return
        }
        const fromAcc = accounts.find(a => a._id === fromId)
        if (!fromAcc) throw new Error('Source bank account not found.')
        if (Number(fromAcc.balance || 0) < fiatAmount) {
          notifyApp({ title: 'Insufficient balance', message: `${fromAcc.name} only has ${fmt(fromAcc.balance, s)}.`, tone: 'warning' })
          setTransferSaving(false)
          return
        }

        const effectiveTokens = Number(transferForm.customTokenQty || (fiatAmount / (transferForm.pricePerToken || 1)))
        if (!effectiveTokens || effectiveTokens <= 0) {
          notifyApp({ title: 'Invalid tokens', message: 'Calculated tokens must be greater than zero.', tone: 'warning' })
          setTransferSaving(false)
          return
        }

        await fsTransferFiatToCrypto(user.uid, {
          fromAccountId: fromId,
          toHoldingId: toId.startsWith('crypto:') ? toId.replace('crypto:', '') : null,
          coinId: transferForm.coinId,
          coinSymbol: transferForm.coinSymbol,
          coinName: transferForm.coinName,
          fiatAmount,
          tokenQty: effectiveTokens,
          pricePerToken: transferForm.pricePerToken,
          date: transferForm.date,
          desc: transferForm.desc,
          currency: s === '$' ? 'USD' : 'PHP',
        }, allAccounts, holdings)

        notifyApp({
          title: 'Crypto funded',
          message: `Transferred ${fmt(fiatAmount, s)} from ${fromAcc.name} to ${transferForm.coinSymbol || 'Crypto'} (+${effectiveTokens.toLocaleString(undefined, { maximumFractionDigits: 6 })} tokens).`,
          tone: 'success',
        })
      } else if (isFromCrypto) {
        // CASE B: Crypto -> Bank (Sell / Cash-out)
        const tokenQty = Number(transferForm.tokenQty) || 0
        const fiatAmount = Number(transferForm.amount) || 0
        if (tokenQty <= 0 || fiatAmount <= 0) {
          notifyApp({ title: 'Check amount', message: 'Enter tokens to sell or cash proceeds.', tone: 'warning' })
          setTransferSaving(false)
          return
        }
        const toAcc = accounts.find(a => a._id === toId)
        if (!toAcc) throw new Error('Destination bank account not found.')

        const holdingId = fromId.replace('crypto:', '')
        const sourceHolding = holdings.find(h => h._id === holdingId)
        const currentQty = parseFloat(sourceHolding?.quantity ?? sourceHolding?.qty ?? 0) || 0
        if (tokenQty > currentQty + 0.0000001) {
          notifyApp({ title: 'Insufficient tokens', message: `You only hold ${currentQty} ${sourceHolding?.symbol || 'tokens'}.`, tone: 'warning' })
          setTransferSaving(false)
          return
        }

        await fsTransferCryptoToFiat(user.uid, {
          fromHoldingId: holdingId,
          toAccountId: toId,
          tokenQty,
          fiatAmount,
          pricePerToken: transferForm.pricePerToken,
          date: transferForm.date,
          desc: transferForm.desc,
        }, allAccounts, holdings)

        notifyApp({
          title: 'Cash out successful',
          message: `Cashed out ${tokenQty.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${transferForm.coinSymbol || 'Crypto'} for ${fmt(fiatAmount, s)} into ${toAcc.name}.`,
          tone: 'success',
        })
      } else {
        // CASE C: Standard Bank <-> Bank Transfer (UNTOUCHED)
        const amount = Number(transferForm.amount) || 0
        if (amount <= 0) {
          notifyApp({ title: 'Check amount', message: 'Enter a transfer amount greater than zero.', tone: 'warning' })
          setTransferSaving(false)
          return
        }
        await fsTransferAccounts(user.uid, transferForm, allAccounts)
        const fromAcc = accounts.find(a => a._id === fromId)
        const toAcc = accounts.find(a => a._id === toId)
        notifyApp({
          title: 'Transfer successful',
          message: `Transferred ${fmt(amount, s)} from ${fromAcc?.name || 'account'} to ${toAcc?.name || 'account'}.`,
          tone: 'success',
        })
      }
      closeQuickTransfer()
    } catch (err) {
      console.error('[Accounts] Transfer error:', err)
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

  // Asset class groupings with sub-totals
  const accountGroups = useMemo(() => {
    const rawGroups = [
      {
        id: 'wallets',
        title: 'Digital Wallets & Cash',
        icon: '📱',
        desc: 'Daily pocket money & instant e-wallets',
        accounts: accountsWithMeta.filter(a => ['E-wallet', 'Cash'].includes(a.type)),
      },
      {
        id: 'banks',
        title: 'Bank Accounts & Savings',
        icon: '🏦',
        desc: 'Checking, savings & depository accounts',
        accounts: accountsWithMeta.filter(a => a.type === 'Bank'),
      },
      {
        id: 'investments',
        title: 'Investments & Assets',
        icon: '📈',
        desc: 'Stocks, funds & long-term capital',
        accounts: accountsWithMeta.filter(a => ['Investment', 'Other'].includes(a.type) || !['Bank', 'E-wallet', 'Cash'].includes(a.type)),
      },
    ]

    return rawGroups
      .filter(g => g.accounts.length > 0)
      .map(g => {
        const subtotal = g.accounts.reduce((sum, a) => sum + (Number(a.signedBalance) || 0), 0)
        return { ...g, subtotal }
      })
  }, [accountsWithMeta])
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
      {/* TOP COMMAND BAR (CLEAN & UN-DUPLICATED) */}
      <div className={accStyles.commandBar}>
        <div className={accStyles.commandBarInfo}>
          <div className={accStyles.commandBarLabel}>Liquid Cash Assets</div>
          <div className={accStyles.commandBarBalance}>{money(liquidTotal)}</div>
        </div>

        {allocationSegments.length > 0 && (
          <div className={accStyles.commandBarAllocation}>
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
            <div className={accStyles.allocationLegendCompact}>
              {allocationSegments.map(seg => (
                <span key={seg.type} className={accStyles.allocationPillCompact}>
                  <span className={accStyles.allocationDot} style={{ background: seg.color }} />
                  {seg.type}: <strong>{seg.pct}%</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className={accStyles.commandBarActions}>
          <button
            type="button"
            className={accStyles.btnHeroSecondary}
            onClick={() => openQuickTransfer()}
            disabled={accounts.length === 0}
            title={accounts.length === 0 ? 'Add an account first' : 'Transfer funds'}
          >
            ⇄ Transfer
          </button>
          <button type="button" className={accStyles.btnHeroPrimary} onClick={openAdd}>
            + Add Account
          </button>
        </div>
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
        <div className={accStyles.groupsContainer}>
          {accountGroups.map(group => (
            <div key={group.id} className={accStyles.groupSection}>
              <div className={accStyles.groupHeader}>
                <div className={accStyles.groupTitleWrap}>
                  <span className={accStyles.groupIcon}>{group.icon}</span>
                  <div className={accStyles.groupText}>
                    <h3 className={accStyles.groupTitle}>{group.title}</h3>
                    <span className={accStyles.groupDesc}>{group.desc}</span>
                  </div>
                </div>
                <div className={accStyles.groupSubtotalBadge}>
                  <span className={accStyles.groupSubtotalLabel}>Subtotal</span>
                  <strong className={accStyles.groupSubtotalVal}>{money(group.subtotal)}</strong>
                </div>
              </div>

              <div className={accStyles.accountsGrid}>
                {group.accounts.map(account => (
                  <SwipeableCard
                    key={account._id}
                    onSwipeRight={() => (accounts.length >= 2 || holdings.length > 0) ? openQuickTransfer(account) : openQuickAdjust(account)}
                    rightLabel={(accounts.length >= 2 || holdings.length > 0) ? 'Transfer' : 'Adjust'}
                    rightIcon={(accounts.length >= 2 || holdings.length > 0) ? '⇄' : '⚡'}
                    rightTone="success"
                    onSwipeLeft={() => openEdit(account)}
                    leftLabel="Edit"
                    leftIcon="✎"
                    leftTone="amber"
                    onDoubleTap={() => openQuickAdjust(account)}
                  >
                    <div
                      className={accStyles.accountCard}
                      style={{ '--account-tone': account.tone }}
                    >
                      <div className={accStyles.accountCardMain}>
                        <div className={accStyles.accountLeading}>
                          <div className={accStyles.accountIcon} style={{ background: `color-mix(in srgb, ${account.tone} 18%, var(--surface2))` }}>
                            {ACCOUNT_ICONS[account.type] || '🏷'}
                          </div>
                          <div className={accStyles.accountInfo}>
                            <div className={accStyles.accountNameRow}>
                              <span className={accStyles.accountName}>{account.name}</span>
                              {account.share > 0 && (
                                <span className={accStyles.sharePill}>{account.share}%</span>
                              )}
                            </div>
                            <div className={accStyles.accountMeta}>
                              <span className={accStyles.typeDot} style={{ background: account.tone }} />
                              <span>{account.type}</span>
                              {account.notes && <span className={accStyles.accountNotes}>· “{account.notes}”</span>}
                            </div>
                          </div>
                        </div>

                        <div className={accStyles.accountTrailing}>
                          <div className={`${accStyles.accountBalance} ${account.isDebt ? accStyles.accountBalanceDebt : ''}`}>
                            {money(account.signedBalance)}
                          </div>
                          <span className={accStyles.accountBalanceSub}>Available</span>
                        </div>
                      </div>

                      {/* SLEEK CARD HOVER / QUICK ACTIONS BAR */}
                      <div className={accStyles.cardQuickActionsBar}>
                        <button
                          type="button"
                          className={accStyles.btnCardTransfer}
                          onClick={() => openQuickTransfer(account)}
                          disabled={accounts.length === 0}
                          title="Transfer funds"
                        >
                          ⇄ Transfer
                        </button>
                        <button
                          type="button"
                          className={accStyles.btnCardAction}
                          onClick={() => openQuickAdjust(account)}
                          title="Quick reconcile balance"
                        >
                          ⚡ Reconcile
                        </button>
                        <button
                          type="button"
                          className={accStyles.btnCardAction}
                          onClick={() => openEdit(account)}
                          title="Edit details"
                        >
                          ✎ Edit
                        </button>
                        <button
                          type="button"
                          className={accStyles.btnCardActionDanger}
                          onClick={() => handleDel(account._id, account.name)}
                          title="Delete account"
                          aria-label={`Delete ${account.name}`}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  </SwipeableCard>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      
      <QuickAdjustModal
        adjustTarget={adjustTarget}
        onClose={closeQuickAdjust}
        adjustNewBalance={adjustNewBalance}
        setAdjustNewBalance={setAdjustNewBalance}
        adjustLogToHistory={adjustLogToHistory}
        setAdjustLogToHistory={setAdjustLogToHistory}
        adjustSaving={adjustSaving}
        handleAdjustSubmit={handleAdjustSubmit}
        s={s}
        fmt={fmt}
        money={money}
      />

      <TransferModal
        showTransferModal={showTransferModal}
        onClose={closeQuickTransfer}
        transferForm={transferForm}
        setTransferForm={setTransferForm}
        transferSaving={transferSaving}
        handleTransferSubmit={handleTransferSubmit}
        swapTransferDirection={swapTransferDirection}
        accounts={accounts}
        holdings={holdings}
        cryptoPriceMap={cryptoPriceMap}
        vsCurrency={s === '$' ? 'USD' : 'PHP'}
        s={s}
        fmt={fmt}
      />

      <AccountEditorModal
        showModal={showModal}
        onClose={closeEditor}
        editAccount={editAccount}
        form={form}
        setField={setField}
        handleSaveAccount={handleSaveAccount}
        s={s}
      />
    </>
  )

  return hideHeader ? mainContent : <div className={styles.page}>{mainContent}</div>
}
