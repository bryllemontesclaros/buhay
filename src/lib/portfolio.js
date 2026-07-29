/**
 * Portfolio API Helper Library
 * Provides safe, resilient price fetching for Crypto (CoinGecko) and Stocks (Finnhub),
 * plus data normalization utilities and popular asset presets in both USD ($) and PHP (₱).
 */

export const POPULAR_ASSETS = [
  { id: 'btc', name: 'Bitcoin', symbol: 'BTC', assetType: 'crypto', defaultPriceUSD: 65000, defaultPricePHP: 3800000 },
  { id: 'eth', name: 'Ethereum', symbol: 'ETH', assetType: 'crypto', defaultPriceUSD: 3400, defaultPricePHP: 200000 },
  { id: 'sol', name: 'Solana', symbol: 'SOL', assetType: 'crypto', defaultPriceUSD: 80, defaultPricePHP: 4650 },
  { id: 'usdt', name: 'Tether USD', symbol: 'USDT', assetType: 'crypto', defaultPriceUSD: 1.00, defaultPricePHP: 58.5 },
  { id: 'bnb', name: 'BNB', symbol: 'BNB', assetType: 'crypto', defaultPriceUSD: 570, defaultPricePHP: 33300 },
  { id: 'xrp', name: 'XRP', symbol: 'XRP', assetType: 'crypto', defaultPriceUSD: 0.60, defaultPricePHP: 35 },
  { id: 'ada', name: 'Cardano', symbol: 'ADA', assetType: 'crypto', defaultPriceUSD: 0.40, defaultPricePHP: 23.5 },
  { id: 'doge', name: 'Dogecoin', symbol: 'DOGE', assetType: 'crypto', defaultPriceUSD: 0.13, defaultPricePHP: 7.6 },

  { id: 'aapl', name: 'Apple Inc.', symbol: 'AAPL', assetType: 'stock', defaultPriceUSD: 225, defaultPricePHP: 13160 },
  { id: 'nvda', name: 'Nvidia Corp', symbol: 'NVDA', assetType: 'stock', defaultPriceUSD: 120, defaultPricePHP: 7020 },
  { id: 'tsla', name: 'Tesla Inc.', symbol: 'TSLA', assetType: 'stock', defaultPriceUSD: 245, defaultPricePHP: 14330 },
  { id: 'voo', name: 'Vanguard S&P 500 ETF', symbol: 'VOO', assetType: 'stock', defaultPriceUSD: 500, defaultPricePHP: 29250 },
  { id: 'qqq', name: 'Invesco QQQ Trust', symbol: 'QQQ', assetType: 'stock', defaultPriceUSD: 480, defaultPricePHP: 28080 },
  { id: 'msft', name: 'Microsoft Corp', symbol: 'MSFT', assetType: 'stock', defaultPriceUSD: 420, defaultPricePHP: 24570 },
  { id: 'amzn', name: 'Amazon.com Inc.', symbol: 'AMZN', assetType: 'stock', defaultPriceUSD: 180, defaultPricePHP: 10530 },

  { id: 'sm', name: 'SM Investments Corp', symbol: 'SM', assetType: 'stock', defaultPriceUSD: 15.70, defaultPricePHP: 920 },
  { id: 'bdo', name: 'BDO Unibank Inc', symbol: 'BDO', assetType: 'stock', defaultPriceUSD: 2.65, defaultPricePHP: 155 },
  { id: 'ali', name: 'Ayala Land Inc', symbol: 'ALI', assetType: 'stock', defaultPriceUSD: 0.55, defaultPricePHP: 32 },
  { id: 'tel', name: 'PLDT Inc', symbol: 'TEL', assetType: 'stock', defaultPriceUSD: 24.80, defaultPricePHP: 1450 },
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
 * Fetch Crypto Prices from CoinGecko in target currency (PHP vs USD)
 * @param {string[]} symbols Array of crypto ticker symbols (e.g. ['BTC', 'ETH'])
 * @param {string} currencySymbol Current currency symbol ('₱' or '$')
 * @returns {Promise<Object>} Object mapping symbol to price in target currency
 */
export async function fetchCryptoPrices(symbols = [], currencySymbol = '₱') {
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

  const isUSD = (currencySymbol === '$' || currencySymbol === 'USD')
  const targetVs = isUSD ? 'usd' : 'php'

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const idsQuery = idsToFetch.join(',')
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${idsQuery}&vs_currencies=usd,php`, {
      signal: controller.signal
    })
    clearTimeout(timeoutId)

    if (!res.ok) throw new Error(`CoinGecko status ${res.status}`)

    const data = await res.json()
    const result = {}

    for (const [id, value] of Object.entries(data || {})) {
      if (value && symbolToId[id]) {
        const fetchedPrice = isUSD ? (value.usd ?? value.php / 58.5) : (value.php ?? value.usd * 58.5)
        if (typeof fetchedPrice === 'number' && fetchedPrice > 0) {
          result[symbolToId[id]] = fetchedPrice
        }
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
          result[s] = isUSD ? data.c : (data.c * 58.5)
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
