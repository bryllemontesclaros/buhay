import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { confirmApp, notifyApp } from '../lib/appFeedback'
import { fsDeletePortfolioHolding, fsSavePortfolioHolding } from '../lib/firestore'
import { PORTFOLIO_ASSET_TYPES, getPortfolioSummary, normalizePortfolioHolding } from '../lib/portfolio'
import { playTick } from '../lib/utils'
import { safeScrollIntoView } from '../lib/ui'
import styles from './Page.module.css'
import pStyles from './Portfolio.module.css'

function formatMoney(value, symbol = '₱') {
  const amount = Number(value) || 0
  return `${symbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: amount % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`
}

function formatPercent(value) {
  const amount = Number(value) || 0
  return `${amount >= 0 ? '+' : ''}${amount.toFixed(1)}%`
}

const ASSET_TYPE_LABELS = Object.fromEntries(PORTFOLIO_ASSET_TYPES.map(type => [type.id, type.label]))

function getEmptyHolding(currency = 'PHP') {
  return {
    name: '',
    symbol: '',
    assetType: 'stock',
    quantity: '',
    averageBuyPrice: '',
    currentPrice: '',
    fees: '',
    currency,
    platform: '',
    accountId: '',
    includeInTotalBalance: false,
    notes: '',
  }
}

function toFormValue(value) {
  return value === 0 ? '0' : String(value || '')
}

