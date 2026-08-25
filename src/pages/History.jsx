import { useMemo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { fsDeleteTransaction, fsDeleteTransfer, fsSetTransactionPaymentStatus, fsUpdateTransaction } from '../lib/firestore'
import {
  getTakdaTransactionLifecycle,
  isTransactionPaid,
  TAKDA_BALANCE_IMPACT,
  TAKDA_TRANSACTION_STATUS,
} from '../lib/finance'
import {
  findPresetByLabel,
  getPresetByKey,
  getPresetGroups,
  getTransactionCategories,
  getTransactionSubcategories,
  sanitizeTransactionCategory,
  sanitizeTransactionSubcategory,
} from '../lib/transactionOptions'
import { confirmApp, confirmDeleteApp, notifyApp } from '../lib/appFeedback'
import { formatRecurringDateLabel, isRecurringRecordedOffDueDate } from '../lib/recurrence'
import { displayValue, fmt, formatDisplayDate, getMonthKey, maskMoney, RECUR_OPTIONS, today, validateAmount } from '../lib/utils'
import DetailsModal from '../components/DetailsModal'
import SwipeableCard from '../components/SwipeableCard'
import styles from './Page.module.css'
import hStyles from './History.module.css'

const ALL_CATS = ['All categories', ...new Set([...getTransactionCategories('income'), ...getTransactionCategories('expense')])]
const TYPES = ['All types', 'Income', 'Expense', 'Transfer']

const CAT_EMOJIS = {
  'Food & Dining': '🍔',
  'Transport': '🚗',
  'Shopping': '🛍️',
  'Health': '💊',
  'Entertainment': '🍿',
  'Personal Care': '✨',
  'Education': '📚',
  'Bills': '💡',
  'Salary': '💰',
  'Freelance': '💻',
  'Business': '🏢',
  'Investment': '📈',
  '13th Month': '🎁',
  'Bonus': '🎉',
  'Transfer': '⇄',
  'Other': '🏷️',
}

function getCategoryEmoji(cat, type) {
  if (type === 'transfer') return '⇄'
  return CAT_EMOJIS[cat] || (type === 'income' ? '💰' : '🏷️')
}

export default function History({ user, data, symbol, privacyMode = false, hideHeader = false }) {
  const s = symbol || '₱'
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('All types')
  const [filterCat, setFilterCat] = useState('All categories')
  const [filterMonth, setFilterMonth] = useState(() => getMonthKey(today()))
  const [sortBy, setSortBy] = useState('date-desc')
  const [showFilters, setShowFilters] = useState(false)
  const [editTx, setEditTx] = useState(null)
  const [editForm, setEditForm] = useState({ desc: '', amount: '', cat: '', subcat: '', presetKey: '', accountId: '', paymentStatus: 'paid' })
  const [detailsMode, setDetailsMode] = useState('')

  const hasActiveFilters = filterType !== 'All types' || filterCat !== 'All categories' || Boolean(filterMonth)
  const money = value => displayValue(privacyMode, fmt(value, s), maskMoney(s))

  // Lock background body scroll when edit modal or details modal is active
  useEffect(() => {
    if (editTx || detailsMode) {
      const prevBodyOverflow = document.body.style.overflow
      const prevHtmlOverflow = document.documentElement.style.overflow
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prevBodyOverflow
        document.documentElement.style.overflow = prevHtmlOverflow
      }
    }
  }, [editTx, detailsMode])

  const accountLookup = useMemo(
    () => Object.fromEntries((data.accounts || []).map(account => [account._id, account])),
    [data.accounts],
  )

  const allTx = useMemo(() => {
    const income = (data.income || []).map(tx => ({ ...tx, type: 'income' }))
    const expenses = (data.expenses || []).map(tx => ({ ...tx, type: 'expense' }))
    const transfers = (data.transfers || []).map(tx => ({ ...tx, type: 'transfer' }))
    return [...income, ...expenses, ...transfers]
  }, [data.expenses, data.income, data.transfers])

  const filtered = useMemo(() => {
    let list = allTx
    if (search.trim()) {
      const query = search.toLowerCase()
      list = list.filter(tx => (
        (tx.desc || '').toLowerCase().includes(query)
        || (tx.cat || '').toLowerCase().includes(query)
        || (tx.subcat || '').toLowerCase().includes(query)
      ))
    }
    if (filterType !== 'All types') list = list.filter(tx => tx.type === filterType.toLowerCase())
    if (filterCat !== 'All categories') list = list.filter(tx => tx.cat === filterCat)
    if (filterMonth) list = list.filter(tx => getMonthKey(tx.date) === filterMonth)

    return [...list].sort((a, b) => {
      if (sortBy === 'date-desc') return String(b.date || '').localeCompare(String(a.date || ''))
      if (sortBy === 'date-asc') return String(a.date || '').localeCompare(String(b.date || ''))
      if (sortBy === 'amount-desc') return (b.amount || 0) - (a.amount || 0)
      if (sortBy === 'amount-asc') return (a.amount || 0) - (b.amount || 0)
      return 0
    })
  }, [allTx, filterCat, filterMonth, filterType, search, sortBy])

  const grouped = useMemo(() => {
    const map = {}
    filtered.forEach(tx => {
      const key = tx.date || 'No date'
      if (!map[key]) map[key] = []
      map[key].push(tx)
    })
    return Object.entries(map).sort((a, b) => {
      if (sortBy === 'date-asc') return a[0].localeCompare(b[0])
      return b[0].localeCompare(a[0])
    })
  }, [filtered, sortBy])

  const paidFiltered = useMemo(() => filtered.filter(isTransactionPaid), [filtered])
  const totalIncome = paidFiltered.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + (tx.amount || 0), 0)
  const totalExpense = paidFiltered.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + (tx.amount || 0), 0)
  const net = totalIncome - totalExpense
  const transactionCountLabel = `${filtered.length} transaction${filtered.length === 1 ? '' : 's'}`
  const unpaidCount = filtered.length - paidFiltered.length
  const flowTotal = totalIncome + totalExpense
  const incomeShare = flowTotal > 0 ? Math.max(8, Math.min(100, Math.round((totalIncome / flowTotal) * 100))) : 0

  function clearFilters() {
    setFilterType('All types')
    setFilterCat('All categories')
    setFilterMonth(getMonthKey(today()))
    setSortBy('date-desc')
  }

  const detailsConfig = useMemo(() => {
    const close = () => setDetailsMode('')
    if (!detailsMode) return { open: false, title: '', subtitle: '', sections: [], close }

    const groupByDate = list => {
      const map = {}
      list.forEach(tx => {
        const key = tx.date || 'No date'
        if (!map[key]) map[key] = []
        map[key].push(tx)
      })
      return Object.entries(map).sort((a, b) => {
        if (sortBy === 'date-asc') return a[0].localeCompare(b[0])
        return b[0].localeCompare(a[0])
      })
    }

    const paidIncome = paidFiltered.filter(tx => tx.type === 'income')
    const paidExpenses = paidFiltered.filter(tx => tx.type === 'expense')
    const unpaid = filtered.filter(tx => !isTransactionPaid(tx))

    if (detailsMode === 'in-view') {
      return {
        open: true,
        title: 'Transactions in view',
        subtitle: unpaid.length
          ? `${filtered.length} total. ${unpaid.length} unpaid show here but do not affect totals.`
          : `${filtered.length} total in this view.`,
        sections: [
          { label: 'In view', list: groupByDate(filtered) },
        ],
        close,
      }
    }

    if (detailsMode === 'income') {
      return {
        open: true,
        title: 'Income details',
        subtitle: `${paidIncome.length} paid income entr${paidIncome.length === 1 ? 'y' : 'ies'} contributing to totals.`,
        sections: [
          { label: 'Paid income', list: groupByDate(paidIncome) },
        ],
        close,
      }
    }

    if (detailsMode === 'expenses') {
      return {
        open: true,
        title: 'Expense details',
        subtitle: `${paidExpenses.length} paid expense entr${paidExpenses.length === 1 ? 'y' : 'ies'} contributing to totals.`,
        sections: [
          { label: 'Paid expenses', list: groupByDate(paidExpenses) },
        ],
        close,
      }
    }

    return {
      open: true,
      title: 'Net breakdown',
      subtitle: `Net is ${net >= 0 ? 'positive' : 'negative'} in this view. Totals below include paid entries only.`,
      sections: [
        { label: 'Paid income', list: groupByDate(paidIncome) },
        { label: 'Paid expenses', list: groupByDate(paidExpenses) },
      ],
      close,
    }
  }, [detailsMode, filtered, net, paidFiltered, sortBy])

  async function handleDelete(tx) {
    if (tx.recurrenceSourceId && tx.recurrenceOccurrenceKey) {
      const scheduledCycleLabel = formatRecurringDateLabel(tx.recurrenceOccurrenceKey)
      const actualDateLabel = formatRecurringDateLabel(tx.date)
      const confirmed = await confirmApp({
        title: 'Delete settled recurring entry?',
        message: `${tx.desc || 'This entry'} is the real record for the ${scheduledCycleLabel} recurring cycle.${actualDateLabel && actualDateLabel !== scheduledCycleLabel ? ` It was recorded on ${actualDateLabel}.` : ''} Deleting it may let that forecast cycle appear again.`,
        confirmLabel: 'Delete entry',
        cancelLabel: 'Keep it',
        tone: 'danger',
      })
      if (!confirmed) return
    } else if (!(await confirmDeleteApp(tx.desc || 'this transfer'))) return

    if (tx.type === 'transfer') {
      await fsDeleteTransfer(user.uid, tx, data.accounts)
      notifyApp({ title: 'Transfer deleted', message: 'The transfer record has been removed and balances reversed.', tone: 'success' })
      return
    }

    const collection = tx.type === 'income' ? 'income' : 'expenses'
    await fsDeleteTransaction(user.uid, collection, tx, data.accounts)
  }

  function openEdit(tx) {
    const nextCat = sanitizeTransactionCategory(tx.type, tx.cat)
    const matchedPreset =
      getPresetByKey(tx.type, tx.presetKey || '')
      || findPresetByLabel(tx.type, tx.desc || '')
    const nextSubcat = sanitizeTransactionSubcategory(tx.type, nextCat, tx.subcat || matchedPreset?.subcat)
    setEditTx(tx)
    setEditForm({
      desc: tx.desc || '',
      amount: String(tx.amount || ''),
      cat: nextCat,
      subcat: nextSubcat,
      presetKey: matchedPreset && !matchedPreset.isCustom && matchedPreset.cat === nextCat && matchedPreset.subcat === nextSubcat ? matchedPreset.key : '',
      accountId: tx.accountId || '',
      paymentStatus: tx.paymentStatus || 'paid',
    })
  }

  async function handleSaveEdit() {
    const error = validateAmount(editForm.amount)
    if (error) {
      notifyApp({ title: 'Check amount', message: error, tone: 'warning' })
      return
    }
    if (!editForm.desc) {
      notifyApp({ title: 'Description needed', message: 'Add a description before saving this transaction.', tone: 'warning' })
      return
    }
    const collection = editTx.type === 'income' ? 'income' : 'expenses'
    await fsUpdateTransaction(user.uid, collection, editTx, {
      desc: editForm.desc,
      amount: parseFloat(editForm.amount),
      cat: editForm.cat,
      subcat: editForm.subcat,
      presetKey: editForm.presetKey || '',
      accountId: editForm.accountId,
      paymentStatus: editForm.paymentStatus,
      accountBalanceLinked: Boolean(editForm.accountId),
    }, data.accounts)
    setEditTx(null)
  }

  async function handleTogglePaymentStatus(tx) {
    const collection = tx.type === 'income' ? 'income' : 'expenses'
    const nextStatus = isTransactionPaid(tx) ? 'unpaid' : 'paid'
    try {
      await fsSetTransactionPaymentStatus(user.uid, collection, tx, nextStatus, data.accounts)
    } catch {
      notifyApp({
        title: 'Status not updated',
        message: 'Could not update this transaction right now. Try again.',
        tone: 'error',
      })
    }
  }

  const typeColor = { income: 'var(--income)', expense: 'var(--expense, #ef4444)', transfer: 'var(--blue, #3b82f6)' }
  const typeBg = { income: 'var(--income-dim)', expense: 'var(--expense-dim)', transfer: 'var(--border)' }
  const typeSign = { income: '+', expense: '−', transfer: '' }
  const editCats = editTx ? getTransactionCategories(editTx.type) : []
  const editSubcats = editTx ? getTransactionSubcategories(editTx.type, editForm.cat) : []
  const editPresetGroups = editTx ? getPresetGroups(editTx.type) : []
  const editSelectedPreset = editTx ? getPresetByKey(editTx.type, editForm.presetKey) : null

  function clearEditPreset() {
    if (!editTx) return
    const nextCat = 'Other'
    const nextSubcat = sanitizeTransactionSubcategory(editTx.type, nextCat, 'Miscellaneous')
    setEditForm(current => ({ ...current, presetKey: '', cat: nextCat, subcat: nextSubcat }))
  }

  function applyEditPreset(nextPresetKey) {
    if (!editTx) return
    const preset = getPresetByKey(editTx.type, nextPresetKey)
    if (!preset || preset.isCustom) {
      clearEditPreset()
      return
    }
    setEditForm(current => ({
      ...current,
      presetKey: preset.key,
      desc: preset.desc || preset.label,
      cat: preset.cat,
      subcat: preset.subcat,
    }))
  }

  function handleEditCategoryChange(value) {
    if (!editTx) return
    const nextCat = sanitizeTransactionCategory(editTx.type, value)
    const nextSubcat = getTransactionSubcategories(editTx.type, nextCat)[0]
    setEditForm(current => ({ ...current, presetKey: '', cat: nextCat, subcat: nextSubcat }))
  }

  function handleEditSubcategoryChange(value) {
    if (!editTx) return
    const nextSubcat = sanitizeTransactionSubcategory(editTx.type, editForm.cat, value)
    setEditForm(current => ({ ...current, presetKey: '', subcat: nextSubcat }))
  }

  const mainContent = (
    <div className={hStyles.historyPage}>
      {!hideHeader && (
        <div className={hStyles.heroSection}>
          <div className={hStyles.heroCopy}>
            <div className={hStyles.pageEyebrow}>History</div>
            <div className={hStyles.pageTitle}>Transaction Ledger</div>
            <div className={hStyles.pageSub}>
              Search, filter, and inspect your financial records.
            </div>
          </div>

          <div className={hStyles.heroAside}>
            <div className={hStyles.heroAsideLabel}>Scope</div>
            <div className={hStyles.heroAsideValue}>{transactionCountLabel}</div>
            <div className={hStyles.heroAsideTrack}>
              <div className={hStyles.heroAsideFill} style={{ width: `${incomeShare}%` }} />
            </div>
            <div className={hStyles.heroAsideMeta}>
              {unpaidCount > 0
                ? `${unpaidCount} unpaid entries visible.`
                : 'All entries accounted for.'}
            </div>
          </div>
        </div>
      )}

      {/* SUMMARY GRID CARDS */}
      <div className={hStyles.summaryGrid}>
        <button type="button" className={`${hStyles.summaryCard} ${hStyles.summaryCardButton}`} onClick={() => setDetailsMode('in-view')}>
          <div className={hStyles.summaryLabel}>In view</div>
          <div className={hStyles.summaryValue}>{filtered.length}</div>
          <div className={hStyles.summaryMeta}>{grouped.length} day group{grouped.length === 1 ? '' : 's'}</div>
        </button>
        <button type="button" className={`${hStyles.summaryCard} ${hStyles.summaryCardButton}`} onClick={() => setDetailsMode('income')}>
          <div className={hStyles.summaryLabel}>Income</div>
          <div className={`${hStyles.summaryValue} ${hStyles.summaryValueAccent}`}>
            {displayValue(privacyMode, `+${fmt(totalIncome, s)}`, `+${maskMoney(s)}`)}
          </div>
          <div className={hStyles.summaryMeta}>Paid income</div>
        </button>
        <button type="button" className={`${hStyles.summaryCard} ${hStyles.summaryCardButton}`} onClick={() => setDetailsMode('expenses')}>
          <div className={hStyles.summaryLabel}>Expenses</div>
          <div className={`${hStyles.summaryValue} ${hStyles.summaryValueRed}`}>
            {displayValue(privacyMode, `−${fmt(totalExpense, s)}`, `−${maskMoney(s)}`)}
          </div>
          <div className={hStyles.summaryMeta}>Paid spending</div>
        </button>
        <button type="button" className={`${hStyles.summaryCard} ${hStyles.summaryCardButton}`} onClick={() => setDetailsMode('net')}>
          <div className={hStyles.summaryLabel}>Net Flow</div>
          <div className={`${hStyles.summaryValue} ${net >= 0 ? hStyles.summaryValueBlue : hStyles.summaryValueRed}`}>
            {displayValue(privacyMode, `${net < 0 ? '−' : '+'}${fmt(Math.abs(net), s)}`, maskMoney(s))}
          </div>
          <div className={hStyles.summaryMeta}>{net >= 0 ? 'Surplus' : 'Deficit'}</div>
        </button>
      </div>

      {/* SEARCH & FILTERS BAR */}
      <div className={hStyles.searchShell}>
        <div className={hStyles.searchRow}>
          <div className={hStyles.searchInputWrap}>
            <span className={hStyles.searchIcon}>🔍</span>
            <input
              className={hStyles.searchInput}
              placeholder="Search note, category, or subcategory..."
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            {search && (
              <button type="button" className={hStyles.clearSearch} onClick={() => setSearch('')}>
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            className={`${hStyles.filterBtn} ${hasActiveFilters ? hStyles.filterBtnActive : ''}`}
            onClick={() => setShowFilters(value => !value)}
          >
            {hasActiveFilters ? '⚙️ Filters (Active)' : '⚙️ Filters'}
          </button>
        </div>

        {/* TYPE PILLS */}
        <div className={hStyles.typePillsRow}>
          {TYPES.map(t => {
            const isActive = filterType === t
            return (
              <button
                key={t}
                type="button"
                className={`${hStyles.typePill} ${isActive ? hStyles.typePillActive : ''}`}
                onClick={() => setFilterType(isActive && t !== 'All types' ? 'All types' : t)}
              >
                {t}
              </button>
            )
          })}
        </div>

        {/* EXPANDABLE FILTER DRAWER */}
        {showFilters && (
          <div className={hStyles.filterPanel}>
            <div className={hStyles.filterGrid}>
              <div className={hStyles.filterGroup}>
                <label>Category</label>
                <select value={filterCat} onChange={event => setFilterCat(event.target.value)}>
                  {ALL_CATS.map(cat => <option key={cat}>{cat}</option>)}
                </select>
              </div>
              <div className={hStyles.filterGroup}>
                <label>Month</label>
                <input
                  type="month"
                  value={filterMonth}
                  onChange={event => setFilterMonth(event.target.value || getMonthKey(today()))}
                />
              </div>
              <div className={hStyles.filterGroup}>
                <label>Sort by</label>
                <select value={sortBy} onChange={event => setSortBy(event.target.value)}>
                  <option value="date-desc">Newest first</option>
                  <option value="date-asc">Oldest first</option>
                  <option value="amount-desc">Highest amount</option>
                  <option value="amount-asc">Lowest amount</option>
                </select>
              </div>
            </div>
            {hasActiveFilters && (
              <button type="button" className={hStyles.clearFiltersBtn} onClick={clearFilters}>
                Reset all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* TRANSACTION LIST */}
      {!filtered.length ? (
        <div className={hStyles.emptyCard}>
          <div className={hStyles.emptyIcon}>📜</div>
          <div className={hStyles.emptyTitle}>
            {hasActiveFilters || search ? 'No entries match this view' : 'No transactions yet'}
          </div>
          <div className={hStyles.emptyBody}>
            {hasActiveFilters || search
              ? 'Clear your filters or adjust the search keyword to view other records.'
              : 'Record income or expenses using QuickAdd to populate your ledger.'}
          </div>
          {(hasActiveFilters || search) && (
            <button
              type="button"
              className={hStyles.clearFiltersBtn}
              onClick={() => { clearFilters(); setSearch('') }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        grouped.map(([date, txs]) => {
          const paidTxs = txs.filter(isTransactionPaid)
          const dayIncome = paidTxs.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + (tx.amount || 0), 0)
          const dayExpense = paidTxs.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + (tx.amount || 0), 0)
          const dayNet = dayIncome - dayExpense

          return (
            <div key={date} className={hStyles.dateGroup}>
              {/* DATE HEADER */}
              <div className={hStyles.dateHeader}>
                <div className={hStyles.dateHeaderLeft}>
                  <span className={hStyles.dateLabel}>{formatDisplayDate(date)}</span>
                  <span className={hStyles.dateCountBadge}>{txs.length}</span>
                </div>
                <span
                  className={hStyles.dateSummary}
                  style={{
                    color: dayNet > 0 ? 'var(--income)' : dayNet < 0 ? 'var(--expense, #ef4444)' : 'var(--text3)',
                  }}
                >
                  {displayValue(
                    privacyMode,
                    `${dayNet < 0 ? '−' : dayNet > 0 ? '+' : ''}${fmt(Math.abs(dayNet), s)}`,
                    maskMoney(s)
                  )}
                </span>
              </div>

              {/* DATE CARD */}
              <div className={hStyles.dateGroupCard}>
                {(txs || []).filter(Boolean).map((tx, index) => {
                  const isPaid = isTransactionPaid(tx)
                  const emoji = getCategoryEmoji(tx.cat, tx.type)
                  const acc = tx.accountId ? accountLookup[tx.accountId] : null

                  return (
                    <SwipeableCard
                      key={tx._id + index}
                      onSwipeRight={tx.type !== 'transfer' ? () => handleTogglePaymentStatus(tx) : () => openEdit(tx)}
                      rightLabel={tx.type !== 'transfer' ? (isPaid ? 'Unpaid' : 'Paid') : 'Edit'}
                      rightIcon={tx.type !== 'transfer' ? (isPaid ? '↺' : '✓') : '✎'}
                      rightTone={isPaid ? 'amber' : 'success'}
                      onSwipeLeft={() => handleDelete(tx)}
                      leftLabel="Delete"
                      leftIcon="✕"
                      leftTone="danger"
                      onDoubleTap={() => openEdit(tx)}
                    >
                      <div
                        className={`${hStyles.txRow} ${isPaid ? '' : hStyles.txRowUnpaid}`}
                        onClick={() => openEdit(tx)}
                      >
                        {/* 1. Leading Icon */}
                        <div
                          className={hStyles.txIcon}
                          style={{
                            background: typeBg[tx.type] || 'var(--surface2)',
                            color: typeColor[tx.type] || 'var(--text)',
                          }}
                        >
                          {emoji}
                        </div>

                        {/* 2. Middle Details */}
                        <div className={hStyles.txInfo}>
                          <div className={hStyles.txTitleRow}>
                            <span className={hStyles.txDesc}>
                              {tx.desc || tx.cat || 'Transaction'}
                            </span>
                            {tx.recur && <span className={hStyles.txRecurPill} title={`Recurring ${tx.recur}`}>🔄</span>}
                          </div>

                          <div className={hStyles.txMetaRow}>
                            <span className={hStyles.txCat}>
                              {tx.type === 'transfer'
                                ? `${tx.fromAccountName || 'Account'} → ${tx.toAccountName || 'Account'}`
                                : [tx.cat, tx.subcat].filter(Boolean).join(' · ')}
                            </span>
                            {acc && (
                              <span className={hStyles.txAccountPill}>
                                💳 {acc.name}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 3. Trailing Amount & Status */}
                        <div className={hStyles.txRight}>
                          <div
                            className={hStyles.txAmount}
                            style={{ color: typeColor[tx.type] || 'var(--text)' }}
                          >
                            {displayValue(
                              privacyMode,
                              `${tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : ''}${fmt(tx.amount, s)}`,
                              `${tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : ''}${maskMoney(s)}`
                            )}
                          </div>

                          <div className={hStyles.txStatusRow}>
                            {tx.type !== 'transfer' && (
                              <button
                                type="button"
                                className={`${hStyles.statusPill} ${isPaid ? hStyles.statusPillPaid : hStyles.statusPillUnpaid}`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleTogglePaymentStatus(tx)
                                }}
                                title="Click to toggle paid/unpaid status"
                              >
                                {isPaid ? 'Paid ✓' : 'Unpaid ⏳'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </SwipeableCard>
                  )
                })}
              </div>
            </div>
          )
        })
      )}

      {/* EDIT TRANSACTION MODAL */}
      {editTx && typeof document !== 'undefined' && createPortal(
        <div className={hStyles.modalOverlay} onClick={event => { if (event.target === event.currentTarget) setEditTx(null) }}>
          <div className={hStyles.modal}>
            <div className={hStyles.modalHeader}>
              <div>
                <div className={hStyles.modalEyebrow}>Record Details</div>
                <div className={hStyles.modalTitle}>Edit Transaction</div>
              </div>
              <button onClick={() => setEditTx(null)} className={hStyles.modalClose}>✕</button>
            </div>

            <div className={hStyles.modalBody}>
              <div className={styles.formGroup}>
                <label className={hStyles.fieldLabel}>Description</label>
                <input
                  className={hStyles.fieldInput}
                  value={editForm.desc}
                  onChange={e => setEditForm(f => ({ ...f, desc: e.target.value }))}
                  placeholder="Note or merchant"
                  autoFocus
                />
              </div>

              <div className={styles.formRowTwoCol}>
                <div className={styles.formGroup}>
                  <label className={hStyles.fieldLabel}>Amount ({s})</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className={hStyles.fieldInputBig}
                    value={editForm.amount}
                    onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={hStyles.fieldLabel}>Payment Status</label>
                  <select
                    className={hStyles.fieldInput}
                    value={editForm.paymentStatus}
                    onChange={e => setEditForm(f => ({ ...f, paymentStatus: e.target.value }))}
                  >
                    <option value="paid">Paid ✓</option>
                    <option value="unpaid">Unpaid ⏳</option>
                  </select>
                </div>
              </div>

              <div className={styles.formRowTwoCol}>
                <div className={styles.formGroup}>
                  <label className={hStyles.fieldLabel}>Category</label>
                  <select
                    className={hStyles.fieldInput}
                    value={editForm.cat}
                    onChange={e => handleEditCategoryChange(e.target.value)}
                  >
                    {editCats.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={hStyles.fieldLabel}>Subcategory</label>
                  <select
                    className={hStyles.fieldInput}
                    value={editForm.subcat}
                    onChange={e => handleEditSubcategoryChange(e.target.value)}
                  >
                    {editSubcats.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={hStyles.fieldLabel}>Account</label>
                <select
                  className={hStyles.fieldInput}
                  value={editForm.accountId}
                  onChange={e => setEditForm(f => ({ ...f, accountId: e.target.value }))}
                >
                  <option value="">No account (Virtual ledger only)</option>
                  {(data.accounts || []).map(acc => (
                    <option key={acc._id} value={acc._id}>
                      {acc.name} ({acc.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className={hStyles.modalActions}>
                <button
                  type="button"
                  className={hStyles.btnDeleteModal}
                  onClick={() => {
                    setEditTx(null)
                    handleDelete(editTx)
                  }}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className={hStyles.btnSaveModal}
                  onClick={handleSaveEdit}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* DETAILS MODAL */}
      <DetailsModal
        open={detailsConfig.open}
        title={detailsConfig.title}
        subtitle={detailsConfig.subtitle}
        sections={detailsConfig.sections}
        onClose={detailsConfig.close}
        symbol={s}
        privacyMode={privacyMode}
      />
    </div>
  )

  return hideHeader ? mainContent : <div className={styles.page}>{mainContent}</div>
}
