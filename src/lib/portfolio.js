/**
 * Portfolio API Helper Library
 * Provides safe, resilient price fetching for Crypto (CoinGecko) and Stocks (Finnhub),
 * plus data normalization utilities and popular asset presets in both USD ($) and PHP (₱).
 */

export const POPULAR_ASSETS = [
  { id: 'btc', name: 'Bitcoin', symbol: 'BTC', assetType: 'crypto', defaultPriceUSD: 63735, defaultPricePHP: 3930000 },
  { id: 'eth', name: 'Ethereum', symbol: 'ETH', assetType: 'crypto', defaultPriceUSD: 1915, defaultPricePHP: 118000 },
  { id: 'sol', name: 'Solana', symbol: 'SOL', assetType: 'crypto', defaultPriceUSD: 73.5, defaultPricePHP: 4500 },
  { id: 'usdt', name: 'Tether USD', symbol: 'USDT', assetType: 'crypto', defaultPriceUSD: 1.00, defaultPricePHP: 61.4 },
  { id: 'bnb', name: 'BNB', symbol: 'BNB', assetType: 'crypto', defaultPriceUSD: 568, defaultPricePHP: 35000 },
  { id: 'xrp', name: 'XRP', symbol: 'XRP', assetType: 'crypto', defaultPriceUSD: 1.07, defaultPricePHP: 65 },
  { id: 'ada', name: 'Cardano', symbol: 'ADA', assetType: 'crypto', defaultPriceUSD: 0.17, defaultPricePHP: 9.8 },
  { id: 'doge', name: 'Dogecoin', symbol: 'DOGE', assetType: 'crypto', defaultPriceUSD: 0.07, defaultPricePHP: 4.35 },

  { id: 'aapl', name: 'Apple Inc.', symbol: 'AAPL', assetType: 'stock', defaultPriceUSD: 225, defaultPricePHP: 13815 },
  { id: 'nvda', name: 'Nvidia Corp', symbol: 'NVDA', assetType: 'stock', defaultPriceUSD: 120, defaultPricePHP: 7368 },
  { id: 'tsla', name: 'Tesla Inc.', symbol: 'TSLA', assetType: 'stock', defaultPriceUSD: 245, defaultPricePHP: 15040 },
  { id: 'voo', name: 'Vanguard S&P 500 ETF', symbol: 'VOO', assetType: 'stock', defaultPriceUSD: 500, defaultPricePHP: 30700 },
  { id: 'qqq', name: 'Invesco QQQ Trust', symbol: 'QQQ', assetType: 'stock', defaultPriceUSD: 480, defaultPricePHP: 29470 },
  { id: 'msft', name: 'Microsoft Corp', symbol: 'MSFT', assetType: 'stock', defaultPriceUSD: 420, defaultPricePHP: 25780 },
  { id: 'amzn', name: 'Amazon.com Inc.', symbol: 'AMZN', assetType: 'stock', defaultPriceUSD: 180, defaultPricePHP: 11050 },

  { id: 'sm', name: 'SM Investments Corp', symbol: 'SM', assetType: 'stock', defaultPriceUSD: 15.00, defaultPricePHP: 920 },
  { id: 'bdo', name: 'BDO Unibank Inc', symbol: 'BDO', assetType: 'stock', defaultPriceUSD: 2.52, defaultPricePHP: 155 },
  { id: 'ali', name: 'Ayala Land Inc', symbol: 'ALI', assetType: 'stock', defaultPriceUSD: 0.52, defaultPricePHP: 32 },
  { id: 'tel', name: 'PLDT Inc', symbol: 'TEL', assetType: 'stock', defaultPriceUSD: 23.60, defaultPricePHP: 1450 },
]

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
 * Fetch Crypto Prices using multi-provider fallback (Coinbase -> Binance -> CoinGecko)
 * @param {string[]} symbols Array of crypto ticker symbols (e.g. ['BTC', 'ETH', 'SOL'])
 * @param {string} currencySymbol Current currency symbol ('₱' or '$')
 * @returns {Promise<Object>} Object mapping symbol to price in target currency
 */
