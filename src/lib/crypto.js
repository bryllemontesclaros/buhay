/**
 * Fast, Accurate, User-Controlled Cryptocurrency Valuation Engine for Buhay / Takda.
 * Gives full control over asset prices with zero API rate-limits, zero latency, and 100% exact math.
 */

export const CACHE_KEY = 'buhay_crypto_prices_v7'
export const DEFAULT_FOREX_RATE = 61.718 // USD to PHP standard rate

export const POPULAR_CRYPTO_COINS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', icon: '₿', color: '#f7931a', defaultUsd: 78200 },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', icon: '⟠', color: '#627eea', defaultUsd: 2510 },
  { id: 'solana', symbol: 'SOL', name: 'Solana', icon: '◎', color: '#14f195', defaultUsd: 93.5 },
  { id: 'hyperliquid', symbol: 'HYPE', name: 'Hyperliquid', icon: '⚡', color: '#38ef7d', defaultUsd: 24.5 },
  { id: 'bittensor', symbol: 'TAO', name: 'Bittensor', icon: '🧠', color: '#2c3e50', defaultUsd: 480 },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink', icon: '⬡', color: '#375bd2', defaultUsd: 14.8 },
  { id: 'zcash', symbol: 'ZEC', name: 'Zcash', icon: 'ⓩ', color: '#f4b728', defaultUsd: 45.2 },
  { id: 'uniswap', symbol: 'UNI', name: 'Uniswap', icon: '🦄', color: '#ff007a', defaultUsd: 8.9 },
  { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin', icon: '💵', color: '#2775ca', defaultUsd: 1.0 },
  { id: 'tether', symbol: 'USDT', name: 'Tether USD', icon: '₮', color: '#26a17b', defaultUsd: 1.0 },
  { id: 'ripple', symbol: 'XRP', name: 'XRP', icon: '✕', color: '#23292f', defaultUsd: 1.45 },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', icon: '🐶', color: '#c2a633', defaultUsd: 0.125 },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB', icon: '🔶', color: '#f3ba2f', defaultUsd: 590 },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano', icon: '₳', color: '#0033ad', defaultUsd: 0.42 },
  { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche', icon: '🔺', color: '#e84142', defaultUsd: 28.5 },
  { id: 'sui', symbol: 'SUI', name: 'Sui', icon: '💧', color: '#4da2ff', defaultUsd: 2.85 },
  { id: 'near', symbol: 'NEAR', name: 'NEAR Protocol', icon: 'Ⓝ', color: '#000000', defaultUsd: 4.6 },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot', icon: '●', color: '#e6007a', defaultUsd: 5.2 },
  { id: 'shiba-inu', symbol: 'SHIB', name: 'Shiba Inu', icon: '🐕', color: '#f00500', defaultUsd: 0.000014 },
  { id: 'pepe', symbol: 'PEPE', name: 'Pepe', icon: '🐸', color: '#55a932', defaultUsd: 0.0000085 },
  { id: 'render-token', symbol: 'RENDER', name: 'Render', icon: '🎨', color: '#e83e8c', defaultUsd: 5.8 },
  { id: 'kaspa', symbol: 'KAS', name: 'Kaspa', icon: '💠', color: '#70c7ba', defaultUsd: 0.14 },
  { id: 'celestia', symbol: 'TIA', name: 'Celestia', icon: '🌌', color: '#7b2cbf', defaultUsd: 4.2 },
  { id: 'arbitrum', symbol: 'ARB', name: 'Arbitrum', icon: '🔷', color: '#28a0f0', defaultUsd: 0.65 },
  { id: 'optimism', symbol: 'OP', name: 'Optimism', icon: '🔴', color: '#ff0420', defaultUsd: 1.35 },
]

export const CRYPTO_WALLETS = [
  'Binance',
  'Maya',
  'GCrypto',
  'Coins.ph',
  'Bybit',
  'OKX',
  'Metamask',
  'Phantom',
  'Ledger',
  'Trezor',
  'Hyperliquid',
  'Coinbase',
  'Kraken',
  'Trust Wallet',
  'Other',
]

export const COIN_GRADIENTS = {
  bitcoin: 'linear-gradient(135deg, #f7931a, #d47a08)',
  ethereum: 'linear-gradient(135deg, #627eea, #3b5998)',
  solana: 'linear-gradient(135deg, #14f195, #9945ff)',
  hyperliquid: 'linear-gradient(135deg, #38ef7d, #11998e)',
  bittensor: 'linear-gradient(135deg, #3a3a4c, #1f1f2e)',
  chainlink: 'linear-gradient(135deg, #375bd2, #243f9c)',
  zcash: 'linear-gradient(135deg, #f4b728, #c68a0a)',
  uniswap: 'linear-gradient(135deg, #ff007a, #c7005f)',
  'usd-coin': 'linear-gradient(135deg, #2775ca, #1a5699)',
  tether: 'linear-gradient(135deg, #26a17b, #1b7a5b)',
  ripple: 'linear-gradient(135deg, #333d47, #181d22)',
  dogecoin: 'linear-gradient(135deg, #c2a633, #9e8218)',
  binancecoin: 'linear-gradient(135deg, #f3ba2f, #d49810)',
  cardano: 'linear-gradient(135deg, #0033ad, #001f66)',
  'avalanche-2': 'linear-gradient(135deg, #e84142, #b82526)',
  sui: 'linear-gradient(135deg, #4da2ff, #1a75db)',
  near: 'linear-gradient(135deg, #3a3a3a, #111111)',
  polkadot: 'linear-gradient(135deg, #e6007a, #b3005f)',
  'shiba-inu': 'linear-gradient(135deg, #f00500, #b80400)',
  pepe: 'linear-gradient(135deg, #55a932, #2e6914)',
  'render-token': 'linear-gradient(135deg, #e83e8c, #a81d59)',
  kaspa: 'linear-gradient(135deg, #70c7ba, #439689)',
  celestia: 'linear-gradient(135deg, #7b2cbf, #4a148c)',
  arbitrum: 'linear-gradient(135deg, #28a0f0, #14619b)',
  optimism: 'linear-gradient(135deg, #ff0420, #b80214)',
}

/**
 * Get stored user crypto prices from localStorage.
 */
export function getCachedPrices() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.data === 'object') {
      return parsed
    }
  } catch (err) {
    console.warn('[crypto] Failed to read prices:', err)
  }
  return null
}

