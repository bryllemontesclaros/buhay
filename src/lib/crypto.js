/**
 * Crypto pricing engine & portfolio calculations for Buhay / Takda.
 * Features CoinGecko v3 real-time quotes (PHP & USD), smart background caching,
 * search autocomplete, and all-time/24h P&L metrics.
 */

const CACHE_KEY = 'buhay_crypto_prices_v1'
const CACHE_TTL_MS = 45000 // 45 seconds cache TTL

export const POPULAR_CRYPTO_COINS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', icon: '₿', color: '#f7931a' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', icon: '⟠', color: '#627eea' },
  { id: 'solana', symbol: 'SOL', name: 'Solana', icon: '◎', color: '#14f195' },
  { id: 'tether', symbol: 'USDT', name: 'Tether USD', icon: '₮', color: '#26a17b' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP', icon: '✕', color: '#23292f' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', icon: '🐶', color: '#c2a633' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB', icon: '🔶', color: '#f3ba2f' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano', icon: '₳', color: '#0033ad' },
  { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche', icon: '🔺', color: '#e84142' },
  { id: 'sui', symbol: 'SUI', name: 'Sui', icon: '💧', color: '#4da2ff' },
  { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin', icon: '💵', color: '#2775ca' },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink', icon: '⬡', color: '#375bd2' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot', icon: '●', color: '#e6007a' },
  { id: 'near', symbol: 'NEAR', name: 'NEAR Protocol', icon: 'Ⓝ', color: '#000000' },
  { id: 'uniswap', symbol: 'UNI', name: 'Uniswap', icon: '🦄', color: '#ff007a' },
  { id: 'shiba-inu', symbol: 'SHIB', name: 'Shiba Inu', icon: '🐕', color: '#f00500' },
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
  'Coinbase',
  'Kraken',
  'Trust Wallet',
  'Other',
]

/**
 * Get cached prices from localStorage.
 * @returns {{ data: Record<string, { php: number, usd: number, php_24h_change?: number, usd_24h_change?: number }>, timestamp: number } | null}
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
    console.warn('[crypto] Failed to read cached prices:', err)
  }
  return null
}

/**
 * Save prices to localStorage.
 */
export function setCachedPrices(data) {
  if (typeof window === 'undefined' || !data) return
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        data,
        timestamp: Date.now(),
      })
    )
  } catch (err) {
    console.warn('[crypto] Failed to cache prices:', err)
  }
}

/**
 * Fetch live cryptocurrency prices from CoinGecko with fallback mechanisms.
 * @param {string[]} coinIds Array of CoinGecko coin IDs (e.g. ['bitcoin', 'ethereum', 'solana'])
 * @param {boolean} forceRefresh If true, bypasses the client-side TTL check
 * @returns {Promise<{ prices: Record<string, any>, isLive: boolean, updatedAt: number }>}
 */
export async function fetchLiveCryptoPrices(coinIds = [], forceRefresh = false) {
  // Always include popular coins to pre-warm cache
  const uniqueIds = Array.from(
    new Set([
      ...POPULAR_CRYPTO_COINS.map(c => c.id),
      ...coinIds.filter(Boolean),
    ])
  )

  const cached = getCachedPrices()
  const isFresh = cached && Date.now() - cached.timestamp < CACHE_TTL_MS

  if (isFresh && !forceRefresh && cached.data) {
    return {
      prices: cached.data,
      isLive: true,
      updatedAt: cached.timestamp,
    }
  }

  const idsParam = encodeURIComponent(uniqueIds.join(','))
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${idsParam}&vs_currencies=php,usd&include_24hr_change=true`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 7000)

    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!res.ok) {
      throw new Error(`CoinGecko API returned status ${res.status}`)
    }

    const data = await res.json()
    if (data && typeof data === 'object' && Object.keys(data).length > 0) {
      // Merge with previous cache so we don't drop coins if a partial query was run
      const merged = { ...(cached?.data || {}), ...data }
      setCachedPrices(merged)
      return {
        prices: merged,
        isLive: true,
        updatedAt: Date.now(),
      }
    }
  } catch (err) {
    console.warn('[crypto] Live price fetch failed, using cached prices:', err.message || err)
  }

  // Fallback to cache if available
  if (cached?.data) {
    return {
      prices: cached.data,
      isLive: false,
      updatedAt: cached.timestamp,
    }
  }

  // Ultimate static fallback if network and cache both fail
  const fallback = {}
  POPULAR_CRYPTO_COINS.forEach(c => {
    fallback[c.id] = {
      php: c.id === 'bitcoin' ? 3850000 : c.id === 'ethereum' ? 185000 : c.id === 'solana' ? 9500 : 58,
      usd: c.id === 'bitcoin' ? 65000 : c.id === 'ethereum' ? 3150 : c.id === 'solana' ? 160 : 1,
      php_24h_change: 0,
      usd_24h_change: 0,
    }
  })

  return {
    prices: fallback,
    isLive: false,
    updatedAt: Date.now(),
  }
}

/**
 * Search cryptocurrency coins via CoinGecko or local database.
 * @param {string} query
 * @returns {Promise<Array<{ id: string, name: string, symbol: string, icon?: string, thumb?: string }>>}
 */
export async function searchCryptoCoins(query = '') {
  const q = String(query).trim().toLowerCase()
  if (!q) return POPULAR_CRYPTO_COINS

  // Check popular list first
  const localMatches = POPULAR_CRYPTO_COINS.filter(
    c => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
  )

  if (localMatches.length > 0 && q.length < 3) {
    return localMatches
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`, {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data.coins) && data.coins.length > 0) {
        const results = data.coins.slice(0, 10).map(c => ({
          id: c.id,
          name: c.name,
          symbol: String(c.symbol || '').toUpperCase(),
          thumb: c.thumb || c.large,
          icon: '🪙',
        }))

        // Merge with matching local coins to preserve rich icons
        const merged = [...localMatches]
        results.forEach(r => {
          if (!merged.some(m => m.id === r.id)) {
            merged.push(r)
          }
        })
        return merged
      }
    }
  } catch (err) {
    console.warn('[crypto] Search fetch failed:', err.message || err)
  }

  return localMatches
}

