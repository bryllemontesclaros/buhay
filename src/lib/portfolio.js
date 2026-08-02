/**
 * Portfolio API Helper Library
 * Provides safe, resilient price fetching for Crypto (CoinGecko) and Stocks (Finnhub),
 * plus data normalization utilities and popular asset presets in both USD ($) and PHP (₱).
 */

export const POPULAR_ASSETS = [
  { id: 'btc', name: 'Bitcoin', symbol: 'BTC', assetType: 'crypto', defaultPriceUSD: 63420, defaultPricePHP: 3884475 },
  { id: 'eth', name: 'Ethereum', symbol: 'ETH', assetType: 'crypto', defaultPriceUSD: 1875, defaultPricePHP: 114847 },
  { id: 'sol', name: 'Solana', symbol: 'SOL', assetType: 'crypto', defaultPriceUSD: 73.05, defaultPricePHP: 4474.67 },
  { id: 'usdt', name: 'Tether USD', symbol: 'USDT', assetType: 'crypto', defaultPriceUSD: 1.00, defaultPricePHP: 61.25 },
  { id: 'usdc', name: 'USD Coin', symbol: 'USDC', assetType: 'crypto', defaultPriceUSD: 1.00, defaultPricePHP: 61.25 },
  { id: 'bnb', name: 'BNB', symbol: 'BNB', assetType: 'crypto', defaultPriceUSD: 571, defaultPricePHP: 34973 },
  { id: 'xrp', name: 'XRP', symbol: 'XRP', assetType: 'crypto', defaultPriceUSD: 1.07, defaultPricePHP: 65.5 },
  { id: 'ada', name: 'Cardano', symbol: 'ADA', assetType: 'crypto', defaultPriceUSD: 0.36, defaultPricePHP: 22.05 },
  { id: 'doge', name: 'Dogecoin', symbol: 'DOGE', assetType: 'crypto', defaultPriceUSD: 0.10, defaultPricePHP: 6.13 },
  { id: 'jup', name: 'Jupiter', symbol: 'JUP', assetType: 'crypto', defaultPriceUSD: 0.85, defaultPricePHP: 52.06 },
  { id: 'pump', name: 'Pump.fun', symbol: 'PUMP', assetType: 'crypto', defaultPriceUSD: 0.0022, defaultPricePHP: 0.13 },
  { id: 'uni', name: 'Uniswap', symbol: 'UNI', assetType: 'crypto', defaultPriceUSD: 6.50, defaultPricePHP: 398.12 },
  { id: 'aave', name: 'Aave', symbol: 'AAVE', assetType: 'crypto', defaultPriceUSD: 145.00, defaultPricePHP: 8881.25 },
  { id: 'bp', name: 'Backpack Token', symbol: 'BP', assetType: 'crypto', defaultPriceUSD: 0.37, defaultPricePHP: 22.66 },
  { id: 'shib', name: 'Shiba Inu', symbol: 'SHIB', assetType: 'crypto', defaultPriceUSD: 0.000014, defaultPricePHP: 0.00085 },
  { id: 'pepe', name: 'Pepe', symbol: 'PEPE', assetType: 'crypto', defaultPriceUSD: 0.000008, defaultPricePHP: 0.00049 },
  { id: 'sui', name: 'Sui Network', symbol: 'SUI', assetType: 'crypto', defaultPriceUSD: 1.85, defaultPricePHP: 113.31 },
  { id: 'near', name: 'NEAR Protocol', symbol: 'NEAR', assetType: 'crypto', defaultPriceUSD: 4.80, defaultPricePHP: 294.00 },
  { id: 'avax', name: 'Avalanche', symbol: 'AVAX', assetType: 'crypto', defaultPriceUSD: 24.50, defaultPricePHP: 1500.62 },
  { id: 'link', name: 'Chainlink', symbol: 'LINK', assetType: 'crypto', defaultPriceUSD: 11.20, defaultPricePHP: 686.00 },
  { id: 'matic', name: 'Polygon', symbol: 'MATIC', assetType: 'crypto', defaultPriceUSD: 0.38, defaultPricePHP: 23.27 },
  { id: 'dot', name: 'Polkadot', symbol: 'DOT', assetType: 'crypto', defaultPriceUSD: 4.25, defaultPricePHP: 260.31 },

  { id: 'aapl', name: 'Apple Inc.', symbol: 'AAPL', assetType: 'stock', defaultPriceUSD: 225, defaultPricePHP: 13781 },
  { id: 'nvda', name: 'Nvidia Corp', symbol: 'NVDA', assetType: 'stock', defaultPriceUSD: 120, defaultPricePHP: 7350 },
  { id: 'tsla', name: 'Tesla Inc.', symbol: 'TSLA', assetType: 'stock', defaultPriceUSD: 245, defaultPricePHP: 15006 },
  { id: 'msft', name: 'Microsoft Corp', symbol: 'MSFT', assetType: 'stock', defaultPriceUSD: 420, defaultPricePHP: 25725 },
  { id: 'amzn', name: 'Amazon.com Inc.', symbol: 'AMZN', assetType: 'stock', defaultPriceUSD: 180, defaultPricePHP: 11025 },
  { id: 'meta', name: 'Meta Platforms Inc', symbol: 'META', assetType: 'stock', defaultPriceUSD: 520, defaultPricePHP: 31850 },
  { id: 'googl', name: 'Alphabet Inc (Google)', symbol: 'GOOGL', assetType: 'stock', defaultPriceUSD: 165, defaultPricePHP: 10106 },
  { id: 'pltr', name: 'Palantir Tech', symbol: 'PLTR', assetType: 'stock', defaultPriceUSD: 42, defaultPricePHP: 2572 },
  { id: 'amd', name: 'Advanced Micro Devices', symbol: 'AMD', assetType: 'stock', defaultPriceUSD: 155, defaultPricePHP: 9493 },
  { id: 'voo', name: 'Vanguard S&P 500 ETF', symbol: 'VOO', assetType: 'stock', defaultPriceUSD: 500, defaultPricePHP: 30625 },
  { id: 'qqq', name: 'Invesco QQQ Trust', symbol: 'QQQ', assetType: 'stock', defaultPriceUSD: 480, defaultPricePHP: 29400 },
  { id: 'spy', name: 'SPDR S&P 500 ETF', symbol: 'SPY', assetType: 'stock', defaultPriceUSD: 545, defaultPricePHP: 33383 },

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
  'JUP': 'jupiter-exchange-solana',
  'PUMP': 'pump-fun',
  'UNI': 'uniswap',
  'AAVE': 'aave',
  'BP': 'backpack',
  'SHIB': 'shiba-inu',
  'PEPE': 'pepe',
  'SUI': 'sui',
  'NEAR': 'near',
  'AVAX': 'avalanche-2',
  'LINK': 'chainlink',
  'MATIC': 'matic-network',
  'DOT': 'polkadot',
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

// Fetch live USD to PHP exchange rate dynamically
let cachedPhpRate = 61.4
let lastPhpFetch = 0

async function getLivePhpRate() {
  const now = Date.now()
  if (now - lastPhpFetch < 300000 && cachedPhpRate > 0) { // cache for 5 minutes
    return cachedPhpRate
  }
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)
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
 * Fetch Crypto Prices using multi-provider fallback (Binance -> Bybit -> CoinGecko)
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

  // Kraken uses its own pair naming: BTC=XBT, most others are SYMBOL+USD
  const krakenPairMap = {
    'BTC': 'XXBTZUSD',
    'ETH': 'XETHZUSD',
    'SOL': 'SOLUSD',
    'XRP': 'XXRPZUSD',
    'ADA': 'ADAUSD',
    'DOT': 'DOTUSD',
    'LINK': 'LINKUSD',
    'AVAX': 'AVAXUSD',
    'MATIC': 'MATICUSD',
    'DOGE': 'XDGUSD',
    'LTC': 'XLTCZUSD',
    'BCH': 'BCHUSD',
    'ATOM': 'ATOMUSD',
    'XLM': 'XXLMZUSD',
    'XMR': 'XXMRZUSD',
    'USDT': 'USDTZUSD',
    'USDC': 'USDCUSD',
    'BNB': 'BNBUSD',
    'SHIB': 'SHIBUSD',
    'JUP': 'JUPUSD',
    'UNI': 'UNIUSD',
    'AAVE': 'AAVEUSD',
  }

  // 1. Primary: Kraken Public Ticker API (unblocked in PH, no API key, CORS-friendly)
  try {
    // Build Kraken pairs string for batch request
    const krakenPairs = []
    const krakenPairToSymbol = {}
    uniqueSymbols.forEach(sym => {
      const pair = krakenPairMap[sym] || `${sym}USD`
      krakenPairs.push(pair)
      krakenPairToSymbol[pair] = sym
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${krakenPairs.join(',')}`, {
      signal: controller.signal
    })
    clearTimeout(timeoutId)

    if (res.ok) {
      const json = await res.json()
      if (json?.result) {
        // Kraken returns keys that may differ from input pair names (e.g., XXBTZUSD)
        // Map by iterating all returned pairs
        for (const [returnedPair, tickerData] of Object.entries(json.result)) {
          // tickerData.c[0] = last trade close price
          const usdPrice = parseFloat(tickerData?.c?.[0])
          if (!Number.isFinite(usdPrice) || usdPrice <= 0) continue

          // Find which symbol this pair belongs to
          let matchedSymbol = null
          for (const [inputPair, sym] of Object.entries(krakenPairToSymbol)) {
            if (returnedPair === inputPair || returnedPair.replace(/[XZ]/g, '').includes(sym) || inputPair === returnedPair) {
              matchedSymbol = sym
              break
            }
          }
          // Fallback: try direct match by stripping common suffixes
          if (!matchedSymbol) {
            const stripped = returnedPair.replace(/USD$|ZUSD$/, '').replace(/^X+/, '')
            for (const sym of uniqueSymbols) {
              if (stripped === sym || stripped === sym.replace('BTC', 'XBT') || (sym === 'DOGE' && stripped === 'DG')) {
                matchedSymbol = sym
                break
              }
            }
          }
          if (matchedSymbol && !result[matchedSymbol]) {
            result[matchedSymbol] = isUSD ? usdPrice : (usdPrice * phpRate)
          }
        }
      }
    }
  } catch {
    // Kraken failed, continue to fallbacks
  }

  // 2. Secondary: Bybit Public Spot Ticker API for any remaining unfetched symbols
  const missingSymbols = uniqueSymbols.filter(sym => !result[sym])
  if (missingSymbols.length > 0) {
    const bybitRequests = missingSymbols.map(async (sym) => {
      try {
        const pair = `${sym}USDT`
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3500)
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
        // Ignore single Bybit error safely
      }
    })
    await Promise.allSettled(bybitRequests)
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
              const fetchedPrice = isUSD ? (value.usd ?? value.php / phpRate) : (value.php ?? value.usd * phpRate)
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
