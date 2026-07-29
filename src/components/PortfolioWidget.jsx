import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { fsSavePortfolioHolding, fsDeletePortfolioHolding } from '../lib/firestore'
import { fetchCryptoPrices, fetchStockPrices } from '../lib/portfolio'
import { notifyApp } from '../lib/appFeedback'
import styles from './PortfolioWidget.module.css'

const ASSET_TYPES = [
  { id: 'stock', label: 'Stock / ETF', icon: '📈' },
  { id: 'crypto', label: 'Crypto', icon: '₿' },
  { id: 'bond', label: 'Bonds', icon: '🏛️' },
  { id: 'real_estate', label: 'Real Estate', icon: '🏠' },
  { id: 'other', label: 'Other', icon: '💎' },
]

export default function PortfolioWidget({ user, data = {}, s = '₱' }) {
  const [showPortfolioModal, setShowPortfolioModal] = useState(false)
  const [showAllHoldingsModal, setShowAllHoldingsModal] = useState(false)
  const [editingHolding, setEditingHolding] = useState(null)
  const [isSavingHolding, setIsSavingHolding] = useState(false)
  const [livePrices, setLivePrices] = useState({})

  const [portfolioForm, setPortfolioForm] = useState({
    assetType: 'stock',
    symbol: '',
    name: '',
    quantity: '',
    averageBuyPrice: '',
    currentPrice: ''
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

  // Safely extract holdings array
  const holdings = useMemo(() => {
    return Array.isArray(data?.portfolioHoldings) ? data.portfolioHoldings.filter(Boolean) : []
  }, [data?.portfolioHoldings])

  // Fetch live prices quietly in background
  useEffect(() => {
    if (holdings.length === 0) return

    let isMounted = true
    async function loadPrices() {
      try {
        const cryptoSymbols = holdings
          .filter(h => h?.assetType === 'crypto' && h?.symbol)
          .map(h => h.symbol)
        
        const stockSymbols = holdings
          .filter(h => h?.assetType === 'stock' && h?.symbol)
          .map(h => h.symbol)

        const [cryptos, stocks] = await Promise.all([
          fetchCryptoPrices(cryptoSymbols),
          fetchStockPrices(stockSymbols)
        ])

        if (isMounted) {
          setLivePrices(prev => ({ ...prev, ...cryptos, ...stocks }))
        }
      } catch (err) {
        console.warn('PortfolioWidget: price load failed gracefully:', err)
      }
    }

    loadPrices()
    return () => { isMounted = false }
  }, [holdings])

  // Helper number formatter
  const fmt = (num) => {
    const val = Number(num) || 0
    return `${s} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // Calculate overall portfolio metrics
  const portfolioSummary = useMemo(() => {
    let totalVal = 0
    let totalCost = 0

    holdings.forEach(asset => {
      const qty = parseFloat(asset?.quantity ?? asset?.shares ?? 0) || 0
      const symbol = asset?.symbol ? String(asset.symbol).toUpperCase() : ''
      const fallbackPrice = parseFloat(asset?.currentPrice ?? asset?.price ?? 0) || 0
      const currentPrice = livePrices[symbol] ?? fallbackPrice
      const avgBuyPrice = parseFloat(asset?.averageBuyPrice ?? asset?.avgPrice ?? 0) || 0

      totalVal += qty * currentPrice
      totalCost += qty * avgBuyPrice
    })

    const totalProfit = totalVal - totalCost
    return { totalVal, totalProfit }
  }, [holdings, livePrices])

  const openAddPortfolioHolding = (holding = null) => {
    if (holding) {
      setEditingHolding(holding)
      setPortfolioForm({
        assetType: holding.assetType || 'stock',
        symbol: holding.symbol || '',
        name: holding.name || '',
        quantity: String(holding.quantity ?? holding.shares ?? ''),
        averageBuyPrice: String(holding.averageBuyPrice ?? holding.avgPrice ?? ''),
        currentPrice: String(holding.currentPrice ?? holding.price ?? '')
      })
    } else {
      setEditingHolding(null)
      setPortfolioForm({
        assetType: 'stock',
        symbol: '',
        name: '',
        quantity: '',
        averageBuyPrice: '',
        currentPrice: ''
      })
    }
    setShowPortfolioModal(true)
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
    const currentPrice = parseFloat(portfolioForm.currentPrice)
    const averageBuyPrice = parseFloat(portfolioForm.averageBuyPrice) || currentPrice || 0

    if (!name && !symbol) {
      notifyApp({ title: 'Asset Identifier Required', message: 'Enter a ticker symbol or name for this asset.', tone: 'warning' })
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
        assetType: portfolioForm.assetType || 'stock',
        quantity,
        averageBuyPrice,
        currentPrice: Number.isFinite(currentPrice) && currentPrice >= 0 ? currentPrice : averageBuyPrice
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

  const visibleHoldings = holdings.slice(0, 3)

  return (
    <section className={styles.card} aria-label="Asset Portfolio">
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleGroup}>
          <span className={styles.cardIcon}>📈</span>
          <h3 className={styles.cardTitle}>Asset Portfolio</h3>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.addBtnHeader} onClick={() => openAddPortfolioHolding()}>
            + Add
          </button>
        </div>
      </div>

      <div className={styles.summarySection}>
        <span className={styles.summaryLabel}>Total Portfolio Value</span>
        <div className={styles.summaryRow}>
          <span className={styles.summaryTotal}>{fmt(portfolioSummary.totalVal)}</span>
          <span className={`${styles.summaryProfit} ${portfolioSummary.totalProfit >= 0 ? styles.subMetricValGreen : styles.subMetricValRed}`}>
            {portfolioSummary.totalProfit >= 0 ? '+' : ''}{fmt(portfolioSummary.totalProfit)}
          </span>
        </div>
      </div>

      <div className={styles.holdingsHeader}>
        <span className={styles.holdingsTitle}>Holdings</span>
        {holdings.length > 3 && (
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
            const hasLivePrice = Boolean(livePrices[symbol])
            const fallbackPrice = parseFloat(asset?.currentPrice ?? asset?.price ?? 0) || 0
            const currentPrice = livePrices[symbol] ?? fallbackPrice
            const assetValue = qty * currentPrice

            return (
              <div key={asset?._id || i} className={styles.holdingItem} onClick={() => openAddPortfolioHolding(asset)}>
                <div className={styles.holdingDetails}>
                  <span className={styles.holdingSymbol}>
                    {symbol || 'ASSET'}
                    {hasLivePrice && <span className={styles.livePriceIndicator} title="Live price synced">⚡</span>}
                  </span>
                  <span className={styles.holdingName}>{asset?.name || 'Unnamed Asset'}</span>
                </div>
                <div className={styles.holdingValues}>
                  <span className={styles.holdingValue}>{fmt(assetValue)}</span>
                  <span className={styles.holdingShares}>
                    {qty} {asset?.assetType === 'crypto' ? 'coins' : 'shares'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className={styles.emptyPortfolio}>
          <p className={styles.emptyText}>No assets added yet.</p>
        </div>
      )}

      <button className={styles.addAssetBtn} onClick={() => openAddPortfolioHolding()}>
        + Add New Asset
      </button>

      {/* ── ADD/EDIT MODAL (PORTALED DIRECTLY TO BODY) ────────────────── */}
      {showPortfolioModal && typeof document !== 'undefined' && createPortal(
        <div className={styles.modalOverlay} onClick={closePortfolioModal}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderTitleGroup}>
                <span className={styles.modalHeaderIcon}>📈</span>
                <h3 className={styles.modalTitle}>{editingHolding ? 'Edit Holding' : 'Add Asset'}</h3>
              </div>
              <button className={styles.closeModalBtn} onClick={closePortfolioModal} aria-label="Close">✕</button>
            </div>

            <div className={styles.modalBody}>
              
              {/* Asset Type Selector Pills */}
              <div className={styles.inputGroup}>
                <span className={styles.inputLabel}>Asset Class</span>
                <div className={styles.pillGrid}>
                  {ASSET_TYPES.map(type => (
                    <button
                      key={type.id}
                      type="button"
                      className={`${styles.pillBtn} ${portfolioForm.assetType === type.id ? styles.pillBtnActive : ''}`}
                      onClick={() => setPortfolioForm({ ...portfolioForm, assetType: type.id })}
                    >
                      <span className={styles.pillIcon}>{type.icon}</span>
                      <span>{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ticker & Name */}
              <div className={styles.inputRow}>
                <div className={styles.inputGroup}>
                  <span className={styles.inputLabel}>Ticker / Symbol</span>
                  <input 
                    className={styles.inputField} 
                    type="text" 
                    placeholder="e.g. AAPL, BTC" 
                    value={portfolioForm.symbol} 
                    onChange={e => setPortfolioForm({ ...portfolioForm, symbol: e.target.value.toUpperCase() })} 
                  />
                </div>

                <div className={styles.inputGroup}>
                  <span className={styles.inputLabel}>Asset Name</span>
                  <input 
                    className={styles.inputField} 
                    type="text" 
                    placeholder="e.g. Apple Inc." 
                    value={portfolioForm.name} 
                    onChange={e => setPortfolioForm({ ...portfolioForm, name: e.target.value })} 
                  />
                </div>
              </div>

              {/* Quantity & Buy Price */}
              <div className={styles.inputRow}>
                <div className={styles.inputGroup}>
                  <span className={styles.inputLabel}>Shares / Amount</span>
                  <input 
                    className={styles.inputField} 
                    type="number" 
                    step="any" 
                    placeholder="0.0" 
                    value={portfolioForm.quantity} 
                    onChange={e => setPortfolioForm({ ...portfolioForm, quantity: e.target.value })} 
                  />
                </div>

                <div className={styles.inputGroup}>
                  <span className={styles.inputLabel}>Avg Buy Price ({s})</span>
                  <input 
                    className={styles.inputField} 
                    type="number" 
                    step="any" 
                    placeholder="0.00" 
                    value={portfolioForm.averageBuyPrice} 
                    onChange={e => setPortfolioForm({ ...portfolioForm, averageBuyPrice: e.target.value })} 
                  />
                </div>
              </div>

              {/* Fallback Current Price */}
              <div className={styles.inputGroup}>
                <span className={styles.inputLabel}>Current Market Price ({s})</span>
                <input 
                  className={styles.inputField} 
                  type="number" 
                  step="any" 
                  placeholder="Optional: Live price fallback" 
                  value={portfolioForm.currentPrice} 
                  onChange={e => setPortfolioForm({ ...portfolioForm, currentPrice: e.target.value })} 
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

      {/* ── VIEW ALL MODAL (PORTALED DIRECTLY TO BODY) ────────────────── */}
      {showAllHoldingsModal && typeof document !== 'undefined' && createPortal(
        <div className={styles.modalOverlay} onClick={() => setShowAllHoldingsModal(false)}>
          <div className={`${styles.modalContent} ${styles.modalContentLarge}`} onClick={e => e.stopPropagation()}>
            
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderTitleGroup}>
                <span className={styles.modalHeaderIcon}>📊</span>
                <h3 className={styles.modalTitle}>All Portfolio Assets ({holdings.length})</h3>
              </div>
              <button className={styles.closeModalBtn} onClick={() => setShowAllHoldingsModal(false)}>✕</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.allHoldingsList}>
                {holdings.map((asset, i) => {
                  const qty = parseFloat(asset?.quantity ?? asset?.shares ?? 0) || 0
                  const symbol = asset?.symbol ? String(asset.symbol).toUpperCase() : ''
                  const hasLivePrice = Boolean(livePrices[symbol])
                  const fallbackPrice = parseFloat(asset?.currentPrice ?? asset?.price ?? 0) || 0
                  const currentPrice = livePrices[symbol] ?? fallbackPrice
                  const avgBuyPrice = parseFloat(asset?.averageBuyPrice ?? asset?.avgPrice ?? 0) || 0
                  const assetValue = qty * currentPrice
                  const assetProfit = assetValue - (qty * avgBuyPrice)

                  return (
                    <div key={asset?._id || i} className={styles.holdingItemFull} onClick={() => { setShowAllHoldingsModal(false); openAddPortfolioHolding(asset); }}>
                      <div className={styles.holdingDetailsFull}>
                        <span className={styles.holdingSymbolFull}>
                          {symbol || 'ASSET'}
                          {hasLivePrice && <span className={styles.livePriceIndicator} title="Live price synced">⚡</span>}
                        </span>
                        <span className={styles.holdingNameFull}>{asset?.name || 'Unnamed Asset'}</span>
                        <span className={styles.holdingTypeFull}>{asset?.assetType || 'stock'}</span>
                      </div>
                      <div className={styles.holdingValuesFull}>
                        <span className={styles.holdingValueFull}>{fmt(assetValue)}</span>
                        <span className={`${styles.holdingProfitFull} ${assetProfit >= 0 ? styles.subMetricValGreen : styles.subMetricValRed}`}>
                          {assetProfit >= 0 ? '+' : ''}{fmt(assetProfit)}
                        </span>
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
