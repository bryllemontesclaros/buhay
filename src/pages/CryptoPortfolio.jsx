import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { fsAdd, fsDel, fsUpdate } from '../lib/firestore'
import { confirmApp, notifyApp } from '../lib/appFeedback'
import { fmt, maskMoney, playTick } from '../lib/utils'
import {
  calculatePortfolioMetrics,
  COIN_GRADIENTS,
  CRYPTO_WALLETS,
  DEFAULT_FOREX_RATE,
  formatCryptoValue,
  getCachedPrices,
  POPULAR_CRYPTO_COINS,
  searchCryptoCoins,
  setCachedPrices,
} from '../lib/crypto'
import styles from './CryptoPortfolio.module.css'

const EMPTY_FORM = {
  coinId: 'bitcoin',
  symbol: 'BTC',
  name: 'Bitcoin',
  quantity: '',
  buyPrice: '',
  buyCurrency: 'USD',
  currentPrice: '',
  wallet: 'Binance',
  notes: '',
  isCustom: false,
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

  const [userPrices, setUserPrices] = useState(() => {
    const cached = getCachedPrices()
    return cached?.data || {}
  })

  // Quick Price Update Modal State
  const [showPriceModal, setShowPriceModal] = useState(false)
  const [priceForm, setPriceForm] = useState({})

  // Add / Edit Holding Modal State
  const [showHoldingModal, setShowHoldingModal] = useState(false)
  const [editHolding, setEditHolding] = useState(null)
  const [holdingForm, setHoldingForm] = useState(EMPTY_FORM)
  const [searchQuery, setSearchQuery] = useState('')

  // Persist currency preference
  function handleCurrencyToggle(curr) {
    playTick()
    setVsCurrency(curr)
    if (typeof window !== 'undefined') {
      localStorage.setItem('buhay_crypto_vs_currency', curr)
    }
  }

  // Calculate overall metrics
  const metrics = useMemo(() => {
    return calculatePortfolioMetrics(holdings, userPrices, vsCurrency, DEFAULT_FOREX_RATE)
  }, [holdings, userPrices, vsCurrency])

  // Sync prices with parent listeners
  useEffect(() => {
    if (typeof onPricesUpdated === 'function') {
      onPricesUpdated(userPrices)
    }
  }, [userPrices, onPricesUpdated])

  // ==========================================
  // QUICK PRICE UPDATE MODAL LOGIC
  // ==========================================
  function openPriceModal() {
    playTick()
    const initial = {}
    const isUsd = vsCurrency === 'USD'

    metrics.holdings.forEach(h => {
      const key = h.coinId || h.symbol.toLowerCase()
      initial[key] = h.currentPrice > 0 ? String(h.currentPrice) : ''
    })

    setPriceForm(initial)
    setShowPriceModal(true)
  }

  function closePriceModal() {
    setShowPriceModal(false)
  }

  function handlePriceInputChange(coinKey, val) {
    setPriceForm(prev => ({
      ...prev,
      [coinKey]: val,
    }))
  }

  function saveQuickPrices() {
    playTick()
    const updated = { ...userPrices }
    const isUsd = vsCurrency === 'USD'

    Object.entries(priceForm).forEach(([coinKey, priceVal]) => {
      const p = parseFloat(priceVal) || 0
      if (p > 0) {
        const quoteObj = {
          usd: isUsd ? p : p / DEFAULT_FOREX_RATE,
          php: isUsd ? p * DEFAULT_FOREX_RATE : p,
        }
        updated[coinKey] = quoteObj
        updated[coinKey.toUpperCase()] = quoteObj
        updated[coinKey.toLowerCase()] = quoteObj
      }
    })

    setUserPrices(updated)
    setCachedPrices(updated, DEFAULT_FOREX_RATE)
    setShowPriceModal(false)
    notifyApp({ title: 'Prices Updated', message: 'Portfolio recalculated with your updated prices.', tone: 'positive' })
  }

  // Preview total value inside quick price modal
  const modalLiveTotal = useMemo(() => {
    let total = 0
    metrics.holdings.forEach(h => {
      const key = h.coinId || h.symbol.toLowerCase()
      const enteredPrice = parseFloat(priceForm[key]) || h.currentPrice || 0
      total += h.qty * enteredPrice
    })
    return total
  }, [metrics.holdings, priceForm])

  // Lock background body scrolling when modal is open
  useEffect(() => {
    if (showHoldingModal || showPriceModal) {
      const prevBodyOverflow = document.body.style.overflow
      const prevHtmlOverflow = document.documentElement.style.overflow
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prevBodyOverflow
        document.documentElement.style.overflow = prevHtmlOverflow
      }
    }
  }, [showHoldingModal, showPriceModal])

  // ==========================================
  // ADD / EDIT HOLDING MODAL LOGIC
  // ==========================================
  function openAddHolding() {
    playTick()
    setEditHolding(null)
    const defaultCoin = POPULAR_CRYPTO_COINS[0]

    setHoldingForm({
      ...EMPTY_FORM,
      coinId: defaultCoin.id,
      symbol: defaultCoin.symbol,
      name: defaultCoin.name,
      buyCurrency: vsCurrency,
      buyPrice: '',
      currentPrice: '',
    })
    setSearchQuery('')
    setShowHoldingModal(true)
  }

  function openEditHolding(h) {
    if (!h) return
    try {
      playTick()
      setEditHolding(h)
      const targetCurrency = String(h.holdingCurrency || h.currency || vsCurrency || 'USD').toUpperCase()
      const isUsd = targetCurrency === 'USD'
      
      const quote = getHoldingQuote(h, userPrices)
      let resolvedCurrentPrice = ''
      if (quote && (quote.usd !== undefined || quote.php !== undefined)) {
        resolvedCurrentPrice = isUsd 
          ? (quote.usd ?? (quote.php ? quote.php / DEFAULT_FOREX_RATE : ''))
          : (quote.php ?? (quote.usd ? quote.usd * DEFAULT_FOREX_RATE : ''))
      } else if (Number(h.currentPrice) > 0) {
        if (vsCurrency === 'PHP' && isUsd) {
          resolvedCurrentPrice = Number(h.currentPrice) / DEFAULT_FOREX_RATE
        } else if (vsCurrency === 'USD' && !isUsd) {
          resolvedCurrentPrice = Number(h.currentPrice) * DEFAULT_FOREX_RATE
        } else {
          resolvedCurrentPrice = h.currentPrice
        }
      }

      const rawBuy = h.rawBuyPrice ?? h.buyPrice ?? h.unitBuyPrice ?? ''
      const qtyVal = h.quantity ?? h.qty ?? h.shares ?? ''

      setHoldingForm({
        coinId: h.coinId || (h.symbol ? String(h.symbol).toLowerCase() : 'bitcoin'),
        symbol: String(h.symbol || 'BTC').toUpperCase(),
        name: h.name || h.symbol || 'Bitcoin',
        quantity: qtyVal !== '' ? String(qtyVal) : '',
        buyPrice: rawBuy !== '' ? String(rawBuy) : '',
        buyCurrency: targetCurrency,
        currentPrice: resolvedCurrentPrice !== '' ? String(resolvedCurrentPrice) : (rawBuy !== '' ? String(rawBuy) : ''),
        wallet: h.wallet || 'Binance',
        notes: h.notes || '',
        isCustom: Boolean(h.isCustom),
      })
      setSearchQuery('')
      setShowHoldingModal(true)
    } catch (err) {
      console.error('[CryptoPortfolio] Error opening edit holding modal:', err)
      setEditHolding(h)
      setHoldingForm({
        coinId: h?.coinId || 'bitcoin',
        symbol: String(h?.symbol || 'BTC').toUpperCase(),
        name: h?.name || 'Crypto',
        quantity: String(h?.quantity || h?.qty || 1),
        buyPrice: String(h?.buyPrice || h?.rawBuyPrice || ''),
        buyCurrency: vsCurrency,
        currentPrice: String(h?.currentPrice || ''),
        wallet: h?.wallet || 'Binance',
        notes: h?.notes || '',
        isCustom: false,
      })
      setShowHoldingModal(true)
    }
  }

  function closeHoldingModal() {
    setShowHoldingModal(false)
    setEditHolding(null)
    setHoldingForm(EMPTY_FORM)
  }

  function selectCoin(c) {
    playTick()
    setHoldingForm(prev => ({
      ...prev,
      coinId: c.id,
      symbol: c.symbol,
      name: c.name,
      isCustom: false,
    }))
  }

  async function handleSaveHolding() {
    if (!holdingForm.symbol) {
      notifyApp({ title: 'Enter symbol', message: 'Please enter a crypto symbol.', tone: 'warning' })
      return
    }
    const qty = parseFloat(holdingForm.quantity)
    if (!qty || qty <= 0 || isNaN(qty)) {
      notifyApp({ title: 'Invalid quantity', message: 'Please enter a valid quantity greater than 0.', tone: 'warning' })
      return
    }
    const buyP = parseFloat(holdingForm.buyPrice) || 0
    const currentP = parseFloat(holdingForm.currentPrice) || buyP

    const payload = {
      coinId: (holdingForm.coinId || holdingForm.symbol).toLowerCase(),
      symbol: holdingForm.symbol.toUpperCase(),
      name: holdingForm.name || holdingForm.symbol.toUpperCase(),
      quantity: qty,
      buyPrice: buyP,
      currentPrice: currentP,
      price: currentP,
      currency: holdingForm.buyCurrency || vsCurrency,
      wallet: holdingForm.wallet || 'Binance',
      notes: holdingForm.notes || '',
      isCustom: Boolean(holdingForm.isCustom),
      updatedAt: Date.now(),
    }

    const holdingId = editHolding?._id || editHolding?.id

    try {
      if (holdingId) {
        await fsUpdate(user.uid, 'portfolioHoldings', holdingId, payload)
        notifyApp({ title: 'Holding updated', message: `${payload.symbol} holding saved.`, tone: 'positive' })
      } else {
        await fsAdd(user.uid, 'portfolioHoldings', payload)
        notifyApp({ title: 'Holding added', message: `${payload.symbol} added to your portfolio.`, tone: 'positive' })
      }

      // Update user's price map with current price across all lookup keys
      if (currentP > 0) {
        const isUsd = (holdingForm.buyCurrency || vsCurrency) === 'USD'
        const quoteObj = {
          usd: isUsd ? currentP : currentP / DEFAULT_FOREX_RATE,
          php: isUsd ? currentP * DEFAULT_FOREX_RATE : currentP,
        }
        const coinId = payload.coinId.toLowerCase()
        const symbol = payload.symbol.toUpperCase()
        const symLower = symbol.toLowerCase()
        const updated = {
          ...userPrices,
          [coinId]: quoteObj,
          [symbol]: quoteObj,
          [symLower]: quoteObj,
        }
        setUserPrices(updated)
        setCachedPrices(updated, DEFAULT_FOREX_RATE)
      }

      closeHoldingModal()
    } catch (err) {
      console.error('[CryptoPortfolio] Save error:', err)
      notifyApp({ title: 'Save failed', message: 'Could not save holding.', tone: 'danger' })
    }
  }

  async function handleDeleteHolding() {
    const holdingId = editHolding?._id || editHolding?.id
    if (!holdingId) return
    const symbol = editHolding?.symbol || 'holding'
    const name = editHolding?.name || 'Crypto'

    const confirmed = await confirmApp({
      title: `Delete ${symbol}?`,
      message: `Are you sure you want to remove this ${name} holding?`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger',
    })
    if (!confirmed) return

    try {
      await fsDel(user.uid, 'portfolioHoldings', holdingId)
      notifyApp({ title: 'Holding deleted', message: `${symbol} removed.`, tone: 'neutral' })
      closeHoldingModal()
    } catch (err) {
      console.error('[CryptoPortfolio] Delete error:', err)
      notifyApp({ title: 'Delete failed', message: 'Could not delete holding.', tone: 'danger' })
    }
  }

  const s = metrics.currencySymbol
  const hasPnl = metrics.totalCostBasis > 0 && Math.abs(metrics.totalPnlAmount) > 0.05
  const isPnlPositive = metrics.totalPnlAmount >= 0

  const filteredCoins = useMemo(() => {
    return searchCryptoCoins(searchQuery)
  }, [searchQuery])

  const ALLOCATION_COLORS = ['#f7931a', '#627eea', '#14f195', '#38ef7d', '#375bd2', '#f4b728', '#ff007a', '#2775ca', '#e84142', '#4da2ff', '#0033ad']

  return (
    <div className={styles.wrap}>
      {/* HERO PORTFOLIO PERFORMANCE CARD */}
      <div className={styles.heroCard}>
        <div className={styles.heroTop}>
          <div className={styles.heroTag}>
            <span className={styles.heroTitle}>🪙 Crypto Portfolio</span>
          </div>

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
        </div>

        <div className={styles.heroMain}>
          <div className={styles.heroLabelRow}>
            <span className={styles.heroLabel}>Total Crypto Assets</span>
            <span className={styles.userValuationBadge}>Exact Valuation</span>
          </div>
          <div className={styles.heroValue}>
            {privacyMode ? '••••' : formatCryptoValue(metrics.totalCurrentValue, s, 2)}
          </div>

          <div className={styles.heroBottomRow}>
            <div className={styles.heroPnlWrap}>
              {hasPnl && (
                <div className={`${styles.pnlBadge} ${isPnlPositive ? styles.badgePositive : styles.badgeNegative}`}>
                  <span>{isPnlPositive ? '▲ +' : '▼ -'}</span>
                  <span>{formatCryptoValue(Math.abs(metrics.totalPnlAmount), s, 2)}</span>
                  <span>({metrics.totalPnlPct.toFixed(1)}%) All-Time</span>
                </div>
              )}
            </div>

            <button
              type="button"
              className={styles.updatePricesBtn}
              onClick={openPriceModal}
              title="Update current asset prices"
            >
              ⚡ Update Prices
            </button>
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
              {metrics.holdings.slice(0, 5).map((h, i) => (
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
        <button type="button" className={styles.addBtn} onClick={openAddHolding}>
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
            Track your Bitcoin, Ethereum, Solana, LINK, HYPE, TAO, and other tokens with exact current prices.
          </div>
          <button type="button" className={styles.addBtn} onClick={openAddHolding}>
            + Add your first coin
          </button>
        </div>
      ) : (
        <div className={styles.holdingsList}>
          {metrics.holdings.map(h => {
            const hasHoldingPnl = h.costBasis > 0 && Math.abs(h.pnlAmount) > 0.05
            const isHoldingPnlPos = h.pnlAmount >= 0
            const avatarBg = COIN_GRADIENTS[h.coinId] || 'linear-gradient(135deg, #3a3a4c, #222230)'
            const coinIcon = POPULAR_CRYPTO_COINS.find(c => c.id === h.coinId || c.symbol === h.symbol)?.icon || '🪙'

            return (
              <div
                key={h._id || h.id || h.symbol}
                className={styles.holdingCard}
                onClick={() => openEditHolding(h)}
                role="button"
                tabIndex={0}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && openEditHolding(h)}
                aria-label={`Holding ${h.symbol}, tap to edit`}
              >
                <div className={styles.holdingLeft}>
                  <div className={styles.coinAvatar} style={{ background: avatarBg }}>
                    {coinIcon}
                  </div>
                  <div className={styles.coinInfo}>
                    <div className={styles.coinHeader}>
                      <span className={styles.coinSymbol}>{h.symbol}</span>
                      <span className={styles.walletBadge}>{h.wallet}</span>
                    </div>
                    <div className={styles.coinName}>{h.name}</div>
                    <div className={styles.coinSub}>
                      {h.qty} {h.symbol} · {formatCryptoValue(h.currentPrice, s, 4)} / coin
                    </div>
                  </div>
                </div>

                <div className={styles.holdingRight}>
                  <div className={styles.holdingValues}>
                    <div className={styles.holdingTotal}>
                      {privacyMode ? '••••' : formatCryptoValue(h.currentValue, s, 2)}
                    </div>
                    {hasHoldingPnl && (
                      <div
                        className={`${styles.holdingPnl} ${
                          isHoldingPnlPos ? styles.badgePositive : styles.badgeNegative
                        }`}
                      >
                        {isHoldingPnlPos ? '+' : '-'}{formatCryptoValue(Math.abs(h.pnlAmount), s, 2)} ({h.pnlPct.toFixed(1)}%)
                      </div>
                    )}
                  </div>
                  <span className={styles.cardChevron} aria-hidden="true">›</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* QUICK PRICE UPDATE MODAL */}
      {showPriceModal && typeof document !== 'undefined' && createPortal(
        <div className={styles.modalOverlay} onClick={closePriceModal}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>⚡ Update Asset Prices ({vsCurrency})</div>
              <button type="button" className={styles.modalClose} onClick={closePriceModal}>✕</button>
            </div>

            <div className={styles.quickPriceDesc}>
              Input the current market price for each token from your exchange app.
            </div>

            <div className={styles.quickPriceList}>
              {metrics.holdings.map(h => {
                const key = h.coinId || h.symbol.toLowerCase()
                const val = priceForm[key] !== undefined ? priceForm[key] : (h.currentPrice || '')
                const numVal = parseFloat(val) || 0
                const computedVal = h.qty * numVal
                const coinIcon = POPULAR_CRYPTO_COINS.find(c => c.id === h.coinId || c.symbol === h.symbol)?.icon || '🪙'

                return (
                  <div key={h._id || key} className={styles.quickPriceItem}>
                    <div className={styles.quickPriceCoin}>
                      <span className={styles.quickPriceIcon}>{coinIcon}</span>
                      <div>
                        <div className={styles.quickPriceSymbol}>{h.symbol}</div>
                        <div className={styles.quickPriceQty}>{h.qty} {h.symbol}</div>
                      </div>
                    </div>

                    <div className={styles.quickPriceInputWrap}>
                      <div className={styles.inputPrefixWrap}>
                        <span className={styles.inputPrefix}>{s}</span>
                        <input
                          type="number"
                          step="any"
                          className={styles.quickInput}
                          value={val}
                          onChange={e => handlePriceInputChange(key, e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div className={styles.quickItemTotal}>
                        Total: {formatCryptoValue(computedVal, s, 2)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className={styles.quickModalFooter}>
              <div className={styles.quickTotalPreview}>
                <span>Updated Portfolio Total:</span>
                <strong>{formatCryptoValue(modalLiveTotal, s, 2)}</strong>
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={closePriceModal}>Cancel</button>
                <button type="button" className={styles.btnPrimary} onClick={saveQuickPrices}>Save & Update Portfolio</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ADD / EDIT HOLDING MODAL */}
      {showHoldingModal && typeof document !== 'undefined' && createPortal(
        <div className={styles.modalOverlay} onClick={closeHoldingModal}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                {editHolding ? `Edit ${editHolding.symbol}` : 'Add Crypto Holding'}
              </div>
              <button type="button" className={styles.modalClose} onClick={closeHoldingModal}>✕</button>
            </div>

            {/* COIN SELECTOR */}
            {!editHolding && (
              <div className={styles.formGroup}>
                <label className={styles.label}>Select Cryptocurrency</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Search BTC, ETH, LINK, HYPE, TAO, ZEC, UNI..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />

                <div className={styles.coinPillsWrap}>
                  {filteredCoins.slice(0, 12).map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className={`${styles.coinPill} ${holdingForm.coinId === c.id ? styles.coinPillActive : ''}`}
                      onClick={() => selectCoin(c)}
                    >
                      <span>{c.icon}</span>
                      <span>{c.symbol}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ROW 1: QUANTITY + WALLET */}
            <div className={styles.formRow2}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Quantity Held</label>
                <input
                  type="number"
                  step="any"
                  className={styles.input}
                  placeholder="e.g. 1.0715"
                  value={holdingForm.quantity}
                  onChange={e => setHoldingForm(prev => ({ ...prev, quantity: e.target.value }))}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Wallet / Exchange</label>
                <select
                  className={styles.select}
                  value={holdingForm.wallet}
                  onChange={e => setHoldingForm(prev => ({ ...prev, wallet: e.target.value }))}
                >
                  {CRYPTO_WALLETS.map(w => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ROW 2: BUY PRICE & CURRENCY */}
            <div className={styles.formRow2}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Buy Price per Coin</label>
                <input
                  type="number"
                  step="any"
                  className={styles.input}
                  placeholder="e.g. 2400.00"
                  value={holdingForm.buyPrice}
                  onChange={e => setHoldingForm(prev => ({ ...prev, buyPrice: e.target.value }))}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Buy Currency</label>
                <select
                  className={styles.select}
                  value={holdingForm.buyCurrency}
                  onChange={e => setHoldingForm(prev => ({ ...prev, buyCurrency: e.target.value }))}
                >
                  <option value="USD">$ USD</option>
                  <option value="PHP">₱ PHP</option>
                </select>
              </div>
            </div>

            {/* ROW 3: CURRENT ASSET PRICE */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Current Asset Price ({holdingForm.buyCurrency})</label>
              <input
                type="number"
                step="any"
                className={styles.input}
                placeholder="e.g. 2513.45"
                value={holdingForm.currentPrice}
                onChange={e => setHoldingForm(prev => ({ ...prev, currentPrice: e.target.value }))}
              />
            </div>

            {/* MODAL ACTIONS */}
            <div className={styles.modalActions}>
              {editHolding && (
                <button
                  type="button"
                  className={styles.btnDanger}
                  onClick={handleDeleteHolding}
                >
                  Delete
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button type="button" className={styles.btnSecondary} onClick={closeHoldingModal}>
                Cancel
              </button>
              <button type="button" className={styles.btnPrimary} onClick={handleSaveHolding}>
                {editHolding ? 'Save Changes' : 'Add Holding'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
