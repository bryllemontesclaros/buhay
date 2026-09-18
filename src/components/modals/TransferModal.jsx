import React, { useMemo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import accStyles from '../../pages/Accounts.module.css'
import { ACCOUNT_ICONS } from '../../lib/accountConstants'
import { POPULAR_CRYPTO_COINS, DEFAULT_FOREX_RATE } from '../../lib/crypto'

export default function TransferModal({
  showTransferModal,
  onClose,
  transferForm,
  setTransferForm,
  transferSaving,
  handleTransferSubmit,
  swapTransferDirection,
  accounts = [],
  holdings = [],
  cryptoPriceMap = {},
  vsCurrency = 'PHP',
  s = '₱',
  fmt,
}) {
  if (!showTransferModal || typeof document === 'undefined') return null

  const [showCustomTokens, setShowCustomTokens] = useState(false)

  // 1. Detect transfer types
  const isFromCrypto = String(transferForm.fromAccountId || '').startsWith('crypto:')
  const isToCrypto =
    String(transferForm.toAccountId || '').startsWith('crypto:') ||
    String(transferForm.toAccountId || '').startsWith('new_crypto:')

  // 2. Resolve Target Coin (when buying/funding crypto)
  const targetCoin = useMemo(() => {
    if (!isToCrypto) return null
    const toId = transferForm.toAccountId || ''
    if (toId.startsWith('crypto:')) {
      const hId = toId.replace('crypto:', '')
      const h = holdings.find(item => item._id === hId)
      if (h) {
        return {
          id: String(h.coinId || h.symbol).toLowerCase(),
          symbol: String(h.symbol || 'CRYPTO').toUpperCase(),
          name: h.name || h.symbol,
          isExisting: true,
          holdingId: h._id,
        }
      }
    }
    if (toId.startsWith('new_crypto:')) {
      const key = toId.replace('new_crypto:', '')
      const pop = POPULAR_CRYPTO_COINS.find(c => c.id === key || c.symbol.toLowerCase() === key.toLowerCase())
      if (pop) {
        return {
          id: pop.id,
          symbol: pop.symbol,
          name: pop.name,
          icon: pop.icon,
          isExisting: false,
        }
      }
    }
    const defaultPop = POPULAR_CRYPTO_COINS[0]
    return {
      id: defaultPop.id,
      symbol: defaultPop.symbol,
      name: defaultPop.name,
      isExisting: false,
    }
  }, [isToCrypto, transferForm.toAccountId, holdings])

  // 3. Resolve Source Coin (when cashing out crypto)
  const sourceHolding = useMemo(() => {
    if (!isFromCrypto) return null
    const hId = (transferForm.fromAccountId || '').replace('crypto:', '')
    return holdings.find(item => item._id === hId) || null
  }, [isFromCrypto, transferForm.fromAccountId, holdings])

  // 4. Resolve current exchange rate for the active coin
  const activeCoinInfo = targetCoin || (sourceHolding ? {
    id: String(sourceHolding.coinId || sourceHolding.symbol).toLowerCase(),
    symbol: String(sourceHolding.symbol || 'CRYPTO').toUpperCase(),
  } : null)

  const coinRate = useMemo(() => {
    if (!activeCoinInfo) return 1
    const coinId = activeCoinInfo.id
    const sym = activeCoinInfo.symbol
    const quote =
      cryptoPriceMap[coinId] ||
      cryptoPriceMap[sym] ||
      cryptoPriceMap[sym?.toLowerCase()] ||
      {}
    const pop = POPULAR_CRYPTO_COINS.find(c => c.id === coinId || c.symbol === sym)
    const defUsd = pop?.defaultUsd || 1

    const isUsd = vsCurrency === 'USD'
    if (quote.usd !== undefined || quote.php !== undefined) {
      return isUsd
        ? (quote.usd ?? (quote.php ? quote.php / DEFAULT_FOREX_RATE : defUsd))
        : (quote.php ?? (quote.usd ? quote.usd * DEFAULT_FOREX_RATE : defUsd * DEFAULT_FOREX_RATE))
    }
    return isUsd ? defUsd : defUsd * DEFAULT_FOREX_RATE
  }, [activeCoinInfo, cryptoPriceMap, vsCurrency])

  // 5. Compute tokens when funding crypto
  const computedTokens = useMemo(() => {
    const fiat = parseFloat(transferForm.amount) || 0
    if (!fiat || coinRate <= 0) return 0
    return fiat / coinRate
  }, [transferForm.amount, coinRate])

  const effectiveTokens = transferForm.customTokenQty !== undefined && transferForm.customTokenQty !== ''
    ? parseFloat(transferForm.customTokenQty) || 0
    : computedTokens

  // 6. Compute P&L when cashing out (normalized to vsCurrency)
  const cashOutPnl = useMemo(() => {
    if (!isFromCrypto || !sourceHolding) return null
    const tokens = parseFloat(transferForm.tokenQty) || 0
    if (!tokens) return null
    const rawBuyPrice = parseFloat(sourceHolding.buyPrice ?? sourceHolding.rawBuyPrice ?? coinRate) || coinRate
    const holdingCurrency = (sourceHolding.currency || sourceHolding.buyCurrency || (rawBuyPrice > 10000 ? 'PHP' : 'USD')).toUpperCase()
    const isVsUsd = vsCurrency === 'USD'

    let normalizedBuyPrice = rawBuyPrice
    if (holdingCurrency === 'USD' && !isVsUsd) {
      normalizedBuyPrice = rawBuyPrice * DEFAULT_FOREX_RATE
    } else if (holdingCurrency === 'PHP' && isVsUsd) {
      normalizedBuyPrice = rawBuyPrice / DEFAULT_FOREX_RATE
    }

    const costBasis = tokens * normalizedBuyPrice
    const proceeds = tokens * coinRate
    const diff = proceeds - costBasis
    const pct = costBasis > 0 ? ((diff / costBasis) * 100).toFixed(1) : '0.0'
    return {
      diff,
      pct,
      isProfit: diff >= 0,
      costBasis,
      proceeds,
    }
  }, [isFromCrypto, sourceHolding, transferForm.tokenQty, coinRate, vsCurrency])

  // Sync tokenQty and amount when user edits during cash out
  function handleCashOutTokenChange(val) {
    const tokens = parseFloat(val) || 0
    const fiat = tokens > 0 && coinRate > 0 ? (tokens * coinRate).toFixed(2) : ''
    setTransferForm(prev => ({
      ...prev,
      tokenQty: val,
      amount: fiat,
      pricePerToken: coinRate,
    }))
  }

  function handleCashOutFiatChange(val) {
    const fiat = parseFloat(val) || 0
    const tokens = fiat > 0 && coinRate > 0 ? (fiat / coinRate).toFixed(6) : ''
    setTransferForm(prev => ({
      ...prev,
      amount: val,
      tokenQty: tokens,
      pricePerToken: coinRate,
    }))
  }

  // Sync price per token when target coin rate changes
  useEffect(() => {
    if (isToCrypto || isFromCrypto) {
      setTransferForm(prev => ({
        ...prev,
        pricePerToken: coinRate,
        coinSymbol: activeCoinInfo?.symbol || 'CRYPTO',
        coinId: activeCoinInfo?.id || '',
        coinName: activeCoinInfo?.name || '',
      }))
    }
  }, [coinRate, isToCrypto, isFromCrypto, activeCoinInfo])

  // Resolve source bank account and available balance for quick-fill chips
  const sourceAccount = useMemo(() => {
    if (isFromCrypto) return null
    return accounts.find(a => a._id === transferForm.fromAccountId) || null
  }, [isFromCrypto, transferForm.fromAccountId, accounts])

  const sourceAvailableFiat = sourceAccount ? Math.max(0, Number(sourceAccount.balance) || 0) : 0

  const setQuickFiatPercent = (pct) => {
    if (sourceAvailableFiat <= 0) return
    const val = (sourceAvailableFiat * pct).toFixed(2)
    setTransferForm(prev => ({ ...prev, amount: val }))
  }

  const setQuickTokenPercent = (pct) => {
    if (!sourceHolding) return
    const maxQty = parseFloat(sourceHolding.quantity || 0)
    if (maxQty <= 0) return
    const val = pct === 1 ? String(maxQty) : String(Number((maxQty * pct).toFixed(6)))
    handleCashOutTokenChange(val)
  }

  return createPortal(
    <div className={accStyles.modalOverlay} onClick={onClose}>
      <div className={accStyles.modalCard} onClick={e => e.stopPropagation()}>
        <div className={accStyles.bottomSheetHandle} />
        <div className={accStyles.modalHeader}>
          <div>
            <div className={accStyles.modalEyebrow}>
              {isToCrypto ? '⚡ Bank to Crypto Transfer' : isFromCrypto ? '💰 Cash Out Crypto to Bank' : '⇄ Inter-Account Transfer'}
            </div>
            <div className={accStyles.modalTitle}>
              {isToCrypto ? 'Fund Crypto' : isFromCrypto ? 'Cash Out to Bank' : 'Move Money'}
            </div>
          </div>
          <button type="button" className={accStyles.modalClose} onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        <form onSubmit={handleTransferSubmit} className={accStyles.modalBody}>
          <div className={accStyles.transferTopBar}>
            <span className={accStyles.transferTopNotice}>Select source & destination:</span>
            <button
              type="button"
              className={accStyles.btnSwapDirection}
              onClick={swapTransferDirection}
              title="Reverse transfer direction"
            >
              ⇄ Swap
            </button>
          </div>

          <div className={accStyles.transferGrid}>
            {/* FROM FIELD */}
            <div className={accStyles.field}>
              <label className={accStyles.fieldLabel} htmlFor="transfer-from">From</label>
              <select
                id="transfer-from"
                className={accStyles.fieldSelect}
                value={transferForm.fromAccountId}
                onChange={e => {
                  const val = e.target.value
                  setTransferForm(prev => ({
                    ...prev,
                    fromAccountId: val,
                    // If source is crypto and target is also crypto, reset target to first bank account
                    toAccountId: val.startsWith('crypto:') && (prev.toAccountId.startsWith('crypto:') || prev.toAccountId.startsWith('new_crypto:'))
                      ? (accounts[0]?._id || '')
                      : prev.toAccountId,
                  }))
                }}
              >
                <optgroup label="💳 Bank & Cash Accounts">
                  {accounts.map(a => (
                    <option key={a._id} value={a._id} disabled={a._id === transferForm.toAccountId}>
                      {ACCOUNT_ICONS[a.type] || '🏷'} {a.name} ({fmt(a.balance, s)})
                    </option>
                  ))}
                </optgroup>
                {!isToCrypto && holdings.length > 0 && (
                  <optgroup label="🪙 Crypto Holdings (Cash Out)">
                    {holdings.map(h => (
                      <option key={h._id} value={`crypto:${h._id}`}>
                        🪙 {h.name || h.symbol} ({h.quantity} {h.symbol})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <button
              type="button"
              className={accStyles.transferSwapCircle}
              onClick={swapTransferDirection}
              title="Swap From and To accounts"
              aria-label="Swap transfer direction"
            >
              <span className={accStyles.swapIconDesktop}>⇄</span>
              <span className={accStyles.swapIconMobile}>⇅</span>
            </button>

            {/* TO FIELD */}
            <div className={accStyles.field}>
              <label className={accStyles.fieldLabel} htmlFor="transfer-to">To</label>
              <select
                id="transfer-to"
                className={accStyles.fieldSelect}
                value={transferForm.toAccountId}
                onChange={e => {
                  const val = e.target.value
                  setTransferForm(prev => ({
                    ...prev,
                    toAccountId: val,
                    // If target is crypto and source is also crypto, reset source to first bank account
                    fromAccountId: (val.startsWith('crypto:') || val.startsWith('new_crypto:')) && prev.fromAccountId.startsWith('crypto:')
                      ? (accounts[0]?._id || '')
                      : prev.fromAccountId,
                  }))
                }}
              >
                <optgroup label="💳 Bank & Cash Accounts">
                  {accounts.map(a => (
                    <option key={a._id} value={a._id} disabled={a._id === transferForm.fromAccountId}>
                      {ACCOUNT_ICONS[a.type] || '🏷'} {a.name} ({fmt(a.balance, s)})
                    </option>
                  ))}
                </optgroup>
                {!isFromCrypto && (
                  <>
                    {holdings.length > 0 && (
                      <optgroup label="🪙 Existing Crypto Holdings">
                        {holdings.map(h => (
                          <option key={h._id} value={`crypto:${h._id}`}>
                            🪙 {h.name || h.symbol} ({h.quantity} {h.symbol})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="⚡ Buy / Fund Popular Coin">
                      {POPULAR_CRYPTO_COINS.filter(c => !holdings.some(h => (h.symbol || '').toUpperCase() === c.symbol)).slice(0, 8).map(c => (
                        <option key={c.id} value={`new_crypto:${c.id}`}>
                          {c.icon || '🪙'} {c.name} ({c.symbol})
                        </option>
                      ))}
                    </optgroup>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CASE A: BANK -> CRYPTO (BUYING / FUNDING)                                 */}
          {/* ========================================================================= */}
          {isToCrypto && targetCoin && (
            <>
              <div className={accStyles.field}>
                <label className={accStyles.fieldLabel} htmlFor="transfer-amount">Amount to Invest ({s})</label>
                <div className={accStyles.amountHeroWrap}>
                  <span className={accStyles.amountCurrencySymbol}>{s}</span>
                  <input
                    id="transfer-amount"
                    type="number"
                    step="any"
                    min="0.01"
                    inputMode="decimal"
                    className={accStyles.fieldInputHero}
                    placeholder="0.00"
                    value={transferForm.amount}
                    onChange={e => setTransferForm(prev => ({ ...prev, amount: e.target.value }))}
                    autoFocus
                  />
                </div>

                {sourceAccount && (
                  <div className={accStyles.quickChipsRow}>
                    <span className={accStyles.quickChipsLabel}>Quick fill:</span>
                    <button type="button" className={accStyles.chipBtn} onClick={() => setQuickFiatPercent(0.25)} disabled={sourceAvailableFiat <= 0}>25%</button>
                    <button type="button" className={accStyles.chipBtn} onClick={() => setQuickFiatPercent(0.50)} disabled={sourceAvailableFiat <= 0}>50%</button>
                    <button type="button" className={accStyles.chipBtn} onClick={() => setQuickFiatPercent(0.75)} disabled={sourceAvailableFiat <= 0}>75%</button>
                    <button type="button" className={`${accStyles.chipBtn} ${accStyles.chipBtnMax}`} onClick={() => setQuickFiatPercent(1)} disabled={sourceAvailableFiat <= 0}>
                      Max ({fmt(sourceAvailableFiat, s)})
                    </button>
                  </div>
                )}
              </div>

              {/* Live Conversion Preview Card */}
              <div className={accStyles.cryptoConversionCard}>
                <div className={accStyles.cryptoConversionHeader}>
                  <span className={accStyles.cryptoConversionBadge}>⚡ Live Market Conversion</span>
                  <span className={accStyles.cryptoRateText}>1 {targetCoin.symbol} ≈ {fmt(coinRate, s)}</span>
                </div>
                <div className={accStyles.cryptoTokensRow}>
                  <span className={accStyles.cryptoTokensLabel}>Tokens to receive:</span>
                  <span className={accStyles.cryptoTokensValue}>
                    +{effectiveTokens > 0 ? effectiveTokens.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '0.00'} {targetCoin.symbol}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                  <button
                    type="button"
                    onClick={() => setShowCustomTokens(curr => !curr)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      padding: 0,
                      fontWeight: 600,
                      textDecoration: 'underline',
                    }}
                  >
                    {showCustomTokens ? 'Use auto-calculated rate' : '✎ Adjust token qty (fees/spread)'}
                  </button>
                </div>

                {showCustomTokens && (
                  <div style={{ marginTop: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: '4px' }}>
                      Exact Tokens Received
                    </label>
                    <input
                      type="number"
                      step="any"
                      className={accStyles.fieldInput}
                      placeholder={computedTokens > 0 ? computedTokens.toFixed(6) : '0.00'}
                      value={transferForm.customTokenQty ?? ''}
                      onChange={e => setTransferForm(prev => ({ ...prev, customTokenQty: e.target.value }))}
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {/* ========================================================================= */}
          {/* CASE B: CRYPTO -> BANK (SELLING / CASHING OUT)                            */}
          {/* ========================================================================= */}
          {isFromCrypto && sourceHolding && (
            <>
              <div className={accStyles.field}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className={accStyles.fieldLabel} htmlFor="transfer-tokens">Tokens to Sell ({sourceHolding.symbol})</label>
                  <span style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 600 }}>
                    Available: {sourceHolding.quantity} {sourceHolding.symbol}
                  </span>
                </div>
                <div className={accStyles.amountHeroWrap}>
                  <span className={accStyles.amountCurrencySymbol}>🪙</span>
                  <input
                    id="transfer-tokens"
                    type="number"
                    step="any"
                    min="0.000001"
                    max={sourceHolding.quantity}
                    inputMode="decimal"
                    className={accStyles.fieldInputHero}
                    placeholder="0.00"
                    value={transferForm.tokenQty ?? ''}
                    onChange={e => handleCashOutTokenChange(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className={accStyles.quickChipsRow}>
                  <span className={accStyles.quickChipsLabel}>Quick fill:</span>
                  <button type="button" className={accStyles.chipBtn} onClick={() => setQuickTokenPercent(0.25)}>25%</button>
                  <button type="button" className={accStyles.chipBtn} onClick={() => setQuickTokenPercent(0.50)}>50%</button>
                  <button type="button" className={accStyles.chipBtn} onClick={() => setQuickTokenPercent(0.75)}>75%</button>
                  <button type="button" className={`${accStyles.chipBtn} ${accStyles.chipBtnMax}`} onClick={() => setQuickTokenPercent(1)}>
                    Max ({sourceHolding.quantity} {sourceHolding.symbol})
                  </button>
                </div>
              </div>

              <div className={accStyles.field}>
                <label className={accStyles.fieldLabel} htmlFor="transfer-fiat-proceeds">Cash Proceeds Deposited ({s})</label>
                <input
                  id="transfer-fiat-proceeds"
                  type="number"
                  step="any"
                  min="0.01"
                  inputMode="decimal"
                  className={accStyles.fieldInput}
                  placeholder="0.00"
                  value={transferForm.amount ?? ''}
                  onChange={e => handleCashOutFiatChange(e.target.value)}
                />
              </div>

              {/* Cash-Out Calculation Preview Card */}
              <div className={accStyles.cryptoConversionCard}>
                <div className={accStyles.cryptoConversionHeader}>
                  <span className={accStyles.cryptoConversionBadge}>💰 Cash Out to Bank</span>
                  <span className={accStyles.cryptoRateText}>1 {sourceHolding.symbol} ≈ {fmt(coinRate, s)}</span>
                </div>
                <div className={accStyles.cryptoTokensRow}>
                  <span className={accStyles.cryptoTokensLabel}>Tokens remaining:</span>
                  <span className={accStyles.cryptoTokensAvailable}>
                    {Math.max(0, (parseFloat(sourceHolding.quantity || 0) - (parseFloat(transferForm.tokenQty) || 0))).toLocaleString(undefined, { maximumFractionDigits: 6 })} {sourceHolding.symbol}
                  </span>
                </div>
                {cashOutPnl && (
                  <div className={accStyles.cryptoPnlRow} style={{ color: cashOutPnl.isProfit ? 'var(--income)' : 'var(--red)' }}>
                    <span>Estimated Realized P&L:</span>
                    <span>{cashOutPnl.isProfit ? '+' : ''}{fmt(cashOutPnl.diff, s)} ({cashOutPnl.pct}%)</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ========================================================================= */}
          {/* CASE C: BANK <-> BANK (STANDARD REGULAR TRANSFER)                         */}
          {/* ========================================================================= */}
          {!isToCrypto && !isFromCrypto && (
            <div className={accStyles.field}>
              <label className={accStyles.fieldLabel} htmlFor="transfer-amount">Amount ({s})</label>
              <div className={accStyles.amountHeroWrap}>
                <span className={accStyles.amountCurrencySymbol}>{s}</span>
                <input
                  id="transfer-amount"
                  type="number"
                  step="any"
                  min="0.01"
                  inputMode="decimal"
                  className={accStyles.fieldInputHero}
                  placeholder="0.00"
                  value={transferForm.amount}
                  onChange={e => setTransferForm(prev => ({ ...prev, amount: e.target.value }))}
                  autoFocus
                />
              </div>

              {sourceAccount && (
                <div className={accStyles.quickChipsRow}>
                  <span className={accStyles.quickChipsLabel}>Quick fill:</span>
                  <button type="button" className={accStyles.chipBtn} onClick={() => setQuickFiatPercent(0.25)} disabled={sourceAvailableFiat <= 0}>25%</button>
                  <button type="button" className={accStyles.chipBtn} onClick={() => setQuickFiatPercent(0.50)} disabled={sourceAvailableFiat <= 0}>50%</button>
                  <button type="button" className={accStyles.chipBtn} onClick={() => setQuickFiatPercent(0.75)} disabled={sourceAvailableFiat <= 0}>75%</button>
                  <button type="button" className={`${accStyles.chipBtn} ${accStyles.chipBtnMax}`} onClick={() => setQuickFiatPercent(1)} disabled={sourceAvailableFiat <= 0}>
                    Max ({fmt(sourceAvailableFiat, s)})
                  </button>
                </div>
              )}
            </div>
          )}

          {/* DATE FIELD */}
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

          {/* NOTE FIELD */}
          <div className={accStyles.field}>
            <label className={accStyles.fieldLabel} htmlFor="transfer-desc">Note (Optional)</label>
            <input
              id="transfer-desc"
              type="text"
              className={accStyles.fieldInput}
              placeholder={isToCrypto ? 'e.g. Binance P2P buy' : isFromCrypto ? 'e.g. Sold crypto for cash' : 'e.g. ATM cash withdrawal, wallet reload'}
              value={transferForm.desc}
              onChange={e => setTransferForm(prev => ({ ...prev, desc: e.target.value }))}
            />
          </div>

          {/* ACTIONS */}
          <div className={accStyles.modalActions}>
            <button type="button" className={accStyles.btnSecondary} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={accStyles.btnPrimary} disabled={transferSaving}>
              {transferSaving
                ? 'Processing…'
                : isToCrypto
                  ? `Fund ${targetCoin?.symbol || 'Crypto'}`
                  : isFromCrypto
                    ? 'Cash Out to Bank'
                    : 'Complete Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