export default function Portfolio({ user, data = {}, profile = {}, symbol = '₱', privacyMode = false, portfolioActionRequest = null, onPortfolioActionHandled, exchangeRates = null }) {
  const defaultCurrency = String(profile.currency || 'PHP').toUpperCase()
  const [form, setForm] = useState(() => getEmptyHolding(defaultCurrency))
  const [editingHolding, setEditingHolding] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const formRef = useRef(null)
  const [isMobile, setIsMobile] = useState(false)
  const summary = getPortfolioSummary(data.portfolioHoldings || [], exchangeRates)
  const holdings = summary.holdings
  const hasHoldings = holdings.length > 0
  const gainTone = summary.gainLoss >= 0 ? pStyles.positive : pStyles.negative
  const assetRows = PORTFOLIO_ASSET_TYPES
    .map(type => ({
      ...type,
      value: summary.assetTypes[type.id] || 0,
      pct: summary.marketValue > 0 ? ((summary.assetTypes[type.id] || 0) / summary.marketValue) * 100 : 0,
    }))
    .filter(row => row.value > 0)
  const formPreview = normalizePortfolioHolding(form)
  const accountOptions = data.accounts || []

  useEffect(() => {
    if (formOpen && formRef.current) {
      if (typeof window !== 'undefined' && window.matchMedia('(max-width: 560px)').matches) return
      safeScrollIntoView(formRef.current, { behavior: 'smooth', block: 'start' })
    }
  }, [formOpen, editingHolding?._id])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(max-width: 560px)')
    setIsMobile(media.matches)
    const listener = e => setIsMobile(e.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [])

  useEffect(() => {
    if (portfolioActionRequest?.type !== 'add-holding') return
    openAdd()
    onPortfolioActionHandled?.(portfolioActionRequest.token)
  }, [portfolioActionRequest?.token])

  function setField(key, value) {
    setForm(current => ({ ...current, [key]: value }))
  }

  function openAdd() {
    playTick()
    setEditingHolding(null)
    setForm(getEmptyHolding(defaultCurrency))
    setFormOpen(true)
  }

  function openEdit(holding) {
    playTick()
    setEditingHolding(holding)
    setForm({
      name: holding.name || '',
      symbol: holding.symbol || '',
      assetType: holding.assetType || 'other',
      quantity: toFormValue(holding.quantity),
      averageBuyPrice: toFormValue(holding.averageBuyPrice),
      currentPrice: toFormValue(holding.currentPrice),
    })
    setFormOpen(true)
  }

  function closeForm() {
    playTick()
    setFormOpen(false)
    setEditingHolding(null)
    setForm(getEmptyHolding(defaultCurrency))
  }

  async function handleSave() {
    playTick()
    const next = normalizePortfolioHolding(form)
    if (!next.name && !next.symbol) {
      notifyApp({ title: 'Holding needs a name', message: 'Add an asset name or symbol before saving.', tone: 'warning' })
      return
    }
    if (next.quantity <= 0) {
      notifyApp({ title: 'Quantity needed', message: 'Enter how many shares, units, coins, or fund units you hold.', tone: 'warning' })
      return
    }
    if (next.currentPrice < 0 || next.averageBuyPrice < 0) {
      notifyApp({ title: 'Check amounts', message: 'Prices cannot be negative.', tone: 'warning' })
      return
    }

    setSaving(true)
    try {
      await fsSavePortfolioHolding(user.uid, {
        ...form,
        _id: editingHolding?._id,
        lastPriceUpdatedAt: Date.now(),
      })
      notifyApp({
        title: editingHolding ? 'Holding updated' : 'Holding added',
        message: `${next.symbol || next.name} is now tracked in your Portfolio.`,
        tone: 'success',
      })
      closeForm()
    } catch {
      notifyApp({ title: 'Portfolio not saved', message: 'Could not save this holding right now. Check your connection and try again.', tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(holding) {
    playTick()
    const confirmed = await confirmApp({
      title: 'Delete holding?',
      message: `Delete ${holding.symbol || holding.name || 'this holding'} from Portfolio? This cannot be undone.`,
      confirmLabel: 'Delete holding',
      cancelLabel: 'Keep holding',
      tone: 'danger',
    })
    if (!confirmed) return
    try {
      await fsDeletePortfolioHolding(user.uid, holding._id)
      notifyApp({ title: 'Holding deleted', message: 'Portfolio totals were updated.', tone: 'success' })
    } catch {
      notifyApp({ title: 'Holding not deleted', message: 'Could not delete this holding right now.', tone: 'error' })
    }
  }

  const formContent = (
    <>
      <button
        type="button"
        className={pStyles.formBackdrop}
        onClick={closeForm}
        aria-label="Close holding form"
      />
      <div ref={formRef} className={pStyles.formCard} role="dialog" aria-modal="true" aria-label={editingHolding ? 'Edit portfolio holding' : 'Add portfolio holding'}>
        <div className={pStyles.formHeader}>
          <div>
            <div className={pStyles.eyebrow}>{editingHolding ? 'Edit holding' : 'New holding'}</div>
            <h3>{editingHolding ? 'Update this asset.' : 'Add a manual investment.'}</h3>
          </div>
          <button type="button" className={pStyles.closeBtn} onClick={closeForm} disabled={saving} aria-label="Close holding form">×</button>
        </div>

        <div className={pStyles.formGrid}>
          <label>
            <span>Asset name</span>
            <input value={form.name} onChange={event => setField('name', event.target.value)} placeholder="Apple, Bitcoin, VTI" />
          </label>
          <label>
            <span>Symbol</span>
            <input value={form.symbol} onChange={event => setField('symbol', event.target.value.toUpperCase())} placeholder="AAPL, BTC, VTI" />
          </label>
          <label>
            <span>Asset type</span>
            <select value={form.assetType} onChange={event => setField('assetType', event.target.value)}>
              {PORTFOLIO_ASSET_TYPES.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
            </select>
          </label>
          <label>
            <span>Quantity</span>
            <input type="number" min="0" step="any" value={form.quantity} onChange={event => setField('quantity', event.target.value)} placeholder="0" />
          </label>
          <label>
            <span>Average buy price</span>
            <input type="number" min="0" step="any" value={form.averageBuyPrice} onChange={event => setField('averageBuyPrice', event.target.value)} placeholder="0.00" />
          </label>
          <label>
            <span>Current manual price</span>
            <input type="number" min="0" step="any" value={form.currentPrice} onChange={event => setField('currentPrice', event.target.value)} placeholder="0.00" />
          </label>
        </div>

        <div className={pStyles.previewCard}>
          <div>
            <span>Preview value</span>
            <strong>{formatMoney(formPreview.marketValue, symbol)}</strong>
          </div>
          <div>
            <span>Preview gain/loss</span>
            <strong className={formPreview.gainLoss >= 0 ? pStyles.positiveText : pStyles.negativeText}>
              {formatMoney(formPreview.gainLoss, symbol)} ({formatPercent(formPreview.gainLossPct)})
            </strong>
          </div>
        </div>

        <div className={pStyles.formActions}>
          <button type="button" className={pStyles.ghostBtn} onClick={closeForm} disabled={saving}>Cancel</button>
          <button type="button" className={pStyles.primaryBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : editingHolding ? 'Save changes' : 'Save holding'}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className={styles.page}>
      <div className={styles.pageHero}>
        <div className={styles.pageHeader}>
          <div className={styles.pageEyebrow}>Portfolio</div>
          <div className={styles.pageTitle}>Investments beside your daily money view.</div>
          <div className={styles.pageSub}>
            Track stocks, crypto, funds, and other holdings manually, then choose which assets count toward your Takda Total Balance.
          </div>
          <div className={pStyles.heroActions}>
            <button type="button" className={pStyles.primaryBtn} onClick={openAdd}>
              Add holding
            </button>
            <span style={{ fontSize: '12px', color: 'var(--text3)' }}>Manual prices. You stay in control of what affects your balance.</span>
          </div>
        </div>
        <div className={pStyles.totalCard}>
          <span>Total portfolio value</span>
          <strong>{privacyMode ? 'Hidden' : formatMoney(summary.marketValue, symbol)}</strong>
          <small>Tracked separately from your main accounts.</small>
          <div className={pStyles.totalSplit}>
            <span>Holdings <strong>{holdings.length}</strong></span>
          </div>
        </div>
      </div>

      <section className={pStyles.metricGrid} aria-label="Portfolio summary">
        <div className={pStyles.metricCard}>
          <span>Total cost</span>
          <strong>{privacyMode ? 'Hidden' : formatMoney(summary.totalCost, symbol)}</strong>
          <small>Quantity x average buy price</small>
        </div>
        <div className={`${pStyles.metricCard} ${gainTone}`}>
          <span>Gain / loss</span>
          <strong>{privacyMode ? 'Hidden' : formatMoney(summary.gainLoss, symbol)}</strong>
          <small>{privacyMode ? 'Private' : formatPercent(summary.gainLossPct)}</small>
        </div>
      </section>



      <section className={pStyles.panel}>
        <div className={pStyles.sectionHeader}>
          <div>
            <div className={pStyles.eyebrow}>Holdings</div>
            <h3>Your assets</h3>
          </div>
          <button type="button" className={pStyles.primaryBtn} onClick={openAdd}>
            Add holding
          </button>
        </div>

        {formOpen && (isMobile && typeof document !== 'undefined' ? createPortal(formContent, document.body) : formContent)}

        {!hasHoldings ? (
          <div className={pStyles.emptyState}>
            <div className={pStyles.emptyIcon}>PF</div>
            <h3>Add your first stock, crypto, fund, or investment.</h3>
            <p>
              Use Add holding to save manual stocks, crypto, funds, or custom assets.
            </p>
          </div>
        ) : (
          <div className={pStyles.holdingList}>
            {holdings.map(holding => (
              <article key={holding._id || holding.id || `${holding.symbol}-${holding.name}`} className={pStyles.holdingCard}>
                <div className={pStyles.holdingIdentity}>
                  <div className={pStyles.assetMark} aria-hidden="true">
                    {(holding.symbol || holding.name || 'PF').slice(0, 2).toUpperCase()}
                  </div>
                  <div className={pStyles.holdingCopy}>
                    <span className={pStyles.assetType}>{ASSET_TYPE_LABELS[holding.assetType] || 'Other'}</span>
                    <h3>{holding.symbol || holding.name || 'Holding'}</h3>
                    <p>{holding.name || 'Manual holding'}</p>
                    <div className={pStyles.holdingMeta}>
                      <span>{holding.quantity} units</span>
                      <span>{formatMoney(holding.currentPrice, symbol)} each</span>
                    </div>
                  </div>
                </div>
                <div className={pStyles.holdingValue}>
                  <strong>{privacyMode ? 'Hidden' : formatMoney(holding.marketValue, symbol)}</strong>
                  <span className={holding.gainLoss >= 0 ? pStyles.positiveText : pStyles.negativeText}>
                    {privacyMode ? 'Private' : `${formatMoney(holding.gainLoss, symbol)} (${formatPercent(holding.gainLossPct)})`}
                  </span>
                  <div className={pStyles.rowActions}>
                    <button type="button" onClick={() => openEdit(holding)}>Edit</button>
                    <button type="button" onClick={() => handleDelete(holding)}>Delete</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={pStyles.panel}>
        <div className={pStyles.sectionHeader}>
          <div>
            <div className={pStyles.eyebrow}>Allocation</div>
            <h3>Asset mix</h3>
          </div>
        </div>
        {!assetRows.length ? (
          <div className={pStyles.allocationEmpty}>Allocation appears after the first holding.</div>
        ) : (
          <div className={pStyles.allocationList}>
            {assetRows.map(row => (
              <div key={row.id} className={pStyles.allocationRow}>
                <div>
                  <strong>{row.label}</strong>
                  <span>{formatMoney(row.value, symbol)}</span>
                </div>
                <div className={pStyles.allocationTrack}>
                  <span style={{ width: `${Math.max(4, row.pct)}%` }} />
                </div>
                <small>{row.pct.toFixed(1)}%</small>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className={pStyles.disclaimer}>
        Portfolio values are for tracking only, not financial advice. Prices are manual until a future live-price layer is added.
      </div>
    </div>
  )
}