/**
 * Save user crypto prices to localStorage.
 */
export function setCachedPrices(data, forexRate = DEFAULT_FOREX_RATE) {
  if (typeof window === 'undefined' || !data) return
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        data,
        forexRate: forexRate || DEFAULT_FOREX_RATE,
        timestamp: Date.now(),
      })
    )
  } catch (err) {
    console.warn('[crypto] Failed to save prices:', err)
  }
}

/**
 * Format crypto number with smart decimals.
 */
export function formatCryptoValue(val, symbol = '$', maxDecimals = 4) {
  const num = parseFloat(val) || 0
  if (num === 0) return `${symbol}0.00`
  if (num >= 1000) {
    return `${symbol}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  if (num >= 1) {
    return `${symbol}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
  }
  return `${symbol}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: maxDecimals })}`
}

/**
 * Resolve price quote for a holding.
 */
export function getHoldingQuote(h, livePrices = {}) {
  if (!h) return {}
  const coinId = (h.coinId || '').toLowerCase()
  const symbol = (h.symbol || '').toUpperCase()
  const symLower = symbol.toLowerCase()

  return (
    livePrices[coinId] ||
    livePrices[symbol] ||
    livePrices[symLower] ||
    {}
  )
}

/**
 * Filter popular and custom coins by search query.
 */
export function searchCryptoCoins(query = '') {
  const q = String(query).trim().toLowerCase()
  if (!q) return POPULAR_CRYPTO_COINS

  return POPULAR_CRYPTO_COINS.filter(
    c => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
  )
}

/**
 * Calculates complete portfolio performance metrics using exact user prices.
 */
