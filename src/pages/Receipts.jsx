import { useEffect, useMemo, useRef, useState } from 'react'
import { fsDeleteReceipt, fsSaveReceipt } from '../lib/firestore'
import { loadStorageObjectUrl } from '../lib/storageMedia'
import { confirmDeleteApp } from '../lib/appFeedback'
import {
  CURRENCIES,
  displayValue,
  fmt,
  formatDisplayDate,
  getCurrencySymbol,
  getMonthKey,
  normalizeDate,
  maskMoney,
  today,
} from '../lib/utils'
import styles from './Page.module.css'
import receiptStyles from './Receipts.module.css'

const RANGE_OPTIONS = [
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
]

const MANUAL_RECEIPT_CATEGORIES = [
  'Groceries',
  'Food & Dining',
  'Transport',
  'Shopping',
  'Bills',
  'Health',
  'Other',
]

function createManualReceiptDraft(currency = 'PHP') {
  return {
    merchant: '',
    total: '',
    date: today(),
    currency: currency || 'PHP',
    category: 'Other',
    reference: '',
    notes: '',
  }
}

function formatSavedAt(value) {
  if (!value) return 'Just now'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Saved recently'

  return parsed.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function DraftBanner({ message }) {
  if (!message?.text) return null

  return (
    <div
      className={`${receiptStyles.statusBanner} ${message.ok ? receiptStyles.statusBannerOk : receiptStyles.statusBannerWarn}`}
      role={message.ok ? 'status' : 'alert'}
      aria-live={message.ok ? 'polite' : 'assertive'}
    >
      {message.text}
    </div>
  )
}

function getConfidenceTone(level = 'none') {
  if (level === 'high') return 'high'
  if (level === 'medium') return 'medium'
  if (level === 'low') return 'low'
  return 'none'
}

function formatConfidenceLabel(level = 'none') {
  if (!level || level === 'none') return 'Needs review'
  return `${level.charAt(0).toUpperCase()}${level.slice(1)} confidence`
}

function getConfidenceClassName(level = 'none') {
  const tone = getConfidenceTone(level)
  return `confidence${tone.charAt(0).toUpperCase()}${tone.slice(1)}`
}

function getReceiptCurrencyCode(receipt, fallback = 'PHP') {
  return receipt?.currency || receipt?.extractedData?.currency || fallback
}

function getReceiptLineItems(receipt) {
  return Array.isArray(receipt?.lineItems)
    ? receipt.lineItems
    : (Array.isArray(receipt?.extractedData?.lineItems) ? receipt.extractedData.lineItems : [])
}

function getReceiptDateTimestamp(receipt) {
  const normalized = normalizeDate(receipt?.date)
  if (normalized) {
    const parsed = new Date(`${normalized}T00:00:00`)
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime()
  }

  const createdAt = Number(receipt?.createdAt) || 0
  return Number.isFinite(createdAt) ? createdAt : 0
}

function revokeObjectUrl(value = '') {
  if (typeof value === 'string' && value.startsWith('blob:')) {
    URL.revokeObjectURL(value)
  }
}

function getReceiptPreviewPath(receipt) {
  return receipt?.cleanedImagePath || receipt?.imagePath || ''
}

function getReceiptFallbackImageUrl(receipt) {
  return receipt?.thumbnailUrl || receipt?.cleanedImageUrl || receipt?.imageUrl || ''
}

function matchesReceiptSearch(receipt, query) {
  const normalizedQuery = String(query || '').trim().toLowerCase()
  if (!normalizedQuery) return true

  const lineItems = getReceiptLineItems(receipt)
    .map(item => [item?.name, item?.qty, item?.price, item?.lineTotal].filter(Boolean).join(' '))
    .join(' ')

  const haystack = [
    receipt?.merchant,
    receipt?.reference,
    receipt?.category,
    receipt?.notes,
    receipt?.currency,
    receipt?.rawTextPreview,
    lineItems,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(normalizedQuery)
}

function buildTrendSeries(receipts = [], months = 6) {
  const now = new Date()
  const series = []
  const grouped = new Map()

  for (let index = months - 1; index >= 0; index -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - index, 1)
    const key = getMonthKey(monthDate)
    grouped.set(key, {
      key,
      label: monthDate.toLocaleDateString('en-PH', { month: 'short' }),
      total: 0,
      count: 0,
    })
    series.push(key)
  }

  receipts.forEach(receipt => {
    const monthKey = getMonthKey(receipt?.date || receipt?.createdAt)
    const target = grouped.get(monthKey)
    if (!target) return
    target.total += Number(receipt?.total) || 0
    target.count += 1
  })

  return series.map(key => grouped.get(key))
}

function getPercent(value, max, minimum = 8) {
  if (!max || max <= 0) return minimum
  return Math.max(minimum, Math.min(100, (value / max) * 100))
}

export default function Receipts({ user, data, profile = {}, privacyMode = false }) {
  const [deleteId, setDeleteId] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [message, setMessage] = useState({ text: '', ok: true })
  const [draft, setDraft] = useState(() => createManualReceiptDraft(profile.currency || 'PHP'))
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [range, setRange] = useState('all')
  const [currencyFilter, setCurrencyFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [receiptImageUrls, setReceiptImageUrls] = useState({})
  const receiptImageUrlsRef = useRef({})

  const receipts = useMemo(() => (
    [...(Array.isArray(data.receipts) ? data.receipts : [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  ), [data.receipts])
  const currentMonthKey = getMonthKey(new Date())
  const currentYear = new Date().getFullYear()

  const receiptCurrencyOptions = useMemo(() => {
    const available = new Set([profile.currency || 'PHP'])
    receipts.forEach(receipt => {
      available.add(getReceiptCurrencyCode(receipt, profile.currency || 'PHP'))
    })
    return [...available].filter(Boolean)
  }, [profile.currency, receipts])

  const categoryOptions = useMemo(() => {
    const available = new Set(['Other'])
    receipts.forEach(receipt => {
      available.add(String(receipt.category || 'Other'))
    })
    return [...available].filter(Boolean).sort((a, b) => a.localeCompare(b))
  }, [receipts])

  const manualCategoryOptions = useMemo(() => {
    const available = new Set(MANUAL_RECEIPT_CATEGORIES)
    categoryOptions.forEach(option => available.add(option))
    return [...available].filter(Boolean).sort((a, b) => a.localeCompare(b))
  }, [categoryOptions])

  const filteredReceipts = useMemo(() => {
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000

    return receipts.filter(receipt => {
      const receiptCurrency = getReceiptCurrencyCode(receipt, profile.currency || 'PHP')
      const receiptCategory = String(receipt.category || 'Other')
      const receiptDateValue = getReceiptDateTimestamp(receipt)
      const receiptDate = receiptDateValue ? new Date(receiptDateValue) : null

      if (range === '30d' && (!receiptDateValue || receiptDateValue < now - (30 * dayMs))) return false
      if (range === '90d' && (!receiptDateValue || receiptDateValue < now - (90 * dayMs))) return false
      if (range === 'year' && (!receiptDate || Number.isNaN(receiptDate.getTime()) || receiptDate.getFullYear() !== currentYear)) return false
      if (currencyFilter !== 'all' && receiptCurrency !== currencyFilter) return false
      if (categoryFilter !== 'all' && receiptCategory !== categoryFilter) return false
      if (!matchesReceiptSearch(receipt, searchQuery)) return false
      return true
    })
  }, [categoryFilter, currencyFilter, currentYear, profile.currency, range, receipts, searchQuery])

  useEffect(() => {
    if (!filteredReceipts.length) {
      setSelectedId('')
      return
    }

    if (!selectedId || !filteredReceipts.some(receipt => receipt._id === selectedId)) {
      setSelectedId(filteredReceipts[0]._id)
    }
  }, [filteredReceipts, selectedId])

  useEffect(() => {
    receiptImageUrlsRef.current = receiptImageUrls
  }, [receiptImageUrls])

  useEffect(() => {
    return () => {
      Object.values(receiptImageUrlsRef.current).forEach(revokeObjectUrl)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const visibleIds = new Set(filteredReceipts.map(receipt => receipt._id))

    setReceiptImageUrls(current => {
      let changed = false
      const next = {}
      Object.entries(current).forEach(([id, value]) => {
        if (visibleIds.has(id)) {
          next[id] = value
        } else {
          changed = true
          revokeObjectUrl(value)
        }
      })
      return changed ? next : current
    })

    filteredReceipts.forEach(receipt => {
      const path = getReceiptPreviewPath(receipt)
      if (!path || receiptImageUrlsRef.current[receipt._id]) return

      loadStorageObjectUrl(path)
        .then(url => {
          if (cancelled) {
            revokeObjectUrl(url)
            return
          }

          setReceiptImageUrls(current => {
            if (current[receipt._id]) {
              revokeObjectUrl(url)
              return current
            }
            return { ...current, [receipt._id]: url }
          })
        })
        .catch(() => {})
    })

    return () => {
      cancelled = true
    }
  }, [filteredReceipts])

  const selectedReceipt = filteredReceipts.find(receipt => receipt._id === selectedId) || filteredReceipts[0] || null
  const selectedReceiptImageUrl = selectedReceipt
    ? (receiptImageUrls[selectedReceipt._id] || getReceiptFallbackImageUrl(selectedReceipt))
    : ''
  const selectedReceiptHasImage = Boolean(selectedReceiptImageUrl || getReceiptPreviewPath(selectedReceipt))
  const selectedConfidence = selectedReceipt?.confidence || selectedReceipt?.extractedData?.confidence || null
  const selectedLineItems = getReceiptLineItems(selectedReceipt)

  const allStats = useMemo(() => {
    const merchants = new Set()
    const currencies = new Set()
    let monthCount = 0

    receipts.forEach(receipt => {
      if (receipt.merchant) merchants.add(receipt.merchant.trim().toLowerCase())
      if (getReceiptCurrencyCode(receipt, profile.currency || 'PHP')) currencies.add(getReceiptCurrencyCode(receipt, profile.currency || 'PHP'))
      if (getMonthKey(receipt.date) === currentMonthKey) monthCount += 1
    })

    return {
      total: receipts.length,
      monthCount,
      merchants: merchants.size,
      currencies: currencies.size,
    }
  }, [currentMonthKey, profile.currency, receipts])

  const viewStats = useMemo(() => {
    const merchants = new Set()
    const currencies = new Set()
    let monthCount = 0

    filteredReceipts.forEach(receipt => {
      if (receipt.merchant) merchants.add(receipt.merchant.trim().toLowerCase())
      if (getReceiptCurrencyCode(receipt, profile.currency || 'PHP')) currencies.add(getReceiptCurrencyCode(receipt, profile.currency || 'PHP'))
      if (getMonthKey(receipt.date) === currentMonthKey) monthCount += 1
    })

    return {
      total: filteredReceipts.length,
      monthCount,
      merchants: merchants.size,
      currencies: currencies.size,
    }
  }, [currentMonthKey, filteredReceipts, profile.currency])

  const currenciesInView = useMemo(() => {
    const grouped = new Map()

    filteredReceipts.forEach(receipt => {
      const currency = getReceiptCurrencyCode(receipt, profile.currency || 'PHP')
      const current = grouped.get(currency) || { currency, total: 0, count: 0 }
      current.total += Number(receipt.total) || 0
      current.count += 1
      grouped.set(currency, current)
    })

    return [...grouped.values()].sort((a, b) => b.count - a.count || b.total - a.total)
  }, [filteredReceipts, profile.currency])

  const analyticsCurrency = useMemo(() => {
    if (currencyFilter !== 'all') return currencyFilter
    return currenciesInView[0]?.currency || profile.currency || 'PHP'
  }, [currenciesInView, currencyFilter, profile.currency])

  const analyticsReceipts = useMemo(() => (
    filteredReceipts.filter(receipt => getReceiptCurrencyCode(receipt, profile.currency || 'PHP') === analyticsCurrency)
  ), [analyticsCurrency, filteredReceipts, profile.currency])

  const analyticsSummary = useMemo(() => {
    let total = 0
    let biggest = null
    const merchantGrouped = new Map()
    const categoryGrouped = new Map()

    analyticsReceipts.forEach(receipt => {
      const amount = Number(receipt.total) || 0
      total += amount

      if (!biggest || amount > biggest.total) {
        biggest = { total: amount, merchant: receipt.merchant || 'Receipt' }
      }

      const merchant = String(receipt.merchant || 'Unknown merchant').trim() || 'Unknown merchant'
      const merchantCurrent = merchantGrouped.get(merchant) || { merchant, total: 0, count: 0 }
      merchantCurrent.total += amount
      merchantCurrent.count += 1
      merchantGrouped.set(merchant, merchantCurrent)

      const category = String(receipt.category || 'Other')
      const categoryCurrent = categoryGrouped.get(category) || { category, total: 0, count: 0 }
      categoryCurrent.total += amount
      categoryCurrent.count += 1
      categoryGrouped.set(category, categoryCurrent)
    })

    const topMerchant = [...merchantGrouped.values()].sort((a, b) => b.total - a.total || b.count - a.count)[0] || null
    const topCategory = [...categoryGrouped.values()].sort((a, b) => b.total - a.total || b.count - a.count)[0] || null

    return {
      total,
      average: analyticsReceipts.length ? total / analyticsReceipts.length : 0,
      biggest,
      topMerchant,
      topCategory,
    }
  }, [analyticsReceipts])

  const trendSeries = useMemo(() => buildTrendSeries(analyticsReceipts, 6), [analyticsReceipts])
  const trendMax = useMemo(() => Math.max(1, ...trendSeries.map(item => item.total)), [trendSeries])

  const merchantRankings = useMemo(() => {
    const grouped = new Map()

    analyticsReceipts.forEach(receipt => {
      const merchant = String(receipt.merchant || 'Unknown merchant').trim() || 'Unknown merchant'
      const current = grouped.get(merchant) || { merchant, total: 0, count: 0 }
      current.total += Number(receipt.total) || 0
      current.count += 1
      grouped.set(merchant, current)
    })

    return [...grouped.values()].sort((a, b) => b.total - a.total || b.count - a.count).slice(0, 5)
  }, [analyticsReceipts])

  const categoryRankings = useMemo(() => {
    const grouped = new Map()

    analyticsReceipts.forEach(receipt => {
      const category = String(receipt.category || 'Other')
      const current = grouped.get(category) || { category, total: 0, count: 0 }
      current.total += Number(receipt.total) || 0
      current.count += 1
      grouped.set(category, current)
    })

    return [...grouped.values()].sort((a, b) => b.total - a.total || b.count - a.count).slice(0, 5)
  }, [analyticsReceipts])

  const merchantHistory = useMemo(() => {
    if (!selectedReceipt?.merchant) return null

    const merchantKey = selectedReceipt.merchant.trim().toLowerCase()
    const merchantReceipts = receipts.filter(receipt => (
      String(receipt.merchant || '').trim().toLowerCase() === merchantKey
    ))

    if (!merchantReceipts.length) return null

    const selectedCurrency = getReceiptCurrencyCode(selectedReceipt, profile.currency || 'PHP')
    const sameCurrencyReceipts = merchantReceipts.filter(receipt => (
      getReceiptCurrencyCode(receipt, profile.currency || 'PHP') === selectedCurrency
    ))
    const sortedByDate = [...merchantReceipts].sort((a, b) => getReceiptDateTimestamp(a) - getReceiptDateTimestamp(b))
    const total = sameCurrencyReceipts.reduce((sum, receipt) => sum + (Number(receipt.total) || 0), 0)

    return {
      count: merchantReceipts.length,
      total,
      average: sameCurrencyReceipts.length ? total / sameCurrencyReceipts.length : 0,
      firstDate: sortedByDate[0]?.date || '',
      latestDate: sortedByDate[sortedByDate.length - 1]?.date || '',
      currency: selectedCurrency,
    }
  }, [profile.currency, receipts, selectedReceipt])

  const hasActiveFilters = Boolean(searchQuery.trim()) || range !== 'all' || currencyFilter !== 'all' || categoryFilter !== 'all'
  const viewCoverage = allStats.total ? Math.round((viewStats.total / allStats.total) * 100) : 0

  function money(value, currency = profile.currency || 'PHP') {
    const symbol = getCurrencySymbol(currency)
    return displayValue(privacyMode, fmt(value, symbol), maskMoney(symbol))
  }

  function resetFilters() {
    setSearchQuery('')
    setRange('all')
    setCurrencyFilter('all')
    setCategoryFilter('all')
  }

  function resetDraft() {
    setDraft(createManualReceiptDraft(profile.currency || 'PHP'))
  }

  function updateDraft(field, value) {
    setDraft(current => ({ ...current, [field]: value }))
  }

  async function handleSaveDraft() {
    const merchant = String(draft.merchant || '').trim()
    const normalizedDate = normalizeDate(draft.date)
    const total = Number(draft.total)

    if (!merchant) {
      setMessage({ text: 'Enter a merchant or receipt name first.', ok: false })
      return
    }

    if (!normalizedDate) {
      setMessage({ text: 'Pick a valid receipt date.', ok: false })
      return
    }

    if (!Number.isFinite(total) || total <= 0) {
      setMessage({ text: 'Enter a total greater than zero.', ok: false })
      return
    }

    setSaving(true)
    setMessage({ text: '', ok: true })

    try {
      const saved = await fsSaveReceipt(user.uid, {
        merchant,
        total,
        date: normalizedDate,
        currency: draft.currency || profile.currency || 'PHP',
        category: draft.category || 'Other',
        reference: String(draft.reference || '').trim(),
        notes: String(draft.notes || '').trim(),
        source: 'manual-receipt',
        lineItems: [],
        rawText: '',
        confidence: { overall: '' },
      })
      resetDraft()
      resetFilters()
      setSelectedId(saved._id)
      setMessage({ text: 'Receipt saved.', ok: true })
    } catch {
      setMessage({ text: 'Could not save this receipt right now.', ok: false })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(receipt) {
    if (!receipt?._id) return
    if (!(await confirmDeleteApp(`receipt from ${receipt.merchant || 'this merchant'}`))) return

    setDeleteId(receipt._id)
    setMessage({ text: '', ok: true })

    try {
      await fsDeleteReceipt(user.uid, receipt)
      setMessage({ text: 'Receipt deleted.', ok: true })
      if (selectedId === receipt._id) setSelectedId('')
    } catch {
      setMessage({ text: 'Could not delete this receipt right now.', ok: false })
    } finally {
      setDeleteId('')
    }
  }

  return (
    <div className={`${styles.page} ${receiptStyles.receiptsPage}`}>
      <div className={receiptStyles.heroSection}>
        <div className={receiptStyles.heroCopy}>
          <div className={receiptStyles.pageEyebrow}>Receipts</div>
          <div className={receiptStyles.pageTitle}>Keep receipts easy to review.</div>
          <div className={receiptStyles.pageSub}>
            Receipt capture is off. Add manual records here, then search older imports and any linked expense details you already saved.
          </div>
        </div>

        <div className={receiptStyles.heroAside}>
          <div className={receiptStyles.heroAsideLabel}>Receipt box</div>
          <div className={receiptStyles.heroAsideValue}>{allStats.total ? `${allStats.total} saved` : 'Manual only'}</div>
          <div className={receiptStyles.heroAsideTrack}>
            <div className={receiptStyles.heroAsideFill} style={{ width: `${viewCoverage}%` }} />
          </div>
          <div className={receiptStyles.heroAsideMeta}>
            {hasActiveFilters
              ? `${viewStats.total} receipts match the current filters.`
              : allStats.total
                ? `${allStats.monthCount} saved this month across ${allStats.currencies || 0} currencies.`
                : 'Add a manual receipt here or review any older saved receipt records.'}
          </div>
        </div>
      </div>

      <DraftBanner message={message} />

      <div className={receiptStyles.topSummaryGrid}>
        <div className={receiptStyles.topSummaryCard}>
          <div className={receiptStyles.topSummaryLabel}>Saved receipts</div>
          <div className={receiptStyles.topSummaryValue}>{allStats.total}</div>
          <div className={receiptStyles.topSummaryMeta}>Everything currently stored in your receipt box</div>
        </div>
        <div className={receiptStyles.topSummaryCard}>
          <div className={receiptStyles.topSummaryLabel}>In view</div>
          <div className={`${receiptStyles.topSummaryValue} ${receiptStyles.topSummaryValueAccent}`}>{viewStats.total}</div>
          <div className={receiptStyles.topSummaryMeta}>Receipts matching the current filters</div>
        </div>
        <div className={receiptStyles.topSummaryCard}>
          <div className={receiptStyles.topSummaryLabel}>This month</div>
          <div className={`${receiptStyles.topSummaryValue} ${receiptStyles.topSummaryValueBlue}`}>{viewStats.monthCount}</div>
          <div className={receiptStyles.topSummaryMeta}>Receipts in this view from this month</div>
        </div>
        <div className={receiptStyles.topSummaryCard}>
          <div className={receiptStyles.topSummaryLabel}>Merchants in view</div>
          <div className={receiptStyles.topSummaryValue}>{viewStats.merchants}</div>
          <div className={receiptStyles.topSummaryMeta}>{viewStats.currencies || 0} currencies across the current results</div>
        </div>
      </div>

      <div className={receiptStyles.heroGrid}>
        <div className={receiptStyles.captureCard}>
          <div className={receiptStyles.sectionEyebrow}>Manual receipt</div>
          <div className={receiptStyles.sectionTitle}>Add a receipt record</div>
          <div className={receiptStyles.sectionCopy}>
            Save a merchant, total, date, and notes without using camera or upload. Older imported receipts still stay visible in the receipt box below.
          </div>
          <div className={receiptStyles.formGrid}>
            <label className={receiptStyles.formField}>
              <span>Merchant</span>
              <input
                type="text"
                value={draft.merchant}
                onChange={event => updateDraft('merchant', event.target.value)}
                placeholder="Uber, Tesco, 7-Eleven, Uniqlo"
              />
            </label>
            <label className={receiptStyles.formField}>
              <span>Total</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={draft.total}
                onChange={event => updateDraft('total', event.target.value)}
                placeholder="0.00"
              />
            </label>
            <label className={receiptStyles.formField}>
              <span>Date</span>
              <input
                type="date"
                value={draft.date}
                onChange={event => updateDraft('date', event.target.value)}
              />
            </label>
            <label className={receiptStyles.formField}>
              <span>Currency</span>
              <select value={draft.currency} onChange={event => updateDraft('currency', event.target.value)}>
                {CURRENCIES.map(option => (
                  <option key={option.code} value={option.code}>
                    {option.code}
                  </option>
                ))}
              </select>
            </label>
            <label className={receiptStyles.formField}>
              <span>Category</span>
              <select value={draft.category} onChange={event => updateDraft('category', event.target.value)}>
                {manualCategoryOptions.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className={receiptStyles.formField}>
              <span>Reference</span>
              <input
                type="text"
                value={draft.reference}
                onChange={event => updateDraft('reference', event.target.value)}
                placeholder="Receipt number, branch, payment note"
              />
            </label>
            <label className={`${receiptStyles.formField} ${receiptStyles.fullWidth}`}>
              <span>Notes</span>
              <textarea
                value={draft.notes}
                onChange={event => updateDraft('notes', event.target.value)}
                placeholder="Optional context: who paid, what this covered, or why you kept the receipt."
              />
            </label>
          </div>
          <div className={receiptStyles.captureActions}>
            <button className={receiptStyles.primaryButton} onClick={handleSaveDraft} disabled={saving}>
              {saving ? 'Saving...' : 'Save receipt'}
            </button>
            <button className={receiptStyles.secondaryButton} onClick={resetDraft} disabled={saving}>
              Reset form
            </button>
          </div>
          <div className={receiptStyles.captureHint}>
            Use Quick Add for wallet screenshots. This page is for manual receipt records and earlier saved receipt review.
          </div>
        </div>

        <div className={receiptStyles.summaryCard}>
          <div className={receiptStyles.sectionEyebrow}>Insight focus</div>
          <div className={receiptStyles.sectionTitle}>Receipt snapshot</div>
          <div className={receiptStyles.summaryBlock}>
            <div className={receiptStyles.summaryLabel}>Analytics scope</div>
            <div className={receiptStyles.summaryInlinePills}>
              <span className={receiptStyles.infoPill}>{analyticsCurrency}</span>
              <span className={receiptStyles.infoPill}>{viewStats.total} receipts in view</span>
              {currenciesInView.length > 1 && currencyFilter === 'all' && (
                <span className={receiptStyles.infoPill}>Charts focus on the busiest currency in view</span>
              )}
            </div>
          </div>
          <div className={receiptStyles.summaryBlock}>
            <div className={receiptStyles.summaryLabel}>Spend in {analyticsCurrency}</div>
            <div className={receiptStyles.summaryMetricGrid}>
              <div className={receiptStyles.summaryMetric}>
                <span>Total tracked</span>
                <strong>{money(analyticsSummary.total, analyticsCurrency)}</strong>
              </div>
              <div className={receiptStyles.summaryMetric}>
                <span>Average receipt</span>
                <strong>{money(analyticsSummary.average, analyticsCurrency)}</strong>
              </div>
            </div>
          </div>
          <div className={receiptStyles.summaryBlock}>
            <div className={receiptStyles.summaryLabel}>Highlights</div>
            {analyticsSummary.topMerchant ? (
              <>
                <div className={receiptStyles.summaryRow}>
                  <span>Top merchant</span>
                  <span>{analyticsSummary.topMerchant.merchant}</span>
                </div>
                <div className={receiptStyles.summaryRow}>
                  <span>Top category</span>
                  <span>{analyticsSummary.topCategory?.category || 'Other'}</span>
                </div>
                <div className={receiptStyles.summaryRow}>
                  <span>Largest receipt</span>
                  <span>{money(analyticsSummary.biggest?.total || 0, analyticsCurrency)}</span>
                </div>
              </>
            ) : (
              <div className={receiptStyles.summaryEmpty}>Save a few receipts and Buhay will start showing merchant and category patterns here.</div>
            )}
          </div>
        </div>
      </div>

      <div className={receiptStyles.controlsCard}>
        <div className={receiptStyles.listHeader}>
          <div>
            <div className={receiptStyles.sectionEyebrow}>Filters</div>
            <div className={receiptStyles.sectionTitle}>Search receipts</div>
          </div>
          {hasActiveFilters && (
            <button className={receiptStyles.secondaryButton} onClick={resetFilters}>
              Clear filters
            </button>
          )}
        </div>
        <div className={receiptStyles.filtersGrid}>
          <label className={`${receiptStyles.formField} ${receiptStyles.searchField}`}>
            <span>Search</span>
            <input
              type="search"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="Merchant, note, category, line item, or imported text"
            />
          </label>
          <label className={receiptStyles.formField}>
            <span>Currency</span>
            <select value={currencyFilter} onChange={event => setCurrencyFilter(event.target.value)}>
              <option value="all">All currencies</option>
              {receiptCurrencyOptions.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className={receiptStyles.formField}>
            <span>Category</span>
            <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}>
              <option value="all">All categories</option>
              {categoryOptions.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
        <div className={receiptStyles.filterChips}>
          {RANGE_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              className={`${receiptStyles.filterChip} ${range === option.value ? receiptStyles.filterChipActive : ''}`}
              onClick={() => setRange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className={receiptStyles.filterMeta}>
          <span>{viewStats.total} of {allStats.total} receipts shown</span>
          <span>{analyticsCurrency} powers the charts below</span>
        </div>
      </div>

      <div className={receiptStyles.analyticsGrid}>
        <div className={receiptStyles.analyticsCard}>
          <div className={receiptStyles.listHeader}>
            <div>
              <div className={receiptStyles.sectionEyebrow}>Trends</div>
              <div className={receiptStyles.sectionTitle}>6-month spend view</div>
            </div>
            <div className={receiptStyles.listCount}>{analyticsCurrency}</div>
          </div>
          {analyticsReceipts.length ? (
            <>
              <div className={receiptStyles.chartCard}>
                <div className={receiptStyles.chartColumns}>
                  {trendSeries.map(item => (
                    <div key={item.key} className={receiptStyles.chartColumn}>
                      <div className={receiptStyles.chartValue}>{money(item.total, analyticsCurrency)}</div>
                      <div className={receiptStyles.chartTrack}>
                        <div
                          className={receiptStyles.chartBar}
                          style={{ height: `${getPercent(item.total, trendMax, item.total > 0 ? 16 : 8)}%` }}
                        />
                      </div>
                      <div className={receiptStyles.chartLabel}>{item.label}</div>
                      <div className={receiptStyles.chartMeta}>{item.count}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className={receiptStyles.analyticsFooter}>
                <span>{money(analyticsSummary.total, analyticsCurrency)} across {analyticsReceipts.length} receipts</span>
                <span>{currenciesInView.length > 1 && currencyFilter === 'all' ? `Multiple currencies detected in view` : `Single-currency analytics`}</span>
              </div>
            </>
          ) : (
            <div className={receiptStyles.emptyState}>
              <div className={receiptStyles.emptyTitle}>No trend yet</div>
              <div className={receiptStyles.emptyCopy}>Change your filters or save more receipts to build a trend view for this currency.</div>
            </div>
          )}
        </div>

        <div className={receiptStyles.analyticsCard}>
          <div className={receiptStyles.listHeader}>
            <div>
              <div className={receiptStyles.sectionEyebrow}>Rankings</div>
              <div className={receiptStyles.sectionTitle}>Merchants and categories</div>
            </div>
            <div className={receiptStyles.listCount}>{analyticsReceipts.length}</div>
          </div>
          <div className={receiptStyles.analyticsSplit}>
            <div>
              <div className={receiptStyles.summaryLabel}>Top merchants</div>
              {merchantRankings.length ? merchantRankings.map(item => (
                <div key={item.merchant} className={receiptStyles.rankingRow}>
                  <div className={receiptStyles.rankingCopy}>
                    <strong>{item.merchant}</strong>
                    <span>{item.count} receipts</span>
                  </div>
                  <div className={receiptStyles.rankingBarTrack}>
                    <div
                      className={receiptStyles.rankingBar}
                      style={{ width: `${getPercent(item.total, merchantRankings[0]?.total || 0, 18)}%` }}
                    />
                  </div>
                  <div className={receiptStyles.rankingValue}>{money(item.total, analyticsCurrency)}</div>
                </div>
              )) : (
                <div className={receiptStyles.summaryEmpty}>No merchants match the current filters yet.</div>
              )}
            </div>

            <div>
              <div className={receiptStyles.summaryLabel}>Top categories</div>
              {categoryRankings.length ? categoryRankings.map(item => (
                <div key={item.category} className={receiptStyles.rankingRow}>
                  <div className={receiptStyles.rankingCopy}>
                    <strong>{item.category}</strong>
                    <span>{item.count} receipts</span>
                  </div>
                  <div className={receiptStyles.rankingBarTrack}>
                    <div
                      className={`${receiptStyles.rankingBar} ${receiptStyles.rankingBarAlt}`}
                      style={{ width: `${getPercent(item.total, categoryRankings[0]?.total || 0, 18)}%` }}
                    />
                  </div>
                  <div className={receiptStyles.rankingValue}>{money(item.total, analyticsCurrency)}</div>
                </div>
              )) : (
                <div className={receiptStyles.summaryEmpty}>No categories match the current filters yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={receiptStyles.galleryGrid}>
        <div className={receiptStyles.galleryCard}>
          <div className={receiptStyles.listHeader}>
            <div>
              <div className={receiptStyles.sectionEyebrow}>Receipt box</div>
              <div className={receiptStyles.sectionTitle}>Saved receipts</div>
            </div>
            <div className={receiptStyles.listCount}>{filteredReceipts.length}</div>
          </div>

          {filteredReceipts.length ? (
            <div className={receiptStyles.receiptList}>
              {filteredReceipts.map(receipt => {
                const previewUrl = receiptImageUrls[receipt._id] || getReceiptFallbackImageUrl(receipt)
                return (
                  <button
                    key={receipt._id}
                    type="button"
                    className={`${receiptStyles.receiptCard} ${selectedReceipt?._id === receipt._id ? receiptStyles.receiptCardActive : ''}`}
                    onClick={() => setSelectedId(receipt._id)}
                  >
                    <div className={receiptStyles.receiptThumbWrap}>
                      {privacyMode ? (
                        <div className={receiptStyles.receiptThumbFallback}>Hidden</div>
                      ) : previewUrl ? (
                        <img src={previewUrl} alt={receipt.merchant || 'Saved receipt'} className={receiptStyles.receiptThumb} />
                      ) : (
                        <div className={receiptStyles.receiptThumbFallback}>🧾</div>
                      )}
                    </div>
                    <div className={receiptStyles.receiptCopy}>
                      <div className={receiptStyles.receiptTopRow}>
                        <span className={receiptStyles.receiptMerchant}>{receipt.merchant || 'Receipt'}</span>
                        <span className={receiptStyles.receiptAmount}>{money(receipt.total, receipt.currency)}</span>
                      </div>
                      <div className={receiptStyles.receiptMetaRow}>
                        <span>{formatDisplayDate(receipt.date)}</span>
                        <span>{receipt.currency || 'PHP'}</span>
                      </div>
                      <div className={receiptStyles.receiptMetaRow}>
                        <span>{receipt.category || 'Other'}</span>
                        <span>Saved {formatSavedAt(receipt.createdAt)}</span>
                      </div>
                      <div className={receiptStyles.receiptMetaRow}>
                        <span>{receipt.source === 'manual-receipt' ? 'Manual receipt' : 'Earlier import'}</span>
                        <span>{receipt.transactionId ? 'History linked' : 'Standalone'}</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className={receiptStyles.emptyState}>
              <div className={receiptStyles.emptyTitle}>{receipts.length ? 'No receipts match these filters' : 'No saved receipts yet'}</div>
              <div className={receiptStyles.emptyCopy}>
                {receipts.length
                  ? 'Try a different search, widen the time range, or clear the filters to bring receipts back into view.'
                  : 'No receipt records are saved right now. Add your first manual receipt above or review older saved imports if you already have them.'}
              </div>
            </div>
          )}
        </div>

        <div className={receiptStyles.detailCard}>
          <div className={receiptStyles.listHeader}>
            <div>
              <div className={receiptStyles.sectionEyebrow}>Details</div>
              <div className={receiptStyles.sectionTitle}>{selectedReceipt?.merchant || 'Select a receipt'}</div>
            </div>
            {selectedReceipt && (
              <button
                className={receiptStyles.deleteButton}
                onClick={() => handleDelete(selectedReceipt)}
                disabled={deleteId === selectedReceipt._id}
              >
                {deleteId === selectedReceipt._id ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>

          {selectedReceipt ? (
            <div className={receiptStyles.detailContent}>
              {privacyMode && selectedReceiptHasImage ? (
                <div className={receiptStyles.privacyImagePlaceholder}>Receipt image hidden while privacy mode is on</div>
              ) : selectedReceiptImageUrl && (
                <img
                  src={selectedReceiptImageUrl}
                  alt={selectedReceipt.merchant || 'Saved receipt'}
                  className={receiptStyles.detailImage}
                />
              )}

              <div className={receiptStyles.detailMetaGrid}>
                <div className={receiptStyles.detailMetaItem}>
                  <span>Merchant</span>
                  <strong>{selectedReceipt.merchant || 'Receipt'}</strong>
                </div>
                <div className={receiptStyles.detailMetaItem}>
                  <span>Total</span>
                  <strong>{money(selectedReceipt.total, selectedReceipt.currency)}</strong>
                </div>
                <div className={receiptStyles.detailMetaItem}>
                  <span>Date</span>
                  <strong>{formatDisplayDate(selectedReceipt.date)}</strong>
                </div>
                <div className={receiptStyles.detailMetaItem}>
                  <span>Currency</span>
                  <strong>{selectedReceipt.currency || 'PHP'}</strong>
                </div>
                <div className={receiptStyles.detailMetaItem}>
                  <span>Category</span>
                  <strong>{selectedReceipt.category || 'Other'}</strong>
                </div>
                <div className={receiptStyles.detailMetaItem}>
                  <span>Reference</span>
                  <strong>{selectedReceipt.reference || 'None'}</strong>
                </div>
                <div className={receiptStyles.detailMetaItem}>
                  <span>Record type</span>
                  <strong>{selectedReceipt.source === 'manual-receipt' ? 'Manual receipt' : 'Earlier import'}</strong>
                </div>
                <div className={receiptStyles.detailMetaItem}>
                  <span>Linked transaction</span>
                  <strong>{selectedReceipt.transactionId ? 'Linked' : 'None'}</strong>
                </div>
              </div>

              {selectedReceipt.cleanupSummary && (
                <div className={receiptStyles.infoPill}>{selectedReceipt.cleanupSummary}</div>
              )}

              {merchantHistory && (
                <div className={receiptStyles.textBlock}>
                  <div className={receiptStyles.textBlockLabel}>Merchant history</div>
                  <div className={receiptStyles.merchantHistoryGrid}>
                    <div className={receiptStyles.historyMetric}>
                      <span>Seen</span>
                      <strong>{merchantHistory.count} times</strong>
                    </div>
                    <div className={receiptStyles.historyMetric}>
                      <span>Average</span>
                      <strong>{money(merchantHistory.average, merchantHistory.currency)}</strong>
                    </div>
                    <div className={receiptStyles.historyMetric}>
                      <span>First receipt</span>
                      <strong>{formatDisplayDate(merchantHistory.firstDate)}</strong>
                    </div>
                    <div className={receiptStyles.historyMetric}>
                      <span>Latest receipt</span>
                      <strong>{formatDisplayDate(merchantHistory.latestDate)}</strong>
                    </div>
                  </div>
                </div>
              )}

              {selectedConfidence?.overall && (
                <div className={receiptStyles.confidenceRow}>
                  <span className={`${receiptStyles.confidencePill} ${receiptStyles[getConfidenceClassName(selectedConfidence.overall)]}`}>
                    {formatConfidenceLabel(selectedConfidence.overall)}
                  </span>
                  {selectedConfidence.amount && <span className={receiptStyles.infoPill}>Total: {formatConfidenceLabel(selectedConfidence.amount)}</span>}
                  {selectedConfidence.merchant && <span className={receiptStyles.infoPill}>Merchant: {formatConfidenceLabel(selectedConfidence.merchant)}</span>}
                  {selectedConfidence.date && <span className={receiptStyles.infoPill}>Date: {formatConfidenceLabel(selectedConfidence.date)}</span>}
                  {selectedConfidence.lineItems && selectedConfidence.lineItems !== 'none' && (
                    <span className={receiptStyles.infoPill}>Items: {formatConfidenceLabel(selectedConfidence.lineItems)}</span>
                  )}
                </div>
              )}

              {!!selectedLineItems.length && (
                <div className={receiptStyles.textBlock}>
                  <div className={receiptStyles.textBlockLabel}>Detected line items</div>
                  <div className={receiptStyles.lineItemsList}>
                    {selectedLineItems.map((item, index) => (
                      <div key={`${item.name}-${index}`} className={receiptStyles.lineItemRow}>
                        <span>{item.name}</span>
                        <span>x{item.qty} · {money(item.lineTotal || item.price, selectedReceipt.currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedReceipt.notes && (
                <div className={receiptStyles.textBlock}>
                  <div className={receiptStyles.textBlockLabel}>Notes</div>
                  <div className={receiptStyles.textBlockValue}>{selectedReceipt.notes}</div>
                </div>
              )}

              {selectedReceipt.rawTextPreview && (
                <div className={receiptStyles.textBlock}>
                  <div className={receiptStyles.textBlockLabel}>Imported text snapshot</div>
                  <div className={receiptStyles.textBlockValue}>{selectedReceipt.rawTextPreview}</div>
                </div>
              )}
            </div>
          ) : (
            <div className={receiptStyles.emptyState}>
              <div className={receiptStyles.emptyTitle}>{filteredReceipts.length ? 'No receipt selected' : 'Nothing matches the current view'}</div>
              <div className={receiptStyles.emptyCopy}>
                {filteredReceipts.length
                  ? 'Choose a saved receipt to inspect the cleaned image, extracted values, and imported text snapshot.'
                  : 'Adjust your filters or save a manual receipt record to bring receipt details into view.'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
