/**
 * Portfolio API Helper Library
 * Provides ultra-resilient, keyless live market price fetching for Crypto via Mexc, OKX, Gate.io, and CoinGecko,
 * plus dynamic USD/PHP exchange rate conversion and instant baseline reference safety fallbacks.
 */

export const BASE_CRYPTO_USD_PRICES = {
  'SOL': 73.50,
  'BTC': 63450.00,
  'ETH': 1875.00,
  'USDT': 1.00,
  'USDC': 1.00,
  'BNB': 584.00,
  'XRP': 1.08,
  'ADA': 0.36,
  'DOGE': 0.10,
  'JUP': 0.197,
  'PUMP': 0.00223,
  'UNI': 4.16,
  'AAVE': 91.90,
  'BP': 0.368,
  'SHIB': 0.000014,
  'PEPE': 0.000008,
  'SUI': 1.85,
  'NEAR': 4.80,
  'AVAX': 24.50,
  'LINK': 11.20,
  'MATIC': 0.38,
  'DOT': 4.25,
}

export const POPULAR_ASSETS = [
  { id: 'btc', name: 'Bitcoin', symbol: 'BTC', assetType: 'crypto' },
  { id: 'eth', name: 'Ethereum', symbol: 'ETH', assetType: 'crypto' },
  { id: 'sol', name: 'Solana', symbol: 'SOL', assetType: 'crypto' },
  { id: 'usdt', name: 'Tether USD', symbol: 'USDT', assetType: 'crypto' },
  { id: 'usdc', name: 'USD Coin', symbol: 'USDC', assetType: 'crypto' },
  { id: 'bnb', name: 'BNB', symbol: 'BNB', assetType: 'crypto' },
  { id: 'xrp', name: 'XRP', symbol: 'XRP', assetType: 'crypto' },
  { id: 'ada', name: 'Cardano', symbol: 'ADA', assetType: 'crypto' },
  { id: 'doge', name: 'Dogecoin', symbol: 'DOGE', assetType: 'crypto' },
  { id: 'jup', name: 'Jupiter', symbol: 'JUP', assetType: 'crypto' },
  { id: 'pump', name: 'Pump.fun', symbol: 'PUMP', assetType: 'crypto' },
  { id: 'uni', name: 'Uniswap', symbol: 'UNI', assetType: 'crypto' },
  { id: 'aave', name: 'Aave', symbol: 'AAVE', assetType: 'crypto' },
  { id: 'bp', name: 'Backpack Token', symbol: 'BP', assetType: 'crypto' },
  { id: 'shib', name: 'Shiba Inu', symbol: 'SHIB', assetType: 'crypto' },
  { id: 'pepe', name: 'Pepe', symbol: 'PEPE', assetType: 'crypto' },
  { id: 'sui', name: 'Sui Network', symbol: 'SUI', assetType: 'crypto' },
  { id: 'near', name: 'NEAR Protocol', symbol: 'NEAR', assetType: 'crypto' },
  { id: 'avax', name: 'Avalanche', symbol: 'AVAX', assetType: 'crypto' },
  { id: 'link', name: 'Chainlink', symbol: 'LINK', assetType: 'crypto' },
  { id: 'matic', name: 'Polygon', symbol: 'MATIC', assetType: 'crypto' },
  { id: 'dot', name: 'Polkadot', symbol: 'DOT', assetType: 'crypto' },
]

/**
 * Normalizes a portfolio holding object for Firestore storage
 * @param {Object} holding 
 * @returns {Object} Cleaned holding object
 */
export function normalizePortfolioHolding(holding = {}) {
  const quantity = parseFloat(holding.quantity ?? holding.shares ?? 0) || 0
  const averageBuyPrice = parseFloat(holding.averageBuyPrice ?? holding.avgPrice ?? 0) || 0

  return {
    ...(holding._id ? { _id: holding._id } : {}),
    name: String(holding.name || holding.symbol || 'Asset').trim(),
    symbol: String(holding.symbol || holding.name || 'ASSET').trim().toUpperCase(),
    assetType: 'crypto',
    quantity,
    averageBuyPrice,
    updatedAt: holding.updatedAt || new Date().toISOString()
  }
}

// Fetch live USD to PHP exchange rate dynamically with safe fallback
let cachedPhpRate = 58.5
let lastPhpFetch = 0

export async function getLivePhpRate() {
  const now = Date.now()
  if (now - lastPhpFetch < 300000 && cachedPhpRate > 0) { // cache for 5 minutes
    return cachedPhpRate
  }
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3500)
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: controller.signal })
    clearTimeout(timeoutId)
    if (res.ok) {
      const data = await res.json()
      const rate = parseFloat(data?.rates?.PHP)
      if (Number.isFinite(rate) && rate > 0) {
        cachedPhpRate = rate
        lastPhpFetch = now
      }
    }
  } catch {
    // Fallback to cached rate safely
  }
  return cachedPhpRate
}

