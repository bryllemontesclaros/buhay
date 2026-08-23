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
import { displayValue, fmt, getMonthKey, maskMoney, RECUR_OPTIONS, today, validateAmount } from '../lib/utils'
import DetailsModal from '../components/DetailsModal'
import SwipeableCard from '../components/SwipeableCard'
import styles from './Page.module.css'
import hStyles from './History.module.css'

const ALL_CATS = ['All categories', ...new Set([...getTransactionCategories('income'), ...getTransactionCategories('expense')])]
const TYPES = ['All types', 'Income', 'Expense', 'Transfer']
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
    const income = data.income.map(tx => ({ ...tx, type: 'income' }))
    const expenses = data.expenses.map(tx => ({ ...tx, type: 'expense' }))
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

  const typeColor = { income: 'var(--income)', expense: 'var(--expense)', transfer: 'var(--text2)' }
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
    <>
      {!hideHeader && (
        <div className={hStyles.heroSection}>
          <div className={hStyles.heroCopy}>
            <div className={hStyles.pageEyebrow}>History</div>
            <div className={hStyles.pageTitle}>Keep the ledger easy to review.</div>
            <div className={hStyles.pageSub}>
              Search, filter, edit, and clean up entries from one place so reports, forecasts, and balances stay understandable.
            </div>
          </div>

          <div className={hStyles.heroAside}>
            <div className={hStyles.heroAsideLabel}>View scope</div>
            <div className={hStyles.heroAsideValue}>{transactionCountLabel}</div>
            <div className={hStyles.heroAsideTrack}>
              <div className={hStyles.heroAsideFill} style={{ width: `${incomeShare}%` }} />
            </div>
            <div className={hStyles.heroAsideMeta}>
              {unpaidCount > 0
                ? `${unpaidCount} unpaid entr${unpaidCount === 1 ? 'y stays' : 'ies stay'} visible, but totals only count paid ones.`
                : hasActiveFilters || search
                  ? 'Filters are shaping this view.'
                  : 'Showing all recorded transaction activity.'}
            </div>
          </div>
        </div>
      )}

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
          <div className={hStyles.summaryMeta}>Paid income entries in this view</div>
        </button>
        <button type="button" className={`${hStyles.summaryCard} ${hStyles.summaryCardButton}`} onClick={() => setDetailsMode('expenses')}>
          <div className={hStyles.summaryLabel}>Expenses</div>
          <div className={`${hStyles.summaryValue} ${hStyles.summaryValueRed}`}>
            {displayValue(privacyMode, `−${fmt(totalExpense, s)}`, `−${maskMoney(s)}`)}
          </div>
          <div className={hStyles.summaryMeta}>Paid spending in this view</div>
        </button>
        <button type="button" className={`${hStyles.summaryCard} ${hStyles.summaryCardButton}`} onClick={() => setDetailsMode('net')}>
          <div className={hStyles.summaryLabel}>Net</div>
          <div className={`${hStyles.summaryValue} ${net >= 0 ? hStyles.summaryValueBlue : hStyles.summaryValueRed}`}>
            {displayValue(privacyMode, `${net >= 0 ? '+' : ''}${fmt(net, s)}`, `${net >= 0 ? '+' : ''}${maskMoney(s)}`)}
          </div>
          <div className={hStyles.summaryMeta}>{net >= 0 ? 'Net result is positive in this view' : 'Net result is negative in this view'}</div>
        </button>
      </div>



      <div className={hStyles.searchShell}>
        <div className={hStyles.searchRow}>
          <input className={hStyles.searchInput} placeholder="Search note, category, or subcategory" value={search} onChange={event => setSearch(event.target.value)} />
          {search && <button type="button" className={hStyles.clearSearch} onClick={() => setSearch('')}>✕</button>}
          <button type="button" className={`${hStyles.filterBtn} ${hasActiveFilters ? hStyles.filterBtnActive : ''}`} onClick={() => setShowFilters(value => !value)}>
            {hasActiveFilters ? 'Filters on' : 'Filters'}
          </button>
        </div>

        <div className={hStyles.typePillsRow}>
          {TYPES.map(t => {
            const isActive = filterType === t
            return (
              <button
                key={t}
                type="button"
                className={`${hStyles.typePill} ${isActive ? hStyles.typePillActive : ''}`}
                onClick={() => setFilterType(isActive ? 'All types' : t)}
              >
                {t}
              </button>
            )
          })}
        </div>

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
                <input type="month" value={filterMonth} onChange={event => setFilterMonth(event.target.value || getMonthKey(today()))} />
              </div>
              <div className={hStyles.filterGroup} style={{ gridColumn: 'span 2' }}>
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
              <button type="button" className={hStyles.clearFiltersBtn} onClick={clearFilters}>Clear all filters</button>
            )}
          </div>
        )}
      </div>

      {!filtered.length ? (
        <div className={hStyles.emptyCard}>
          <div className={hStyles.emptyTitle}>
            {hasActiveFilters || search ? 'No entries match this view' : 'No transactions yet'}
          </div>
          <div className={hStyles.emptyBody}>
            {hasActiveFilters || search
              ? 'Clear the filters or widen the search to bring more entries back into view.'
              : 'Add your first income or expense and this page becomes your running ledger.'}
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
      ) : grouped.map(([date, txs]) => {
        const paidTxs = txs.filter(isTransactionPaid)
        const dayIncome = paidTxs.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + (tx.amount || 0), 0)
        const dayExpense = paidTxs.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + (tx.amount || 0), 0)
        const dayNet = dayIncome - dayExpense

        return (
          <div key={date} className={hStyles.dateGroup}>
            <div className={hStyles.dateHeader}>
              <span className={hStyles.dateLabel}>{date}</span>
              <span className={hStyles.dateSummary} style={{ color: dayNet >= 0 ? 'var(--accent)' : 'var(--red)' }}>
                {displayValue(privacyMode, `${dayNet >= 0 ? '+' : ''}${fmt(dayNet, s)}`, `${dayNet >= 0 ? '+' : ''}${maskMoney(s)}`)}
              </span>
            </div>
            <div className={hStyles.dateGroupCard}>
              {(txs || []).filter(Boolean).map((tx, index) => {
                const lifecycle = getTakdaTransactionLifecycle(tx || {}, today())
                const recurrenceCycleLabel = tx?.recurrenceOccurrenceKey ? formatRecurringDateLabel(tx.recurrenceOccurrenceKey) : ''
                const recordedEarly = isRecurringRecordedOffDueDate(tx || {})
                const impactClassName = {
                  [TAKDA_BALANCE_IMPACT.NONE]: hStyles.impactOff,
                  [TAKDA_BALANCE_IMPACT.IN_ACCOUNT]: hStyles.impactOn,
                  [TAKDA_BALANCE_IMPACT.DUE_TO_SYNC]: hStyles.impactDue,
                  [TAKDA_BALANCE_IMPACT.APPLIES_ON_DATE]: hStyles.impactFuture,
                  [TAKDA_BALANCE_IMPACT.LINKED]: hStyles.impactLinked,
                  [TAKDA_BALANCE_IMPACT.REFERENCE_ONLY]: hStyles.impactLinked,
                  [TAKDA_BALANCE_IMPACT.LEDGER_ONLY]: hStyles.impactLinked,
                }[lifecycle.balanceImpactKey]
                const statusClassName = lifecycle.statusKey === TAKDA_TRANSACTION_STATUS.PAID
                  ? hStyles.statusPaid
                  : hStyles.statusUnpaid

                return (
                  <SwipeableCard
                    key={tx._id + index}
                    onSwipeRight={tx.type !== 'transfer' ? () => handleTogglePaymentStatus(tx) : () => openEdit(tx)}
                    rightLabel={tx.type !== 'transfer' ? (isTransactionPaid(tx) ? 'Unpaid' : 'Paid') : 'Edit'}
                    rightIcon={tx.type !== 'transfer' ? (isTransactionPaid(tx) ? '↺' : '✓') : '✎'}
                    rightTone={isTransactionPaid(tx) ? 'amber' : 'success'}
                    onSwipeLeft={() => handleDelete(tx)}
                    leftLabel="Delete"
                    leftIcon="✕"
                    leftTone="danger"
                    onDoubleTap={tx.type !== 'transfer' ? () => openEdit(tx) : null}
                    style={{ borderRadius: 0 }}
                  >
                    <div className={`${hStyles.txRow} ${isTransactionPaid(tx) ? '' : hStyles.txRowUnpaid}`}>
                      <div className={hStyles.txIcon} style={{ background: typeBg[tx.type], color: typeColor[tx.type] }}>
                        {typeSign[tx.type]}
                      </div>
                      <div className={hStyles.txInfo}>
                        <div className={hStyles.txDesc}>{tx.desc}</div>
                        <div className={hStyles.txMeta}>
                          {tx.type === 'transfer' ? (
                            <span className={hStyles.txCat}>Transfer: {tx.fromAccountName} → {tx.toAccountName}</span>
                          ) : (
                            <span className={hStyles.txCat}>{[tx.cat, tx.subcat].filter(Boolean).join(' · ')}</span>
                          )}
                          <span className={`${hStyles.statusBadge} ${statusClassName}`}>
                            {lifecycle.statusLabel}
                          </span>
                          {lifecycle.balanceImpactLabel && (
                            <span className={`${hStyles.statusBadge} ${hStyles.impactBadge} ${impactClassName}`}>
                              {lifecycle.balanceImpactLabel}
                            </span>
                          )}
                          {tx.accountId && <span className={hStyles.txAccount}>{accountLookup[tx.accountId]?.name || 'Missing account'}</span>}
                          {tx.recur && (
                            <span className={hStyles.txRecur}>{RECUR_OPTIONS.find(option => option.value === tx.recur)?.label || tx.recur}</span>
                          )}
                          {recurrenceCycleLabel && (
                            <span className={`${hStyles.statusBadge} ${hStyles.recurringCycleBadge}`}>
                              Cycle {recurrenceCycleLabel}
                            </span>
                          )}
                          {recordedEarly && (
                            <span className={`${hStyles.statusBadge} ${hStyles.recurringEarlyBadge}`}>
                              Recorded off due date
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={hStyles.txRight}>
                        <div className={hStyles.txAmount} style={{ color: typeColor[tx.type] }}>
                          {displayValue(privacyMode, `${typeSign[tx.type]}${fmt(tx.amount, s)}`, `${typeSign[tx.type]}${maskMoney(s)}`)}
                        </div>
                        <div className={hStyles.txActions}>
                          {tx.type !== 'transfer' && (
                            <>
                              <button
                                type="button"
                                className={`${hStyles.statusBtn} ${isTransactionPaid(tx) ? hStyles.statusBtnPaid : hStyles.statusBtnUnpaid}`}
                                onClick={() => handleTogglePaymentStatus(tx)}
                              >
                                {isTransactionPaid(tx) ? 'Paid' : 'Unpaid'}
                              </button>
                              <button type="button" className={hStyles.editBtn} onClick={() => openEdit(tx)}>Edit</button>
                            </>
                          )}
                          <button type="button" className={hStyles.delBtn} onClick={() => handleDelete(tx)}>Delete</button>
                        </div>
                      </div>
                    </div>
                  </SwipeableCard>
                )
              })}
            </div>
          </div>
        )
      })}

      {editTx && typeof document !== 'undefined' && createPortal(
        <div className={hStyles.modalOverlay} onClick={event => { if (event.target === event.currentTarget) setEditTx(null) }}>
          <div className={hStyles.modal}>
            <div className={hStyles.modalHeader}>
              <div className={hStyles.modalTitle}>Edit transaction</div>
              <button onClick={() => setEditTx(null)} className={hStyles.modalClose}>✕</button>
            </div>
            <div className={styles.formGroup} style={{ marginBottom: 12 }}>
              <label>Description</label>
              <input value={editForm.desc} onChange={event => setEditForm(current => ({ ...current, desc: event.target.value }))} placeholder="Merchant, payer, or note" />
            </div>
            <div className={styles.formGroup} style={{ marginBottom: 12 }}>
              <label>Preset</label>
              <select value={editForm.presetKey || 'other-custom'} onChange={event => {
                if (event.target.value === 'other-custom') clearEditPreset()
                else applyEditPreset(event.target.value)
              }}>
                {editPresetGroups.map(group => (
                  <optgroup key={group.label} label={group.label}>
                    {group.items.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
                  </optgroup>
                ))}
                <option value="other-custom">Other / custom</option>
              </select>
              <div className={styles.helper} style={{ marginTop: 8 }}>
                {editSelectedPreset
                  ? `${editSelectedPreset.label} maps to ${editSelectedPreset.cat} → ${editSelectedPreset.subcat}.`
                  : 'No preset selected. This transaction will stay as a custom entry.'}
              </div>
            </div>
            <div className={`${styles.formRow} ${styles.col2}`} style={{ marginBottom: 12 }}>
              <div className={styles.formGroup}>
                <label>Amount ({s})</label>
                <input type="number" min="0" value={editForm.amount} onChange={event => setEditForm(current => ({ ...current, amount: event.target.value }))} />
              </div>
              <div className={styles.formGroup}>
                <label>Category</label>
                <select value={editForm.cat} onChange={event => handleEditCategoryChange(event.target.value)}>
                  {editCats.map(cat => <option key={cat}>{cat}</option>)}
                </select>
              </div>
            </div>
            <div className={styles.formGroup} style={{ marginBottom: 12 }}>
              <label>Subcategory</label>
              <select value={editForm.subcat} onChange={event => handleEditSubcategoryChange(event.target.value)}>
                {editSubcats.map(subcat => <option key={subcat}>{subcat}</option>)}
              </select>
            </div>
            <div className={styles.formGroup} style={{ marginBottom: 12 }}>
              <label>Account</label>
              <select value={editForm.accountId} onChange={event => setEditForm(current => ({ ...current, accountId: event.target.value }))}>
                <option value="">No account selected</option>
                {data.accounts.map(account => (
                  <option key={account._id} value={account._id}>
                    {account.name} · {account.type}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup} style={{ marginBottom: 12 }}>
              <label>Payment status</label>
              <select value={editForm.paymentStatus} onChange={event => setEditForm(current => ({ ...current, paymentStatus: event.target.value }))}>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
            {editTx && !editTx.accountBalanceLinked && editForm.accountId && (
              <div className={hStyles.accountNote}>
                Older unlinked entries can store an account here for reference, but they do not rewrite today&apos;s balances automatically.
              </div>
            )}
            {editForm.paymentStatus === 'unpaid' && (
              <div className={hStyles.accountNote}>
                Unpaid transactions stay visible in History, but they do not affect balances or totals until you mark them paid.
              </div>
            )}
            {editTx?.recurrenceOccurrenceKey && (
              <div className={hStyles.accountNote}>
                This entry settles the {formatRecurringDateLabel(editTx.recurrenceOccurrenceKey)} recurring cycle.
                {editTx.date && editTx.date !== editTx.recurrenceOccurrenceKey ? ` It was recorded on ${formatRecurringDateLabel(editTx.date)} instead of the scheduled date.` : ''}
                {' '}Editing keeps that cycle settled. Deleting it can let the forecast cycle appear again.
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditTx(null)} className={hStyles.btnCancel}>Cancel</button>
              <button onClick={handleSaveEdit} className={styles.btnAdd} style={{ flex: 2 }}>Save changes</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <DetailsModal
        open={detailsConfig.open}
        title={detailsConfig.title}
        subtitle={detailsConfig.subtitle}
        onClose={detailsConfig.close}
      >
        <div className={hStyles.detailsPills}>
          <span className={hStyles.detailsPill}>Paid totals only</span>
          {filtered.length !== paidFiltered.length ? (
            <span className={hStyles.detailsPillMuted}>{filtered.length - paidFiltered.length} unpaid excluded</span>
          ) : (
            <span className={hStyles.detailsPillMuted}>All paid</span>
          )}
        </div>

        {detailsConfig.sections.map(section => (
          <div key={section.label} className={hStyles.detailsSection}>
            <div className={hStyles.detailsSectionHeader}>
              <div className={hStyles.detailsSectionTitle}>{section.label}</div>
            </div>
            {!section.list.length ? (
              <div className={hStyles.detailsEmpty}>Nothing to show yet.</div>
            ) : (
              <div className={hStyles.detailsList}>
                {section.list.map(([day, list]) => (
                  <div key={day} className={hStyles.detailsDay}>
                    <div className={hStyles.detailsDayLabel}>{day}</div>
                    {list.map((tx, index) => {
                      const recurrenceCycleLabel = tx.recurrenceOccurrenceKey ? formatRecurringDateLabel(tx.recurrenceOccurrenceKey) : ''
                      const recordedEarly = isRecurringRecordedOffDueDate(tx)
                      return (
                      <div key={(tx._id || tx.id || 'tx') + index} className={`${hStyles.detailsRow} ${isTransactionPaid(tx) ? '' : hStyles.detailsRowUnpaid}`}>
                        <div className={hStyles.detailsRowMain}>
                          <div className={hStyles.detailsRowDesc}>{tx.desc || 'Untitled'}</div>
                          <div className={hStyles.detailsRowMeta}>
                            <span>{[tx.cat, tx.subcat].filter(Boolean).join(' · ') || 'Other'}</span>
                            {tx.accountId ? <span>· {accountLookup[tx.accountId]?.name || 'Missing account'}</span> : null}
                            {!isTransactionPaid(tx) ? <span className={hStyles.detailsBadge}>Unpaid</span> : null}
                            {recurrenceCycleLabel ? <span className={`${hStyles.detailsBadge} ${hStyles.detailsCycleBadge}`}>Cycle {recurrenceCycleLabel}</span> : null}
                            {recordedEarly ? <span className={`${hStyles.detailsBadge} ${hStyles.detailsCycleEarlyBadge}`}>Recorded off due date</span> : null}
                          </div>
                        </div>
                        <div className={hStyles.detailsRowAmount} style={{ color: typeColor[tx.type] }}>
                          {displayValue(privacyMode, `${typeSign[tx.type]}${fmt(tx.amount, s)}`, `${typeSign[tx.type]}${maskMoney(s)}`)}
                        </div>
                      </div>
                    )})}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </DetailsModal>
    </>
  )

  return hideHeader ? mainContent : <div className={`${styles.page} ${hStyles.historyPage}`}>{mainContent}</div>
}
