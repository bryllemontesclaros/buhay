import { useEffect, useMemo, useRef, useState } from 'react'
import { fsAdd, fsDel, fsUpdate } from '../lib/firestore'
import { confirmApp, notifyApp } from '../lib/appFeedback'
import { fmt, maskMoney } from '../lib/utils'
import {
  calculatePortfolioMetrics,
  CRYPTO_WALLETS,
  fetchLiveCryptoPrices,
  getCachedPrices,
  POPULAR_CRYPTO_COINS,
  searchCryptoCoins,
} from '../lib/crypto'
import styles from './CryptoPortfolio.module.css'

const EMPTY_FORM = {
  coinId: 'bitcoin',
  symbol: 'BTC',
  name: 'Bitcoin',
  quantity: '',
  buyPrice: '',
  wallet: 'Binance',
  notes: '',
}

const COIN_GRADIENTS = {
  bitcoin: 'linear-gradient(135deg, #f7931a, #d47a08)',
  ethereum: 'linear-gradient(135deg, #627eea, #3b5998)',
  solana: 'linear-gradient(135deg, #14f195, #9945ff)',
  tether: 'linear-gradient(135deg, #26a17b, #1b7a5b)',
  ripple: 'linear-gradient(135deg, #333d47, #181d22)',
  dogecoin: 'linear-gradient(135deg, #c2a633, #9e8218)',
  binancecoin: 'linear-gradient(135deg, #f3ba2f, #d49810)',
  cardano: 'linear-gradient(135deg, #0033ad, #001f66)',
  'avalanche-2': 'linear-gradient(135deg, #e84142, #b82526)',
  sui: 'linear-gradient(135deg, #4da2ff, #1a75db)',
  'usd-coin': 'linear-gradient(135deg, #2775ca, #1a5699)',
  chainlink: 'linear-gradient(135deg, #375bd2, #243f9c)',
  polkadot: 'linear-gradient(135deg, #e6007a, #b3005f)',
  near: 'linear-gradient(135deg, #3a3a3a, #111111)',
  uniswap: 'linear-gradient(135deg, #ff007a, #c7005f)',
  'shiba-inu': 'linear-gradient(135deg, #f00500, #b80400)',
}

