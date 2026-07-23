export const PORTFOLIO_ASSET_TYPES = [
  { id: 'stock', label: 'Stock' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'etf', label: 'ETF' },
  { id: 'fund', label: 'Fund' },
  { id: 'cash', label: 'Cash' },
  { id: 'other', label: 'Other' },
]

const ASSET_TYPE_IDS = new Set(PORTFOLIO_ASSET_TYPES.map(type => type.id))

export function numberOrZero(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function normalizePortfolioAssetType(value = '') {
  const key = String(value || '').trim().toLowerCase()
  return ASSET_TYPE_IDS.has(key) ? key : 'other'
}

export function normalizePortfolioHolding(holding = {}, exchangeRates = null) {
  const quantity = Math.max(0, numberOrZero(holding.quantity))
  const averageBuyPrice = Math.max(0, numberOrZero(holding.averageBuyPrice))
  const currentPrice = Math.max(0, numberOrZero(holding.currentPrice))
  
  let marketValue = quantity * currentPrice
  let totalCost = quantity * averageBuyPrice

  if (exchangeRates && holding.currency) {
    const holdingCurrency = String(holding.currency).toUpperCase()
    const rate = Number(exchangeRates[holdingCurrency])
    if (rate > 0) {
      marketValue = marketValue * rate
      totalCost = totalCost * rate
    }
  }

  const gainLoss = marketValue - totalCost
  const gainLossPct = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0

  return {
    ...holding,
    name: String(holding.name || '').trim(),
    symbol: String(holding.symbol || '').trim().toUpperCase(),
    assetType: normalizePortfolioAssetType(holding.assetType),
    quantity,
    averageBuyPrice,
    currentPrice,
    lastPriceUpdatedAt: numberOrZero(holding.lastPriceUpdatedAt),
    marketValue,
    totalCost,
    gainLoss,
    gainLossPct,
  }
}

export function getPortfolioSummary(holdings = [], exchangeRates = null) {
  const normalized = holdings.map(holding => normalizePortfolioHolding(holding, exchangeRates))
  const totals = normalized.reduce((summary, holding) => {
    summary.marketValue += holding.marketValue
    summary.totalCost += holding.totalCost
    summary.assetTypes[holding.assetType] = (summary.assetTypes[holding.assetType] || 0) + holding.marketValue
    return summary
  }, {
    marketValue: 0,
    totalCost: 0,
    assetTypes: {},
  })

  const gainLoss = totals.marketValue - totals.totalCost
  return {
    ...totals,
    gainLoss,
    gainLossPct: totals.totalCost > 0 ? (gainLoss / totals.totalCost) * 100 : 0,
    holdings: normalized,
  }
}

