import React, { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { fsSavePortfolioHolding, fsDeletePortfolioHolding } from '../lib/firestore'
import { fetchCryptoPrices, POPULAR_ASSETS } from '../lib/portfolio'
import { notifyApp } from '../lib/appFeedback'
import styles from './PortfolioWidget.module.css'

export default function PortfolioWidget({ user, data = {}, s = '₱', privacyMode = false }) {
  const [showPortfolioModal, setShowPortfolioModal] = useState(false)
  const [showAllHoldingsModal, setShowAllHoldingsModal] = useState(false)
  const [editingHolding, setEditingHolding] = useState(null)
  const [isSavingHolding, setIsSavingHolding] = useState(false)
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false)
  const [isPricesLoading, setIsPricesLoading] = useState(true)
  const [livePrices, setLivePrices] = useState({})
  const [lastUpdatedStr, setLastUpdatedStr] = useState('')

  const loadPricesRef = useRef(null)
  const livePricesRef = useRef({})
  const quantityInputRef = useRef(null)

  const [selectedPresetId, setSelectedPresetId] = useState('')
  const [portfolioForm, setPortfolioForm] = useState({
    assetType: 'crypto',
    symbol: '',
    name: '',
    quantity: '',
    averageBuyPrice: ''
  })

  // Lock background scrolling when modal is active
  useEffect(() => {
    if (showPortfolioModal || showAllHoldingsModal) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [showPortfolioModal, showAllHoldingsModal])

  // Safely extract holdings array from Firestore data
  const holdings = useMemo(() => {
    return Array.isArray(data?.portfolioHoldings) ? data.portfolioHoldings.filter(Boolean) : []
  }, [data?.portfolioHoldings])

  // Collect unique crypto ticker symbols from presets and user holdings
  const targetSymbols = useMemo(() => {
    const fromHoldings = holdings.map(h => String(h?.symbol || '').trim().toUpperCase()).filter(Boolean)
    const fromPresets = POPULAR_ASSETS.map(a => a.symbol.toUpperCase())
    return Array.from(new Set([...fromHoldings, ...fromPresets]))
  }, [holdings])

  // Fetch live market prices in background + auto-refresh every 30s
  useEffect(() => {
    let isMounted = true

    async function loadPrices() {
      try {
        const prices = await fetchCryptoPrices(targetSymbols, s)
        if (isMounted) {
          setLivePrices(prev => ({ ...prev, ...prices }))
          setLastUpdatedStr(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
          setIsPricesLoading(false)
        }
      } catch (err) {
        console.warn('PortfolioWidget: live price fetch error:', err)
        if (isMounted) setIsPricesLoading(false)
      }
    }

    loadPricesRef.current = loadPrices
    loadPrices()

    const interval = setInterval(loadPrices, 30000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [targetSymbols, s])

  const handleManualRefresh = async () => {
    if (isRefreshingPrices || !loadPricesRef.current) return
    setIsRefreshingPrices(true)
    try {
      await loadPricesRef.current()
      notifyApp({
        title: 'Prices Refreshed',
        message: 'Synced fresh market rates from exchange orderbooks.',
        tone: 'positive'
      })
    } catch (err) {
      console.warn('Manual price refresh error:', err)
    } finally {
      setTimeout(() => setIsRefreshingPrices(false), 500)
    }
  }

  useEffect(() => {
    livePricesRef.current = livePrices
  }, [livePrices])

  // Fetch live price immediately when typing a custom symbol in modal
  useEffect(() => {
    if (!showPortfolioModal || !portfolioForm.symbol) return
    const sym = portfolioForm.symbol.trim().toUpperCase()
    if (!sym || (livePricesRef.current[sym] && livePricesRef.current[sym] > 0)) return

    const timer = setTimeout(async () => {
      try {
        const liveMap = await fetchCryptoPrices([sym], s)
        if (liveMap[sym] && liveMap[sym] > 0) {
          setLivePrices(prev => ({ ...prev, [sym]: liveMap[sym] }))
        }
      } catch (err) {
        console.warn('Live ticker fetch failed gracefully:', err)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [portfolioForm.symbol, showPortfolioModal, s])

  // Helper number formatter with privacyMode support and small decimal precision
  const fmt = (num) => {
    if (privacyMode) return `${s} •••••`
    const val = Number(num) || 0
    const maxDigits = (val > 0 && val < 1) ? 6 : 2
    return `${s} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: maxDigits })}`
  }

  // Calculate overall portfolio metrics dynamically using live market prices
  const portfolioSummary = useMemo(() => {
    let totalVal = 0
    let totalCost = 0

    holdings.forEach(asset => {
      const qty = parseFloat(asset?.quantity ?? asset?.shares ?? 0) || 0
      const symbol = asset?.symbol ? String(asset.symbol).toUpperCase() : ''
      const livePrice = livePrices[symbol] || 0
      const avgBuyPrice = parseFloat(asset?.averageBuyPrice ?? asset?.avgPrice ?? 0) || 0
      const effectivePrice = livePrice > 0 ? livePrice : avgBuyPrice

      totalVal += qty * effectivePrice
      totalCost += qty * (avgBuyPrice > 0 ? avgBuyPrice : effectivePrice)
    })

    const totalProfit = totalVal - totalCost
    return { totalVal, totalProfit }
  }, [holdings, livePrices])

  const openAddPortfolioHolding = (holding = null) => {
    if (holding) {
      setEditingHolding(holding)
      setSelectedPresetId('custom')
      setPortfolioForm({
        assetType: 'crypto',
        symbol: holding.symbol || '',
        name: holding.name || '',
        quantity: String(holding.quantity ?? holding.shares ?? ''),
        averageBuyPrice: String(holding.averageBuyPrice ?? holding.avgPrice ?? '')
      })
    } else {
      setEditingHolding(null)
      setSelectedPresetId('')
      setPortfolioForm({
        assetType: 'crypto',
        symbol: '',
        name: '',
        quantity: '',
        averageBuyPrice: ''
      })
    }
    setShowPortfolioModal(true)
  }

  const handleSelectPresetAsset = async (presetId) => {
    setSelectedPresetId(presetId)
    if (!presetId || presetId === 'custom') return

    const assetPreset = POPULAR_ASSETS.find(a => a.id === presetId)
    if (!assetPreset) return

    setPortfolioForm(prev => ({
      ...prev,
      assetType: 'crypto',
      symbol: assetPreset.symbol,
      name: assetPreset.name
    }))

    // Fetch fresh live market price if not already cached
    if (!livePrices[assetPreset.symbol]) {
      try {
        const liveMap = await fetchCryptoPrices([assetPreset.symbol], s)
        if (liveMap[assetPreset.symbol]) {
          setLivePrices(prev => ({ ...prev, [assetPreset.symbol]: liveMap[assetPreset.symbol] }))
        }
      } catch (err) {
        console.warn('Preset price fetch error:', err)
      }
    }

    // Auto-focus quantity field after selection
    setTimeout(() => {
      if (quantityInputRef.current) {
        quantityInputRef.current.focus()
      }
    }, 100)
  }

  const closePortfolioModal = () => {
    setShowPortfolioModal(false)
    setEditingHolding(null)
  }

  const handleSavePortfolioHolding = async (e) => {
    if (e) e.preventDefault()
    if (!user?.uid) {
      notifyApp({ title: 'Sign-in required', message: 'You must be signed in to manage portfolio assets.', tone: 'warning' })
      return
    }

    const name = (portfolioForm.name || '').trim()
    const symbol = (portfolioForm.symbol || '').trim().toUpperCase()
    const quantity = parseFloat(portfolioForm.quantity)
    const parsedBuy = parseFloat(portfolioForm.averageBuyPrice)

    if (!name && !symbol) {
      notifyApp({ title: 'Asset Identifier Required', message: 'Select a preset or enter a ticker symbol.', tone: 'warning' })
      return
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      notifyApp({ title: 'Invalid Quantity', message: 'Quantity must be a positive number.', tone: 'warning' })
      return
    }

    setIsSavingHolding(true)
    try {
      await fsSavePortfolioHolding(user.uid, {
        ...(editingHolding?._id ? { _id: editingHolding._id } : {}),
        name: name || symbol,
        symbol: symbol || name,
        assetType: 'crypto',
        quantity,
        averageBuyPrice: Number.isFinite(parsedBuy) && parsedBuy > 0 ? parsedBuy : 0
      })

      notifyApp({
        title: editingHolding ? 'Asset Updated' : 'Asset Added',
        message: `${symbol || name} saved to your portfolio.`,
        tone: 'positive'
      })

      closePortfolioModal()
    } catch (err) {
      console.error('Failed to save portfolio holding:', err)
      notifyApp({ title: 'Save Failed', message: 'Could not save asset to database.', tone: 'critical' })
    } finally {
      setIsSavingHolding(false)
    }
  }

  const handleDeletePortfolioHolding = async (holding) => {
    if (!user?.uid || !holding?._id) return
    try {
      await fsDeletePortfolioHolding(user.uid, holding._id)
      notifyApp({ title: 'Asset Removed', message: `${holding.symbol || holding.name} deleted.`, tone: 'info' })
      closePortfolioModal()
    } catch (err) {
      console.error('Failed to delete asset:', err)
      notifyApp({ title: 'Delete Failed', message: 'Could not remove asset.', tone: 'critical' })
    }
  }

  const visibleHoldings = holdings.slice(0, 6)

  return (
    <section className={styles.card} aria-label="Asset Portfolio">
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleGroup}>
          <span className={styles.cardIcon}>₿</span>
          <h3 className={styles.cardTitle}>Crypto Portfolio</h3>
        </div>
        <div className={styles.headerActions}>
          <button 
            className={styles.refreshBtnHeader} 
            onClick={handleManualRefresh} 
            disabled={isRefreshingPrices}
            title="Refresh live prices from exchange orderbooks"
          >
            <span className={`${styles.refreshIcon} ${isRefreshingPrices ? styles.spinning : ''}`}>🔄</span> Refresh
          </button>
          <button className={styles.addBtnHeader} onClick={() => openAddPortfolioHolding()}>
            + Add
          </button>
        </div>
      </div>

      <div className={styles.summarySection}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
          <span className={styles.summaryLabel}>Total Portfolio Value</span>
          <span style={{ fontSize: '11px', color: 'var(--positive)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--positive)' }}></span> ⚡ Live Market {lastUpdatedStr ? `• ${lastUpdatedStr}` : ''}
          </span>
        </div>
        <div className={styles.summaryRow}>
          {isPricesLoading && holdings.length > 0 ? (
            <span className={styles.skeleton} style={{ width: '120px', height: '28px' }}></span>
          ) : (
            <span className={styles.summaryTotal}>{fmt(portfolioSummary.totalVal)}</span>
          )}
          {!isPricesLoading && portfolioSummary.totalCost > 0 && (
            <span className={`${styles.summaryProfit} ${portfolioSummary.totalProfit >= 0 ? styles.subMetricValGreen : styles.subMetricValRed}`}>
              {privacyMode ? `${s} •••••` : `${portfolioSummary.totalProfit >= 0 ? '+' : ''}${fmt(portfolioSummary.totalProfit)}`}
            </span>
          )}
        </div>
      </div>

      <div className={styles.holdingsHeader}>
        <span className={styles.holdingsTitle}>Holdings</span>
        {holdings.length > 6 && (
          <button className={styles.textBtn} onClick={() => setShowAllHoldingsModal(true)}>
            View All ({holdings.length})
          </button>
        )}
      </div>

      {holdings.length > 0 ? (
        <div className={styles.holdingsList}>
          {visibleHoldings.map((asset, i) => {
            const qty = parseFloat(asset?.quantity ?? asset?.shares ?? 0) || 0
            const symbol = asset?.symbol ? String(asset.symbol).toUpperCase() : ''
            const livePrice = livePrices[symbol] || 0
            const hasLivePrice = livePrice > 0
            const avgBuyPrice = parseFloat(asset?.averageBuyPrice ?? asset?.avgPrice ?? 0) || 0
            const effectivePrice = hasLivePrice ? livePrice : avgBuyPrice
            const assetValue = qty * effectivePrice
            const profitLoss = (hasLivePrice && avgBuyPrice > 0) ? qty * (livePrice - avgBuyPrice) : 0
            const rawPct = (hasLivePrice && avgBuyPrice > 0) ? ((livePrice - avgBuyPrice) / avgBuyPrice) * 100 : 0
            const profitLossPct = (Number.isFinite(rawPct) && !isNaN(rawPct)) ? rawPct : 0

            return (
              <div key={asset?._id || i} className={styles.holdingItem} onClick={() => openAddPortfolioHolding(asset)}>
                <div className={styles.holdingDetails}>
                  <span className={styles.holdingSymbol}>
                    {symbol || 'CRYPTO'}
                    {hasLivePrice && <span className={styles.livePriceIndicator} title="Live market price active">⚡ Live</span>}
                  </span>
                  <span className={styles.holdingName}>
                    {privacyMode ? '••' : qty} coins • {hasLivePrice ? `${fmt(livePrice)}/ea` : (isPricesLoading ? 'Fetching live price...' : (avgBuyPrice > 0 ? `${fmt(avgBuyPrice)}/ea` : 'Rate pending'))}
                  </span>
                </div>
                <div className={styles.holdingValues}>
                  {isPricesLoading && !hasLivePrice && avgBuyPrice <= 0 ? (
                    <span className={styles.skeleton} style={{ width: '70px', height: '16px' }}></span>
                  ) : (
                    <span className={styles.holdingValue}>{fmt(assetValue)}</span>
                  )}
                  {hasLivePrice && avgBuyPrice > 0 && !privacyMode && Math.abs(profitLoss) > 0.01 ? (
                    <span className={`${styles.holdingShares} ${profitLoss >= 0 ? styles.subMetricValGreen : styles.subMetricValRed}`}>
                      {profitLoss >= 0 ? '+' : ''}{fmt(profitLoss)} ({profitLossPct >= 0 ? '+' : ''}{profitLossPct.toFixed(1)}%)
                    </span>
                  ) : (
                    <span className={styles.holdingShares}>
                      {asset?.name || symbol}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className={styles.emptyPortfolio}>
          <div style={{ fontSize: '24px', marginBottom: '4px' }}>₿</div>
          <p className={styles.emptyText}>No crypto holdings added yet.</p>
          <small style={{ color: 'var(--text3)', fontSize: '11px', display: 'block', marginTop: '2px' }}>
            Add Bitcoin, Ethereum, Solana, or any token to track live net worth.
          </small>
        </div>
      )}

      <button className={styles.addAssetBtn} onClick={() => openAddPortfolioHolding()}>
        + Add Crypto Asset
      </button>

      {/* ── ADD/EDIT MODAL ────────────────── */}
      {showPortfolioModal && typeof document !== 'undefined' && createPortal(
        <div className={styles.modalOverlay} onClick={closePortfolioModal}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderTitleGroup}>
                <span className={styles.modalHeaderIcon}>₿</span>
                <h3 className={styles.modalTitle}>{editingHolding ? 'Edit Crypto Holding' : 'Add Crypto Asset'}</h3>
              </div>
              <button className={styles.closeModalBtn} onClick={closePortfolioModal} aria-label="Close">✕</button>
            </div>

            <div className={styles.modalBody}>
              
              {/* Step 1: Preset Select */}
              {!editingHolding && (
                <div className={styles.inputGroup}>
                  <span className={styles.inputLabel}>1. Select Popular Crypto</span>
                  <select
                    className={styles.presetSelectField}
                    value={selectedPresetId}
                    onChange={e => handleSelectPresetAsset(e.target.value)}
                  >
                    <option value="">Pick a crypto asset (BTC, ETH, SOL, USDT...)</option>
                    {POPULAR_ASSETS.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.symbol})</option>
                    ))}
                    <option value="custom">✏️ Type Custom Ticker Symbol Manually...</option>
                  </select>
                </div>
              )}

              {/* Ticker & Name */}
              <div className={styles.inputRow}>
                <div className={styles.inputGroup}>
                  <span className={styles.inputLabel}>Ticker / Symbol</span>
                  <input 
                    className={styles.inputField} 
                    type="text" 
                    placeholder="e.g. SOL, BTC, PEPE" 
                    value={portfolioForm.symbol} 
                    onChange={e => {
                      const sym = e.target.value.toUpperCase()
                      setPortfolioForm(prev => ({ ...prev, symbol: sym }))
                    }} 
                  />
                </div>

                <div className={styles.inputGroup}>
                  <span className={styles.inputLabel}>Asset Name</span>
                  <input 
                    className={styles.inputField} 
                    type="text" 
                    placeholder="e.g. Solana" 
                    value={portfolioForm.name} 
                    onChange={e => setPortfolioForm(prev => ({ ...prev, name: e.target.value }))} 
                  />
                </div>
              </div>

              {/* Step 2: Quantity Owned */}
              <div className={styles.inputGroup}>
                <span className={styles.inputLabel}>2. Quantity / Coins Owned</span>
                <input 
                  ref={quantityInputRef}
                  className={`${styles.inputField} ${styles.inputFieldHighlight}`} 
                  type="number" 
                  step="any" 
                  placeholder="e.g. 2.5" 
                  value={portfolioForm.quantity} 
                  onChange={e => setPortfolioForm(prev => ({ ...prev, quantity: e.target.value }))} 
                />
              </div>

              {/* Real-time Live Calculation Badge */}
              {(() => {
                const qty = parseFloat(portfolioForm.quantity) || 0
                const sym = (portfolioForm.symbol || '').toUpperCase()
                const livePrice = livePrices[sym] || 0
                const estValue = qty * livePrice

                if (qty > 0 && livePrice > 0) {
                  return (
                    <div style={{
                      background: 'color-mix(in srgb, var(--income) 12%, var(--surface2))',
                      border: '1px solid color-mix(in srgb, var(--income) 30%, transparent)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      marginTop: '4px',
                      marginBottom: '4px'
                    }}>
                      <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
                        ⚡ Real-Time Holdings Calculation
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--income)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                        {fmt(estValue)}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '2px' }}>
                        {qty} {sym} × {fmt(livePrice)} live exchange price
                      </div>
                    </div>
                  )
                }
                return null
              })()}

              {/* Optional Avg Buy Price */}
              <div className={styles.inputGroup} style={{ marginTop: '8px' }}>
                <span className={styles.inputLabel}>Average Buy Price ({s}) — Optional for Profit/Loss tracking</span>
                <input 
                  className={styles.inputField} 
                  type="number" 
                  step="any" 
                  placeholder="e.g. Price you bought at" 
                  value={portfolioForm.averageBuyPrice} 
                  onChange={e => setPortfolioForm(prev => ({ ...prev, averageBuyPrice: e.target.value }))} 
                />
              </div>

            </div>

            <div className={styles.modalFooter}>
              {editingHolding && (
                <button 
                  type="button" 
                  className={styles.deleteAssetBtn} 
                  onClick={() => handleDeletePortfolioHolding(editingHolding)}
                >
                  Delete Asset
                </button>
              )}
              <button 
                type="button" 
                className={styles.saveAssetBtn} 
                onClick={handleSavePortfolioHolding} 
                disabled={isSavingHolding || (!portfolioForm.symbol && !portfolioForm.name) || !portfolioForm.quantity}
              >
                {isSavingHolding ? 'Saving...' : editingHolding ? 'Save Changes' : 'Add to Portfolio'}
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* ── VIEW ALL MODAL ────────────────── */}
      {showAllHoldingsModal && typeof document !== 'undefined' && createPortal(
        <div className={styles.modalOverlay} onClick={() => setShowAllHoldingsModal(false)}>
          <div className={`${styles.modalContent} ${styles.modalContentLarge}`} onClick={e => e.stopPropagation()}>
            
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderTitleGroup}>
                <span className={styles.modalHeaderIcon}>📊</span>
                <h3 className={styles.modalTitle}>All Crypto Holdings ({holdings.length})</h3>
              </div>
              <button className={styles.closeModalBtn} onClick={() => setShowAllHoldingsModal(false)}>✕</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.allHoldingsList}>
                {holdings.map((asset, i) => {
                  const qty = parseFloat(asset?.quantity ?? asset?.shares ?? 0) || 0
                  const symbol = asset?.symbol ? String(asset.symbol).toUpperCase() : ''
                  const livePrice = livePrices[symbol] || 0
                  const hasLivePrice = livePrice > 0
                  const avgBuyPrice = parseFloat(asset?.averageBuyPrice ?? asset?.avgPrice ?? 0) || 0
                  const assetValue = qty * livePrice
                  const assetProfit = avgBuyPrice > 0 ? assetValue - (qty * avgBuyPrice) : 0

                  return (
                    <div key={asset?._id || i} className={styles.holdingItemFull} onClick={() => { setShowAllHoldingsModal(false); openAddPortfolioHolding(asset); }}>
                      <div className={styles.holdingDetailsFull}>
                        <span className={styles.holdingSymbolFull}>
                          {symbol || 'CRYPTO'}
                          {hasLivePrice && <span className={styles.livePriceIndicator} title="Live market rate active">⚡</span>}
                        </span>
                        <span className={styles.holdingNameFull}>{asset?.name || 'Crypto Asset'}</span>
                      </div>
                      <div className={styles.holdingValuesFull}>
                        <span className={styles.holdingValueFull}>{fmt(assetValue)}</span>
                        {avgBuyPrice > 0 && (
                          <span className={`${styles.holdingProfitFull} ${assetProfit >= 0 ? styles.subMetricValGreen : styles.subMetricValRed}`}>
                            {assetProfit >= 0 ? '+' : ''}{fmt(assetProfit)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}
    </section>
  )
}