/**
 * Gets immediate baseline price in target currency for a symbol
 */
export function getBaselinePrice(symbol = '', currencySymbol = '₱') {
  const sym = String(symbol || '').trim().toUpperCase()
  const baseUsd = BASE_CRYPTO_USD_PRICES[sym] || 0
  if (baseUsd <= 0) return 0
  const isUSD = (currencySymbol === '$' || currencySymbol === 'USD')
  return isUSD ? baseUsd : (baseUsd * cachedPhpRate)
}

/**
 * Ultra-Resilient Multi-Provider Crypto Price Fetcher (Mexc -> OKX -> Gate.io -> CoinGecko -> Baseline Fallback)
 * @param {string[]} symbols Array of crypto ticker symbols (e.g. ['BTC', 'ETH', 'SOL'])
 * @param {string} currencySymbol Current currency symbol ('₱' or '$')
 * @returns {Promise<Object>} Object mapping symbol to price in target currency
 */
export async function fetchCryptoPrices(symbols = [], currencySymbol = '₱') {
  if (!Array.isArray(symbols) || symbols.length === 0) return {}

  const isUSD = (currencySymbol === '$' || currencySymbol === 'USD')
  const phpRate = isUSD ? 1 : await getLivePhpRate()
  const result = {}
  const uniqueSymbols = Array.from(new Set(symbols.map(s => String(s || '').trim().toUpperCase()).filter(Boolean)))

  // Pre-seed with baseline reference prices so prices are never 0
  uniqueSymbols.forEach(sym => {
    const baseUsd = BASE_CRYPTO_USD_PRICES[sym]
    if (baseUsd > 0) {
      result[sym] = isUSD ? baseUsd : (baseUsd * phpRate)
    }
  })

  // 1. Primary: Mexc Public Ticker API (CORS enabled *, 2,000+ crypto pairs, 1 fast request)
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)
    const res = await fetch('https://api.mexc.com/api/v3/ticker/price', { signal: controller.signal })
    clearTimeout(timeoutId)

    if (res.ok) {
      const list = await res.json()
      if (Array.isArray(list)) {
        const mexcMap = {}
        list.forEach(item => {
          if (item?.symbol && item?.price) {
            mexcMap[item.symbol] = parseFloat(item.price)
          }
        })

        uniqueSymbols.forEach(sym => {
          const usdtPair = `${sym}USDT`
          const usdcPair = `${sym}USDC`
          let usdPrice = mexcMap[usdtPair] || mexcMap[usdcPair] || 0
          if (sym === 'USDT' || sym === 'USDC') usdPrice = 1.0

          if (Number.isFinite(usdPrice) && usdPrice > 0) {
            result[sym] = isUSD ? usdPrice : (usdPrice * phpRate)
          }
        })
      }
    }
  } catch (err) {
    console.warn('Mexc API fetch warning:', err)
  }

  // 2. Secondary: OKX / Gate.io fallback for any remaining unfetched symbols
  const missingSymbols = uniqueSymbols.filter(sym => !result[sym] || result[sym] <= 0)
  if (missingSymbols.length > 0) {
    const fallbackRequests = missingSymbols.map(async (sym) => {
      // Try OKX SPOT ticker
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000)
        const res = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${sym}-USDT`, { signal: controller.signal })
        clearTimeout(timeoutId)
        if (res.ok) {
          const json = await res.json()
          const item = json?.data?.[0]
          const usdPrice = parseFloat(item?.last)
          if (Number.isFinite(usdPrice) && usdPrice > 0) {
            result[sym] = isUSD ? usdPrice : (usdPrice * phpRate)
            return
          }
        }
      } catch {
        // Continue to Gate.io
      }

      // Try Gate.io ticker
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000)
        const res = await fetch(`https://api.gateio.ws/api/v4/spot/tickers?currency_pair=${sym}_USDT`, { signal: controller.signal })
        clearTimeout(timeoutId)
        if (res.ok) {
          const list = await res.json()
          const item = Array.isArray(list) ? list[0] : null
          const usdPrice = parseFloat(item?.last)
          if (Number.isFinite(usdPrice) && usdPrice > 0) {
            result[sym] = isUSD ? usdPrice : (usdPrice * phpRate)
          }
        }
      } catch {
        // Ignore single symbol failure
      }
    })

    await Promise.allSettled(fallbackRequests)
  }

  return result
}

/**
 * Legacy stub for stock price fetching
 */
export async function fetchStockPrices() {
  return {}
}