export async function fetchCryptoPrices(symbols = [], currencySymbol = '₱') {
  if (!Array.isArray(symbols) || symbols.length === 0) return {}

  const isUSD = (currencySymbol === '$' || currencySymbol === 'USD')
  const currencyCode = isUSD ? 'USD' : 'PHP'
  const result = {}
  const uniqueSymbols = Array.from(new Set(symbols.map(s => String(s || '').trim().toUpperCase()).filter(Boolean)))

  // 1. Primary: Coinbase Public API (Instant live spot price in PHP or USD, no API key needed, zero CORS issues)
  const coinbaseRequests = uniqueSymbols.map(async (sym) => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3500)
      const res = await fetch(`https://api.coinbase.com/v2/prices/${sym}-${currencyCode}/spot`, {
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      if (res.ok) {
        const json = await res.json()
        const amt = parseFloat(json?.data?.amount)
        if (Number.isFinite(amt) && amt > 0) {
          result[sym] = amt
        }
      }
    } catch {
      // Ignore single symbol Coinbase error safely
    }
  })

  await Promise.allSettled(coinbaseRequests)

  // 2. Secondary: Binance Public API for any remaining unfetched symbols
  const missingSymbols = uniqueSymbols.filter(sym => !result[sym])
  if (missingSymbols.length > 0) {
    const binanceRequests = missingSymbols.map(async (sym) => {
      try {
        const pair = `${sym}USDT`
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3500)
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`, {
          signal: controller.signal
        })
        clearTimeout(timeoutId)
        if (res.ok) {
          const json = await res.json()
          const usdPrice = parseFloat(json?.price)
          if (Number.isFinite(usdPrice) && usdPrice > 0) {
            result[sym] = isUSD ? usdPrice : (usdPrice * 58.5)
          }
        }
      } catch {
        // Ignore single symbol Binance error safely
      }
    })
    await Promise.allSettled(binanceRequests)
  }

  // 3. Fallback: CoinGecko API for any remaining unfetched symbols
  const stillMissing = uniqueSymbols.filter(sym => !result[sym])
  if (stillMissing.length > 0) {
    const idsToFetch = []
    const symbolToId = {}
    stillMissing.forEach(sym => {
      if (COINGECKO_MAP[sym]) {
        idsToFetch.push(COINGECKO_MAP[sym])
        symbolToId[COINGECKO_MAP[sym]] = sym
      }
    })

    if (idsToFetch.length > 0) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3500)
        const idsQuery = idsToFetch.join(',')
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${idsQuery}&vs_currencies=usd,php`, {
          signal: controller.signal
        })
        clearTimeout(timeoutId)
        if (res.ok) {
          const data = await res.json()
          for (const [id, value] of Object.entries(data || {})) {
            if (value && symbolToId[id]) {
              const fetchedPrice = isUSD ? (value.usd ?? value.php / 58.5) : (value.php ?? value.usd * 58.5)
              if (Number.isFinite(fetchedPrice) && fetchedPrice > 0) {
                result[symbolToId[id]] = fetchedPrice
              }
            }
          }
        }
      } catch {
        // Ignore CoinGecko error safely
      }
    }
  }

  return result
}

/**
 * Fetch Stock/ETF Prices from Finnhub (requires VITE_FINNHUB_API_KEY)
 * @param {string[]} symbols Array of stock ticker symbols (e.g. ['AAPL', 'VOO'])
 * @param {string} currencySymbol Current currency symbol ('₱' or '$')
 * @returns {Promise<Object>} Object mapping symbol to price
 */
export async function fetchStockPrices(symbols = [], currencySymbol = '₱') {
  if (!Array.isArray(symbols) || symbols.length === 0) return {}

  const apiKey = import.meta.env?.VITE_FINNHUB_API_KEY
  if (!apiKey) {
    return {}
  }

  const isUSD = (currencySymbol === '$' || currencySymbol === 'USD')
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
          // Finnhub quotes US stocks in USD. Convert to PHP if currency is ₱
          result[s] = isUSD ? data.c : (data.c * 61.4)
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
