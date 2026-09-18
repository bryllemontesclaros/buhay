import { doc, writeBatch, increment } from 'firebase/firestore'
import { db } from '../firebase'
import { userCol, getAccountRef, buildAccountLookup, getTransferOutDelta, getTransferInDelta } from './core'
import { normalizeDate, today } from '../utils'
import { DEFAULT_FOREX_RATE } from '../crypto'

/**
 * Transfer fiat funds from a bank account to purchase or top-up a cryptocurrency holding.
 */
export async function fsTransferFiatToCrypto(uid, transfer = {}, accounts = [], holdings = []) {
  if (!uid) throw new Error('User is required.')
  
  const fiatAmount = Number(transfer.fiatAmount ?? transfer.amount) || 0
  if (fiatAmount <= 0) throw new Error('Transfer amount must be greater than zero.')

  const fromAccountId = transfer.fromAccountId
  if (!fromAccountId) throw new Error('Source bank account is required.')

  const accountLookup = buildAccountLookup(accounts)
  const fromAccount = accountLookup.get(fromAccountId)
  if (!fromAccount) throw new Error('Source bank account not found.')

  const coinSymbol = String(transfer.coinSymbol || transfer.symbol || 'CRYPTO').toUpperCase()
  const coinName = transfer.coinName || transfer.name || coinSymbol
  const coinId = String(transfer.coinId || coinSymbol).toLowerCase()
  const tokenQty = Number(transfer.tokenQty ?? transfer.tokens) || 0
  if (tokenQty <= 0) throw new Error('Token quantity must be greater than zero.')

  const pricePerToken = Number(transfer.pricePerToken) || (fiatAmount / tokenQty)
  const date = normalizeDate(transfer.date) || today()
  const wallet = transfer.wallet || 'Binance'
  const currency = transfer.currency || 'PHP'

  const fxRate = Number(transfer.forexRate) || DEFAULT_FOREX_RATE

  // Look for an existing holding for this coin
  const existingHolding = holdings.find(h => {
    if (transfer.toHoldingId && transfer.toHoldingId === h._id) return true
    const hSym = String(h?.symbol || '').toUpperCase()
    const hId = String(h?.coinId || '').toLowerCase()
    return hSym === coinSymbol || hId === coinId
  })

  const batch = writeBatch(db)

  // 1. Deduct fiat from source bank account
  batch.update(getAccountRef(uid, fromAccountId), {
    balance: increment(getTransferOutDelta(fromAccount, fiatAmount)),
  })

  // 2. Update or create crypto holding
  let holdingRef
  if (existingHolding && existingHolding._id) {
    holdingRef = doc(db, 'users', uid, 'portfolioHoldings', existingHolding._id)
    const oldQty = parseFloat(existingHolding.quantity ?? existingHolding.qty ?? 0) || 0
    const oldBuyPrice = parseFloat(existingHolding.buyPrice ?? existingHolding.rawBuyPrice ?? pricePerToken) || pricePerToken
    const holdingBaseCurr = String(existingHolding.currency || (oldBuyPrice > 10000 ? 'PHP' : 'USD')).toUpperCase()
    const transferCurr = String(currency).toUpperCase()

    // Normalize incoming price to the holding's existing base currency
    let incomingPriceInHoldingBase = pricePerToken
    if (holdingBaseCurr === 'USD' && transferCurr === 'PHP') {
      incomingPriceInHoldingBase = pricePerToken / fxRate
    } else if (holdingBaseCurr === 'PHP' && transferCurr === 'USD') {
      incomingPriceInHoldingBase = pricePerToken * fxRate
    }

    const newTotalQty = oldQty + tokenQty
    
    // Calculate new weighted Dollar-Cost Average (DCA) buy price
    const newAvgBuyPrice = newTotalQty > 0
      ? ((oldQty * oldBuyPrice) + (tokenQty * incomingPriceInHoldingBase)) / newTotalQty
      : incomingPriceInHoldingBase

    batch.update(holdingRef, {
      quantity: newTotalQty,
      buyPrice: newAvgBuyPrice,
      currentPrice: incomingPriceInHoldingBase,
      price: incomingPriceInHoldingBase,
      updatedAt: Date.now(),
    })
  } else {
    holdingRef = doc(userCol(uid, 'portfolioHoldings'))
    batch.set(holdingRef, {
      coinId,
      symbol: coinSymbol,
      name: coinName,
      quantity: tokenQty,
      buyPrice: pricePerToken,
      currentPrice: pricePerToken,
      price: pricePerToken,
      currency,
      wallet,
      notes: transfer.desc || 'Transferred from account',
      isCustom: Boolean(transfer.isCustom),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }

  // 3. Log transfer in audit ledger
  const transferRef = doc(userCol(uid, 'transfers'))
  batch.set(transferRef, {
    amount: fiatAmount,
    date,
    fromAccountId,
    fromAccountName: fromAccount.name || '',
    toAccountId: `crypto:${coinId}`,
    toAccountName: `${coinSymbol} (${tokenQty.toLocaleString(undefined, { maximumFractionDigits: 6 })} tokens)`,
    desc: transfer.desc || `Bought ${coinSymbol} from ${fromAccount.name || 'Account'}`,
    type: 'crypto_buy',
    tokens: tokenQty,
    tokenPrice: pricePerToken,
    coinSymbol,
    coinId,
    holdingId: existingHolding?._id || holdingRef.id,
    source: 'manual',
    createdAt: Date.now(),
  })

  await batch.commit()
  return { transferRef, holdingRef }
}

/**
 * Transfer cryptocurrency proceeds to a fiat bank account (sell / cash out).
 */
export async function fsTransferCryptoToFiat(uid, transfer = {}, accounts = [], holdings = []) {
  if (!uid) throw new Error('User is required.')

  const toAccountId = transfer.toAccountId
  if (!toAccountId) throw new Error('Destination bank account is required.')

  const accountLookup = buildAccountLookup(accounts)
  const toAccount = accountLookup.get(toAccountId)
  if (!toAccount) throw new Error('Destination bank account not found.')

  const fromHoldingId = transfer.fromHoldingId
  const holding = holdings.find(h => h._id === fromHoldingId || `crypto:${(h.coinId || h.symbol || '').toLowerCase()}` === fromHoldingId)
  if (!holding) throw new Error('Source crypto holding not found.')

  const currentHoldingQty = parseFloat(holding.quantity ?? holding.qty ?? 0) || 0
  const tokenQty = Number(transfer.tokenQty ?? transfer.tokens) || 0
  if (tokenQty <= 0) throw new Error('Token quantity to sell must be greater than zero.')
  if (tokenQty > currentHoldingQty + 0.0000001) {
    throw new Error(`Insufficient tokens: you only have ${currentHoldingQty} ${holding.symbol}.`)
  }

  const fiatAmount = Number(transfer.fiatAmount ?? transfer.amount) || 0
  if (fiatAmount <= 0) throw new Error('Proceeds amount must be greater than zero.')

  const pricePerToken = Number(transfer.pricePerToken) || (fiatAmount / tokenQty)
  const date = normalizeDate(transfer.date) || today()
  const coinSymbol = String(holding.symbol || 'CRYPTO').toUpperCase()
  const coinId = String(holding.coinId || coinSymbol).toLowerCase()

  const batch = writeBatch(db)

  // 1. Credit fiat proceeds to destination bank account
  batch.update(getAccountRef(uid, toAccountId), {
    balance: increment(getTransferInDelta(toAccount, fiatAmount)),
  })

  // 2. Decrement tokens from holding
  const remainingQty = Math.max(0, currentHoldingQty - tokenQty)
  const holdingRef = doc(db, 'users', uid, 'portfolioHoldings', holding._id)
  batch.update(holdingRef, {
    quantity: remainingQty,
    currentPrice: pricePerToken,
    price: pricePerToken,
    updatedAt: Date.now(),
  })

  // 3. Log transfer in audit ledger
  const transferRef = doc(userCol(uid, 'transfers'))
  batch.set(transferRef, {
    amount: fiatAmount,
    date,
    fromAccountId: `crypto:${coinId}`,
    fromAccountName: `${coinSymbol} (${tokenQty.toLocaleString(undefined, { maximumFractionDigits: 6 })} tokens)`,
    toAccountId,
    toAccountName: toAccount.name || '',
    desc: transfer.desc || `Cashed out ${coinSymbol} to ${toAccount.name || 'Account'}`,
    type: 'crypto_sell',
    tokens: tokenQty,
    tokenPrice: pricePerToken,
    coinSymbol,
    coinId,
    holdingId: holding._id,
    source: 'manual',
    createdAt: Date.now(),
  })

  await batch.commit()
  return { transferRef, holdingRef }
}
