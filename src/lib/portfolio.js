/**
 * Portfolio API Helper Library
 * Provides safe, resilient price fetching for Crypto (CoinGecko) and Stocks (Finnhub),
 * plus data normalization utilities.
 */

const COINGECKO_MAP = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'USDT': 'tether',
  'USDC': 'usd-coin',
  'BNB': 'binancecoin',
  'SOL': 'solana',
  'XRP': 'ripple',
  'ADA': 'cardano',
  'DOGE': 'dogecoin',
  'AVAX': 'avalanche-2',
  'LINK': 'chainlink',
  'MATIC': 'matic-network',
  'DOT': 'polkadot',
  'SHIB': 'shiba-inu',
  'LTC': 'litecoin',
  'BCH': 'bitcoin-cash',
  'ATOM': 'cosmos',
  'XLM': 'stellar',
  'XMR': 'monero',
}

/**
 * Normalizes a portfolio holding object for Firestore storage
 * @param {Object} holding 
 * @returns {Object} Cleaned holding object
 */
export function normalizePortfolioHolding(holding = {}) {
  const quantity = parseFloat(holding.quantity ?? holding.shares ?? 0) || 0
  const currentPrice = parseFloat(holding.currentPrice ?? holding.price ?? 0) || 0
  const averageBuyPrice = parseFloat(holding.averageBuyPrice ?? holding.avgPrice ?? 0) || currentPrice || 0

  return {
    ...(holding._id ? { _id: holding._id } : {}),
    name: String(holding.name || holding.symbol || 'Asset').trim(),
    symbol: String(holding.symbol || holding.name || 'ASSET').trim().toUpperCase(),
    assetType: holding.assetType || 'stock',
    quantity,
    currentPrice,
    averageBuyPrice,
    updatedAt: holding.updatedAt || new Date().toISOString()
  }
}

/**
 * Fetch Crypto Prices from CoinGecko (Free API)
 * @param {string[]} symbols Array of crypto ticker symbols (e.g. ['BTC', 'ETH'])
 * @returns {Promise<Object>} Object mapping symbol to USD price (e.g. { BTC: 64000 })
 */
export async function fetchCryptoPrices(symbols = []) {
  if (!Array.isArray(symbols) || symbols.length === 0) return {}

  const idsToFetch = []
  const symbolToId = {}

  symbols.forEach(sym => {
    if (!sym) return
    const s = String(sym).trim().toUpperCase()
    if (COINGECKO_MAP[s]) {
      idsToFetch.push(COINGECKO_MAP[s])
      symbolToId[COINGECKO_MAP[s]] = s
    }
  })

  if (idsToFetch.length === 0) return {}

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout safeguard

    const idsQuery = idsToFetch.join(',')
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${idsQuery}&vs_currencies=usd`, {
      signal: controller.signal
    })
    clearTimeout(timeoutId)

    if (!res.ok) throw new Error(`CoinGecko status ${res.status}`)

    const data = await res.json()
    const result = {}

    for (const [id, value] of Object.entries(data || {})) {
      if (value && typeof value.usd === 'number' && symbolToId[id]) {
        result[symbolToId[id]] = value.usd
      }
    }
    return result
  } catch (error) {
    console.warn('Portfolio API: Crypto price fetch failed, using fallbacks:', error.message || error)
    return {}
  }
}

/**
 * Fetch Stock/ETF Prices from Finnhub (requires VITE_FINNHUB_API_KEY)
 * @param {string[]} symbols Array of stock ticker symbols (e.g. ['AAPL', 'VOO'])
 * @returns {Promise<Object>} Object mapping symbol to USD price (e.g. { AAPL: 180.5 })
 */
export async function fetchStockPrices(symbols = []) {
  if (!Array.isArray(symbols) || symbols.length === 0) return {}

  const apiKey = import.meta.env?.VITE_FINNHUB_API_KEY
  if (!apiKey) {
    return {}
  }

  const result = {}

  try {
    const requests = symbols.map(async (sym) => {
      if (!sym) return
      const s = String(sym).trim().toUpperCase()
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 4000)

        const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${s}&token=${apiKey}`, {
          signal: controller.signal
        })
        clearTimeout(timeoutId)

        if (!res.ok) return
        const data = await res.json()
        if (data && typeof data.c === 'number' && data.c > 0) {
          result[s] = data.c
        }
      } catch {
        // Ignore single stock errors safely
      }
    })

    await Promise.allSettled(requests)
    return result
  } catch (error) {
    console.warn('Portfolio API: Stock price fetch failed, using fallbacks:', error.message || error)
    return {}
  }
}