/**
 * Calculates complete portfolio performance metrics.
 * @param {Array} holdings List of user holdings from Firestore portfolioHoldings collection
 * @param {Record<string, any>} livePrices Map of coinId -> { php, usd, php_24h_change, usd_24h_change }
 * @param {'PHP'|'USD'} vsCurrency 'PHP' or 'USD'
 * @returns {Object} Portfolio analytics
 */
export function calculatePortfolioMetrics(holdings = [], livePrices = {}, vsCurrency = 'PHP') {
  const curr = String(vsCurrency).toLowerCase() === 'usd' ? 'usd' : 'php'
  const isUsd = curr === 'usd'
  const currencySymbol = isUsd ? '$' : '₱'

  const safeHoldings = Array.isArray(holdings) ? holdings.filter(Boolean) : []

  let totalCurrentValue = 0
  let totalCostBasis = 0
  let total24hChangeAmount = 0

  const enrichedHoldings = safeHoldings.map(h => {
    const coinId = h.coinId || (h.symbol ? h.symbol.toLowerCase() : 'bitcoin')
    const qty = parseFloat(h.quantity ?? h.shares ?? 0) || 0
    const buyPrice = parseFloat(h.buyPrice ?? h.price ?? 0) || 0
    const quote = livePrices[coinId] || livePrices[h.symbol?.toLowerCase()] || {}

    const livePrice = parseFloat(quote[curr]) || buyPrice || 0
    const change24hPct = parseFloat(quote[`${curr}_24h_change`]) || 0

    const currentValue = qty * livePrice
    const costBasis = qty * buyPrice
    const pnlAmount = currentValue - costBasis
    const pnlPct = costBasis > 0 ? (pnlAmount / costBasis) * 100 : 0

    // 24h delta in value
    // value_yesterday = currentValue / (1 + change24hPct/100)
    const yesterdayValue = change24hPct !== -100 ? currentValue / (1 + change24hPct / 100) : currentValue
    const change24hValue = currentValue - yesterdayValue

    totalCurrentValue += currentValue
    totalCostBasis += costBasis
    total24hChangeAmount += change24hValue

    return {
      ...h,
      qty,
      buyPrice,
      livePrice,
      currentValue,
      costBasis,
      pnlAmount,
      pnlPct,
      change24hPct,
      change24hValue,
      coinId,
      symbol: (h.symbol || 'CRYPTO').toUpperCase(),
      name: h.name || h.symbol || 'Cryptocurrency',
      wallet: h.wallet || 'Wallet',
    }
  })

  const totalPnlAmount = totalCurrentValue - totalCostBasis
  const totalPnlPct = totalCostBasis > 0 ? (totalPnlAmount / totalCostBasis) * 100 : 0
  const total24hPct = totalCurrentValue > 0 && totalCurrentValue - total24hChangeAmount > 0
    ? (total24hChangeAmount / (totalCurrentValue - total24hChangeAmount)) * 100
    : 0

  // Calculate allocation breakdown
  const holdingsWithAllocation = enrichedHoldings.map(h => ({
    ...h,
    allocationPct: totalCurrentValue > 0 ? (h.currentValue / totalCurrentValue) * 100 : 0,
  })).sort((a, b) => b.currentValue - a.currentValue)

  return {
    totalCurrentValue,
    totalCostBasis,
    totalPnlAmount,
    totalPnlPct,
    total24hChangeAmount,
    total24hPct,
    currencySymbol,
    vsCurrency: isUsd ? 'USD' : 'PHP',
    holdings: holdingsWithAllocation,
  }
}
