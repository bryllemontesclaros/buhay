/**
 * Portfolio API Helper Library
 * Provides keyless, free live market price fetching for Crypto via Kraken (primary) and Bybit (fallback),
 * combined with live USD/PHP forex rates from open.er-api.com.
 */

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

// Fetch live USD to PHP exchange rate dynamically
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
 * Fetch Crypto Prices using free, keyless, CORS-friendly APIs:
 * 1. Coinbase Public Exchange Rates API (Primary: returns 600+ coins in 1 request)
 * 2. Kraken Public Ticker API (Secondary fallback per symbol)
 * 3. Bybit Public Spot Ticker API (Tertiary fallback per symbol)
 * 
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

  // 1. Primary: Binance Public Ticker API (CORS enabled *, 3,000+ crypto pairs, 1 fast HTTP request)
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)
    const res = await fetch('https://api.binance.com/api/v3/ticker/price', {
      signal: controller.signal
    })
    clearTimeout(timeoutId)

    if (res.ok) {
      const list = await res.json()
      if (Array.isArray(list)) {
        const binanceMap = {}
        list.forEach(item => {
          if (item?.symbol && item?.price) {
            binanceMap[item.symbol] = parseFloat(item.price)
          }
        })

        uniqueSymbols.forEach(sym => {
          const usdtPair = `${sym}USDT`
          const busdPair = `${sym}BUSD`
          const usdcPair = `${sym}USDC`
          const btcPair = `${sym}BTC`
          
          let usdPrice = binanceMap[usdtPair] || binanceMap[busdPair] || binanceMap[usdcPair] || 0
          if (!usdPrice && binanceMap[btcPair] && binanceMap['BTCUSDT']) {
            usdPrice = binanceMap[btcPair] * binanceMap['BTCUSDT']
          }
          if (sym === 'USDT' || sym === 'USDC') usdPrice = 1.0

          if (Number.isFinite(usdPrice) && usdPrice > 0) {
            result[sym] = isUSD ? usdPrice : (usdPrice * phpRate)
          }
        })
      }
    }
  } catch (err) {
    console.warn('Binance API fetch failed, proceeding to fallbacks:', err)
  }

  // 2. Secondary: Kraken & Bybit single-symbol fallback for any unlisted or custom tokens
  const missingSymbols = uniqueSymbols.filter(sym => !result[sym] || result[sym] <= 0)
  if (missingSymbols.length > 0) {
    const fallbackRequests = missingSymbols.map(async (sym) => {
      // Try Kraken single pair (CORS allowed)
      try {
        const krakenPair = `${sym}USD`
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000)
        const res = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${krakenPair}`, {
          signal: controller.signal
        })
        clearTimeout(timeoutId)
        if (res.ok) {
          const json = await res.json()
          if (json?.result) {
            const firstData = Object.values(json.result)[0]
            const usdPrice = parseFloat(firstData?.c?.[0])
            if (Number.isFinite(usdPrice) && usdPrice > 0) {
              result[sym] = isUSD ? usdPrice : (usdPrice * phpRate)
              return
            }
          }
        }
      } catch {
        // Continue to Bybit
      }

      // Try Bybit single pair
      try {
        const pair = `${sym}USDT`
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000)
        const res = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${pair}`, {
          signal: controller.signal
        })
        clearTimeout(timeoutId)
        if (res.ok) {
          const json = await res.json()
          const item = json?.result?.list?.[0]
          const usdPrice = parseFloat(item?.lastPrice || item?.ask1Price)
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
 * Legacy stub for stock price fetching (stocks removed per user request)
 */
export async function fetchStockPrices() {
  return {}
}