export default function CryptoPortfolio({
  user,
  data = {},
  profile = {},
  privacyMode = false,
  onPricesUpdated = null,
}) {
  const holdings = useMemo(() => {
    return Array.isArray(data?.portfolioHoldings) ? data.portfolioHoldings.filter(Boolean) : []
  }, [data?.portfolioHoldings])

  const [vsCurrency, setVsCurrency] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('buhay_crypto_vs_currency')
      if (saved === 'USD' || saved === 'PHP') return saved
    }
    return profile?.currency === 'USD' ? 'USD' : 'PHP'
  })

  const [livePrices, setLivePrices] = useState(() => {
    const cached = getCachedPrices()
    return cached?.data || {}
  })
  const [isLive, setIsLive] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(() => {
    const cached = getCachedPrices()
    return cached?.timestamp || Date.now()
  })
  const [refreshing, setRefreshing] = useState(false)

  // Editor Modal State
  const [showModal, setShowModal] = useState(false)
  const [editHolding, setEditHolding] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(POPULAR_CRYPTO_COINS)
  const [searching, setSearching] = useState(false)

  // Extract all active coin IDs from holdings
  const activeCoinIds = useMemo(() => {
    const ids = new Set(POPULAR_CRYPTO_COINS.map(c => c.id))
    holdings.forEach(h => {
      if (h.coinId) ids.add(h.coinId)
    })
    return Array.from(ids)
  }, [holdings])

  // Load and refresh live prices
  async function loadPrices(force = false) {
    setRefreshing(true)
    try {
      const res = await fetchLiveCryptoPrices(activeCoinIds, force)
      if (res?.prices) {
        setLivePrices(res.prices)
        setIsLive(res.isLive)
        setLastUpdated(res.updatedAt)
        if (typeof onPricesUpdated === 'function') {
          onPricesUpdated(res.prices)
        }
      }
    } catch (err) {
      console.warn('[CryptoPortfolio] Price update failed:', err)
    } finally {
      setRefreshing(false)
    }
  }

  // Initial load & 45s interval
  useEffect(() => {
    loadPrices(false)
    const interval = setInterval(() => {
      loadPrices(false)
    }, 45000)
    return () => clearInterval(interval)
  }, [activeCoinIds.join(',')])

  // Persist currency preference
  function handleCurrencyToggle(curr) {
    setVsCurrency(curr)
    if (typeof window !== 'undefined') {
      localStorage.setItem('buhay_crypto_vs_currency', curr)
    }
  }

  // Calculate overall metrics
  const metrics = useMemo(() => {
    return calculatePortfolioMetrics(holdings, livePrices, vsCurrency)
  }, [holdings, livePrices, vsCurrency])

  // Search handler for coin modal
  useEffect(() => {
    let active = true
    const timer = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults(POPULAR_CRYPTO_COINS)
        return
      }
      setSearching(true)
      const results = await searchCryptoCoins(searchQuery)
      if (active) {
        setSearchResults(results)
        setSearching(false)
      }
    }, 250)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [searchQuery])

  async function selectCoin(coin) {
    const quote = livePrices[coin.id] || {}
    const currKey = vsCurrency.toLowerCase()
    const currentLivePrice = quote[currKey] ? String(quote[currKey]) : ''

    setForm(prev => ({
      ...prev,
      coinId: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      buyPrice: currentLivePrice,
    }))

    // If price is not yet cached for an altcoin, fetch it instantly
    if (!currentLivePrice) {
      try {
        const res = await fetchLiveCryptoPrices([coin.id], true)
        if (res?.prices?.[coin.id]?.[currKey]) {
          const freshPrice = String(res.prices[coin.id][currKey])
          setLivePrices(prev => ({ ...prev, ...res.prices }))
          setForm(prev => (prev.coinId === coin.id ? { ...prev, buyPrice: freshPrice } : prev))
        }
      } catch (err) {
        console.warn('[crypto] Failed to fetch price for coin:', err)
      }
    }
  }

  function openAdd() {
    setEditHolding(null)
    const defaultCoin = POPULAR_CRYPTO_COINS[0]
    const quote = livePrices[defaultCoin.id] || {}
    const currKey = vsCurrency.toLowerCase()
    const currentLivePrice = quote[currKey] ? String(quote[currKey]) : ''

    setForm({
      ...EMPTY_FORM,
      coinId: defaultCoin.id,
      symbol: defaultCoin.symbol,
      name: defaultCoin.name,
      buyPrice: currentLivePrice,
    })
    setSearchQuery('')
    setShowModal(true)
  }

  function openEdit(holding) {
    setEditHolding(holding)
    setForm({
      coinId: holding.coinId || 'bitcoin',
      symbol: holding.symbol || 'BTC',
      name: holding.name || 'Bitcoin',
      quantity: String(holding.quantity ?? holding.shares ?? ''),
      buyPrice: String(holding.buyPrice ?? holding.price ?? ''),
      wallet: holding.wallet || 'Binance',
      notes: holding.notes || '',
    })
    setSearchQuery('')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditHolding(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave() {
    if (!form.coinId || !form.symbol) {
      notifyApp({ title: 'Select a coin', message: 'Please select a cryptocurrency.', tone: 'warning' })
      return
    }
    const qty = parseFloat(form.quantity)
    if (!qty || qty <= 0 || isNaN(qty)) {
      notifyApp({ title: 'Invalid quantity', message: 'Please enter a valid amount greater than 0.', tone: 'warning' })
      return
    }
    const buyP = parseFloat(form.buyPrice) || 0

    const payload = {
      coinId: form.coinId,
      symbol: form.symbol.toUpperCase(),
      name: form.name,
      quantity: qty,
      buyPrice: buyP,
      currency: vsCurrency,
      wallet: form.wallet || 'Wallet',
      notes: form.notes || '',
      updatedAt: Date.now(),
    }

    try {
      if (editHolding) {
        await fsUpdate(user.uid, 'portfolioHoldings', editHolding._id, payload)
        notifyApp({ title: 'Holding updated', message: `${payload.symbol} holding updated successfully.`, tone: 'positive' })
      } else {
        await fsAdd(user.uid, 'portfolioHoldings', { ...payload, createdAt: Date.now() })
        notifyApp({ title: 'Holding added', message: `${payload.symbol} added to your portfolio.`, tone: 'positive' })
      }
      closeModal()
      loadPrices(true)
    } catch (err) {
      console.error('[CryptoPortfolio] Save error:', err)
      notifyApp({ title: 'Save failed', message: 'Could not save crypto holding.', tone: 'danger' })
    }
  }

  async function handleDelete(holding) {
    const target = holding || editHolding
    if (!target) return

    const confirmed = await confirmApp({
      title: `Delete ${target.symbol}?`,
      message: `Are you sure you want to remove ${target.symbol} (${target.name}) from your portfolio?`,
      confirmLabel: 'Delete Holding',
      danger: true,
    })
    if (!confirmed) return

    try {
      await fsDel(user.uid, 'portfolioHoldings', target._id)
      notifyApp({ title: 'Holding deleted', message: `${target.symbol} removed.`, tone: 'neutral' })
      if (showModal) closeModal()
    } catch (err) {
      console.error('[CryptoPortfolio] Delete error:', err)
      notifyApp({ title: 'Delete failed', message: 'Could not delete holding.', tone: 'danger' })
    }
  }

  const s = metrics.currencySymbol

  // Format relative updated time
  const updatedAgo = useMemo(() => {
    if (!lastUpdated) return 'Syncing...'
    const diffSec = Math.floor((Date.now() - lastUpdated) / 1000)
    if (diffSec < 10) return 'Just now'
    if (diffSec < 60) return `${diffSec}s ago`
    return `${Math.floor(diffSec / 60)}m ago`
  }, [lastUpdated, refreshing])

  // Allocation Colors Palette
  const ALLOCATION_COLORS = ['#f7931a', '#627eea', '#14f195', '#26a17b', '#23292f', '#f3ba2f', '#0033ad', '#e84142', '#375bd2', '#e6007a']

  // Delta states for badges
  const has24hChange = Math.abs(metrics.total24hChangeAmount) > 0.05
  const is24hPositive = metrics.total24hChangeAmount > 0

  const hasPnl = metrics.totalCostBasis > 0 && Math.abs(metrics.totalPnlAmount) > 0.05
  const isPnlPositive = metrics.totalPnlAmount > 0

  return (
    <div className={styles.wrap}>
      {/* HERO PORTFOLIO PERFORMANCE CARD */}
      <div className={styles.heroCard}>
        <div className={styles.heroTop}>
          <div className={styles.heroTag}>
            <span className={styles.heroTitle}>🪙 Crypto Portfolio</span>
            <div className={styles.liveIndicator}>
              <span className={styles.liveDot} />
              <span>{refreshing ? 'Syncing...' : `Live · ${updatedAgo}`}</span>
            </div>
          </div>

          <div className={styles.heroControls}>
            <div className={styles.currencyToggle} role="group" aria-label="Quote Currency">
              <button
                type="button"
                className={`${styles.currencyBtn} ${vsCurrency === 'PHP' ? styles.currencyBtnActive : ''}`}
                onClick={() => handleCurrencyToggle('PHP')}
              >
                ₱ PHP
              </button>
              <button
                type="button"
                className={`${styles.currencyBtn} ${vsCurrency === 'USD' ? styles.currencyBtnActive : ''}`}
                onClick={() => handleCurrencyToggle('USD')}
              >
                $ USD
              </button>
            </div>

            <button
              type="button"
              className={`${styles.refreshBtn} ${refreshing ? styles.refreshing : ''}`}
              onClick={() => loadPrices(true)}
              title="Refresh live prices"
              aria-label="Refresh live crypto prices"
            >
              ↻
            </button>
          </div>
        </div>

        <div className={styles.heroMain}>
          <div className={styles.heroLabel}>Total Crypto Assets</div>
          <div className={styles.heroValue}>
            {privacyMode ? '••••' : fmt(metrics.totalCurrentValue, s)}
          </div>

          <div className={styles.heroBadges}>
            {/* 24h P&L Badge */}
            <div
              className={`${styles.badge} ${
                !has24hChange
                  ? styles.badgeNeutral
                  : is24hPositive
                  ? styles.badgePositive
                  : styles.badgeNegative
              }`}
            >
              <span>{has24hChange ? (is24hPositive ? '▲' : '▼') : '—'}</span>
              <span>
                {privacyMode
                  ? '••••'
                  : has24hChange
                  ? `${is24hPositive ? '+' : ''}${fmt(metrics.total24hChangeAmount, s)}`
                  : '0.00'}
              </span>
              <span>({has24hChange ? `${is24hPositive ? '+' : ''}${metrics.total24hPct.toFixed(2)}%` : '0.00%'})</span>
              <span className={styles.badgeLabel}>24h</span>
            </div>

            {/* All-Time P&L Badge */}
            {metrics.totalCostBasis > 0 && (
              <div
                className={`${styles.badge} ${
                  !hasPnl
                    ? styles.badgeNeutral
                    : isPnlPositive
                    ? styles.badgePositive
                    : styles.badgeNegative
                }`}
              >
                <span>{hasPnl ? (isPnlPositive ? '▲' : '▼') : '—'}</span>
                <span>
                  {privacyMode
                    ? '••••'
                    : hasPnl
                    ? `${isPnlPositive ? '+' : ''}${fmt(metrics.totalPnlAmount, s)}`
                    : '0.00'}
                </span>
                <span>({hasPnl ? `${isPnlPositive ? '+' : ''}${metrics.totalPnlPct.toFixed(1)}%` : '0.0%'})</span>
                <span className={styles.badgeLabel}>All-Time Return</span>
              </div>
            )}
          </div>
        </div>

        {/* ASSET ALLOCATION BAR */}
        {metrics.holdings.length > 0 && (
          <div className={styles.allocationSection}>
            <div className={styles.allocationBar}>
              {metrics.holdings.map((h, i) => (
                <div
                  key={h._id || h.coinId || i}
                  className={styles.allocationSegment}
                  style={{
                    width: `${Math.max(2, h.allocationPct)}%`,
                    backgroundColor: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length],
                  }}
                  title={`${h.symbol}: ${h.allocationPct.toFixed(1)}%`}
                />
              ))}
            </div>
            <div className={styles.allocationLegend}>
              {metrics.holdings.slice(0, 4).map((h, i) => (
                <div key={h._id || h.coinId || i} className={styles.legendItem}>
                  <span
                    className={styles.legendDot}
                    style={{ backgroundColor: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length] }}
                  />
                  <span>{h.symbol}</span>
                  <span className={styles.legendPct}>{h.allocationPct.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SECTION HEADER & ADD BUTTON */}
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>
          Holdings ({metrics.holdings.length})
        </div>
        <button type="button" className={styles.addBtn} onClick={openAdd}>
          <span>+</span>
          <span>Add Holding</span>
        </button>
      </div>

      {/* HOLDINGS LIST */}
      {metrics.holdings.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🪙</div>
          <div className={styles.emptyTitle}>No crypto holdings yet</div>
          <div className={styles.emptyDesc}>
            Track your Bitcoin, Ethereum, Solana, and other coins with real-time market prices.
          </div>
          <button type="button" className={styles.addBtn} onClick={openAdd}>
            + Add your first coin
          </button>
        </div>
      ) : (
        <div className={styles.holdingsList}>
          {metrics.holdings.map(h => {
            const hasHolding24h = Math.abs(h.change24hPct) > 0.01
            const isHolding24hPos = h.change24hPct > 0

            const hasHoldingPnl = h.costBasis > 0 && Math.abs(h.pnlAmount) > 0.05
            const isHoldingPnlPos = h.pnlAmount > 0

            const avatarBg = COIN_GRADIENTS[h.coinId] || 'linear-gradient(135deg, #3a3a4c, #222230)'

            return (
              <div
                key={h._id}
                className={styles.holdingCard}
                onClick={() => openEdit(h)}
                role="button"
                tabIndex={0}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && openEdit(h)}
                aria-label={`Holding ${h.symbol}, tap to edit`}
              >
                <div className={styles.holdingLeft}>
                  <div className={styles.coinAvatar} style={{ background: avatarBg }}>
                    {POPULAR_CRYPTO_COINS.find(c => c.id === h.coinId)?.icon || '🪙'}
                  </div>
                  <div className={styles.coinInfo}>
                    <div className={styles.coinHeader}>
                      <span className={styles.coinSymbol}>{h.symbol}</span>
                      <span className={styles.walletBadge}>{h.wallet}</span>
                    </div>
                    <div className={styles.coinName}>{h.name}</div>
                    <div className={styles.coinSub}>
                      {h.qty} {h.symbol} · Live: {fmt(h.livePrice, s)}
                    </div>
                  </div>
                </div>

                <div className={styles.holdingRight}>
                  <div className={styles.holdingValues}>
                    <div className={styles.holdingTotal}>
                      {privacyMode ? '••••' : fmt(h.currentValue, s)}
                    </div>
                    <div
                      className={`${styles.holdingPnl} ${
                        !hasHolding24h
                          ? styles.badgeNeutral
                          : isHolding24hPos
                          ? styles.badgePositive
                          : styles.badgeNegative
                      }`}
                    >
                      {hasHolding24h ? (isHolding24hPos ? '▲ +' : '▼ ') : '— '}
                      {hasHolding24h ? `${h.change24hPct.toFixed(2)}%` : '0.00%'} (24h)
                    </div>
                    {h.costBasis > 0 && (
                      <div
                        className={styles.coinSub}
                        style={{
                          color: !hasHoldingPnl
                            ? 'var(--text3)'
                            : isHoldingPnlPos
                            ? 'var(--income)'
                            : 'var(--expense)',
                        }}
                      >
                        {hasHoldingPnl ? (isHoldingPnlPos ? '+' : '') : ''}
                        {privacyMode ? '••••' : hasHoldingPnl ? fmt(h.pnlAmount, s) : '₱0.00'}{' '}
                        ({hasHoldingPnl ? `${isHoldingPnlPos ? '+' : ''}${h.pnlPct.toFixed(1)}%` : '0.0%'})
                      </div>
                    )}
                  </div>

                  <span className={styles.holdingChevron} aria-hidden="true">›</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* QUICK-ADD & EDIT MODAL */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                {editHolding ? `Edit ${editHolding.symbol}` : 'Add Crypto Holding'}
              </div>
              <button type="button" className={styles.modalClose} onClick={closeModal} aria-label="Close modal">
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* Quick Pick Chips */}
              {!editHolding && (
                <div className={styles.formGroup}>
                  <label className={styles.chipsLabel}>Popular Cryptos</label>
                  <div className={styles.quickChips}>
                    {POPULAR_CRYPTO_COINS.slice(0, 8).map(c => {
                      const selected = form.coinId === c.id
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className={`${styles.chip} ${selected ? styles.chipSelected : ''}`}
                          onClick={() => selectCoin(c)}
                        >
                          <span>{c.icon}</span>
                          <span>{c.symbol}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Search Altcoins */}
              {!editHolding && (
                <div className={styles.formGroup}>
                  <label className={styles.label}>Or Search Any Coin</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Search Bitcoin, Solana, XRP..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  {searchQuery.trim() && (
                    <div className={styles.quickChips} style={{ marginTop: 6 }}>
                      {searchResults.slice(0, 6).map(c => (
                        <button
                          key={c.id}
                          type="button"
                          className={`${styles.chip} ${form.coinId === c.id ? styles.chipSelected : ''}`}
                          onClick={() => selectCoin(c)}
                        >
                          <span>{c.icon || '🪙'}</span>
                          <span>{c.symbol}</span>
                          <span style={{ opacity: 0.7, fontSize: 11 }}>({c.name})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Selected Coin Banner */}
              <div className={styles.formGroup}>
                <div className={styles.inputHelper}>
                  Selected: <strong>{form.name} ({form.symbol})</strong> · Live Quote:{' '}
                  <strong>
                    {fmt(livePrices[form.coinId]?.[vsCurrency.toLowerCase()] || 0, s)}
                  </strong>
                </div>
              </div>

              {/* Quantity & Buy Price */}
              <div className={styles.inputRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Quantity Owned *</label>
                  <input
                    type="number"
                    step="any"
                    className={styles.input}
                    placeholder="e.g. 0.05"
                    value={form.quantity}
                    onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
                    autoFocus={!editHolding}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Buy Price per Coin ({s})</label>
                  <input
                    type="number"
                    step="any"
                    className={styles.input}
                    placeholder={`e.g. ${livePrices[form.coinId]?.[vsCurrency.toLowerCase()] || 3800000}`}
                    value={form.buyPrice}
                    onChange={e => setForm(p => ({ ...p, buyPrice: e.target.value }))}
                  />
                  <span className={styles.inputHelper}>Auto-filled with market price</span>
                </div>
              </div>

              {/* Wallet & Storage */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Wallet / Exchange</label>
                <select
                  className={styles.select}
                  value={form.wallet}
                  onChange={e => setForm(p => ({ ...p, wallet: e.target.value }))}
                >
                  {CRYPTO_WALLETS.map(w => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Notes (Optional)</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. DCA on Binance, cold storage"
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              {editHolding && (
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => handleDelete(editHolding)}
                >
                  Delete Holding
                </button>
              )}
              <div className={styles.footerRight}>
                <button type="button" className={styles.cancelBtn} onClick={closeModal}>
                  Cancel
                </button>
                <button type="button" className={styles.saveBtn} onClick={handleSave}>
                  {editHolding ? 'Save Changes' : 'Add to Portfolio'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
