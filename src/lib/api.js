/**
 * Maps common crypto tickers to CoinGecko IDs.
 * Extend this map as needed or build a more dynamic search if required.
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
 * Fetch Crypto Prices from CoinGecko (Free, No Key Needed)
 * @param {string[]} symbols Array of crypto ticker symbols (e.g., ['BTC', 'ETH'])
 * @returns {Promise<Object>} Map of ticker to USD price (e.g., { BTC: 64000.5, ETH: 3200 })
 */
export async function fetchCryptoPrices(symbols) {
  if (!symbols || symbols.length === 0) return {}

  const idsToFetch = []
  const symbolToId = {}
  
  // Find mapping
  symbols.forEach(sym => {
    const s = sym.toUpperCase()
    if (COINGECKO_MAP[s]) {
      idsToFetch.push(COINGECKO_MAP[s])
      symbolToId[COINGECKO_MAP[s]] = s
    }
  })

  if (idsToFetch.length === 0) return {}

  try {
    const idsQuery = idsToFetch.join(',')
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${idsQuery}&vs_currencies=usd`)
    if (!res.ok) throw new Error('CoinGecko API failed')
    
    const data = await res.json()
    const result = {}
    
    for (const [id, value] of Object.entries(data)) {
      if (value.usd && symbolToId[id]) {
        result[symbolToId[id]] = value.usd
      }
    }
    return result
  } catch (error) {
    console.error('Failed to fetch crypto prices:', error)
    return {}
  }
}

/**
 * Fetch Stock/ETF Prices from Finnhub (Free, requires VITE_FINNHUB_API_KEY)
 * @param {string[]} symbols Array of stock ticker symbols (e.g., ['AAPL', 'VOO'])
 * @returns {Promise<Object>} Map of ticker to USD price (e.g., { AAPL: 150.25 })
 */
export async function fetchStockPrices(symbols) {
  if (!symbols || symbols.length === 0) return {}
  
  const apiKey = import.meta.env.VITE_FINNHUB_API_KEY
  if (!apiKey) {
    console.warn('VITE_FINNHUB_API_KEY not found. Skipping stock price fetches.')
    return {}
  }

  const result = {}
  
  try {
    // Finnhub requires individual requests for quotes on the free tier
    // We run them concurrently with Promise.all
    const requests = symbols.map(async (sym) => {
      const s = sym.toUpperCase()
      const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${s}&token=${apiKey}`)
      if (!res.ok) throw new Error(`Finnhub API failed for ${s}`)
      const data = await res.json()
      // 'c' is Current price in Finnhub
      if (data.c) {
        result[s] = data.c
      }
    })

    await Promise.allSettled(requests)
    return result
  } catch (error) {
    console.error('Failed to fetch stock prices:', error)
    return {}
  }
}