export function calculatePortfolioMetrics(holdings = [], userPrices = {}, vsCurrency = 'USD', forexRate = DEFAULT_FOREX_RATE) {
  const curr = String(vsCurrency).toLowerCase() === 'php' ? 'php' : 'usd'
  const isUsd = curr === 'usd'
  const currencySymbol = isUsd ? '$' : '₱'
  const fxRate = parseFloat(forexRate) > 0 ? parseFloat(forexRate) : DEFAULT_FOREX_RATE

  const safeHoldings = Array.isArray(holdings) ? holdings.filter(Boolean) : []

  let totalCurrentValue = 0
  let totalCostBasis = 0

  const enrichedHoldings = safeHoldings.map(h => {
    const qty = parseFloat(h.quantity ?? h.shares ?? 0) || 0
    const rawBuyPrice = parseFloat(h.buyPrice ?? h.price ?? 0) || 0
    const coinId = (h.coinId || (h.symbol ? h.symbol.toLowerCase() : 'bitcoin')).toLowerCase()
    const symbol = (h.symbol || 'CRYPTO').toUpperCase()

    // 1. Determine Current Live Price per unit in viewing currency
    const quote = getHoldingQuote(h, userPrices)
    let currentPriceInVsCurrency = 0

    if (quote && (quote[curr] !== undefined || quote.usd !== undefined || quote.php !== undefined)) {
      if (isUsd) {
        currentPriceInVsCurrency = parseFloat(quote.usd) || (parseFloat(quote.php) ? parseFloat(quote.php) / fxRate : 0)
      } else {
        currentPriceInVsCurrency = parseFloat(quote.php) || (parseFloat(quote.usd) ? parseFloat(quote.usd) * fxRate : 0)
      }
    }

    // If no custom price set yet, fallback to holding's saved currentPrice or default coin price or buyPrice
    if (!currentPriceInVsCurrency || currentPriceInVsCurrency <= 0) {
      const defaultCoin = POPULAR_CRYPTO_COINS.find(c => c.id === coinId || c.symbol === symbol)
      if (defaultCoin?.defaultUsd) {
        currentPriceInVsCurrency = isUsd ? defaultCoin.defaultUsd : defaultCoin.defaultUsd * fxRate
      } else {
        // Fallback to buy price converted
        const holdingCurrency = (h.currency || 'USD').toUpperCase()
        if (holdingCurrency === 'PHP' && isUsd) {
          currentPriceInVsCurrency = rawBuyPrice / fxRate
        } else if (holdingCurrency === 'USD' && !isUsd) {
          currentPriceInVsCurrency = rawBuyPrice * fxRate
        } else {
          currentPriceInVsCurrency = rawBuyPrice
        }
      }
    }

    // 2. Determine Cost Basis per unit in viewing currency
    const holdingCurrency = (h.currency || (rawBuyPrice > 10000 ? 'PHP' : 'USD')).toUpperCase()
    let unitCostInVsCurrency = rawBuyPrice
    if (holdingCurrency === 'PHP' && isUsd) {
      unitCostInVsCurrency = rawBuyPrice / fxRate
    } else if (holdingCurrency === 'USD' && !isUsd) {
      unitCostInVsCurrency = rawBuyPrice * fxRate
    }

    const currentValue = qty * currentPriceInVsCurrency
    const costBasis = qty * unitCostInVsCurrency
    const pnlAmount = currentValue - costBasis
    const pnlPct = costBasis > 0 ? (pnlAmount / costBasis) * 100 : 0

    totalCurrentValue += currentValue
    totalCostBasis += costBasis

    return {
      ...h,
      qty,
      unitBuyPrice: unitCostInVsCurrency,
      rawBuyPrice,
      holdingCurrency,
      currentPrice: currentPriceInVsCurrency,
      currentValue,
      costBasis,
      pnlAmount,
      pnlPct,
      coinId,
      symbol,
      name: h.name || symbol || 'Cryptocurrency',
      wallet: h.wallet || 'Wallet',
    }
  })

  const totalPnlAmount = totalCurrentValue - totalCostBasis
  const totalPnlPct = totalCostBasis > 0 ? (totalPnlAmount / totalCostBasis) * 100 : 0

  const holdingsWithAllocation = enrichedHoldings.map(h => ({
    ...h,
    allocationPct: totalCurrentValue > 0 ? (h.currentValue / totalCurrentValue) * 100 : 0,
  })).sort((a, b) => b.currentValue - a.currentValue)

  return {
    totalCurrentValue,
    totalCostBasis,
    totalPnlAmount,
    totalPnlPct,
    currencySymbol,
    vsCurrency: isUsd ? 'USD' : 'PHP',
    forexRate: fxRate,
    holdings: holdingsWithAllocation,
  }
}
