import { db, storage } from './firebase'
import {
  collection, addDoc, deleteDoc, updateDoc, setDoc, deleteField,
  doc, query, orderBy, onSnapshot, getDoc, getDocs, writeBatch, increment
} from 'firebase/firestore'
import { deleteObject, ref as storageRef, uploadBytes } from 'firebase/storage'
import { getAccountBalanceDelta, shouldAffectCurrentAccountBalance } from './finance'
import { getBillPeriodInfo } from './bills'
import { normalizePortfolioHolding } from './portfolio'
import { normalizeDate, today } from './utils'

export function userCol(uid, col) {
  return collection(db, 'users', uid, col)
}

export async function fsAdd(uid, col, data) {
  return await addDoc(userCol(uid, col), { ...data, createdAt: Date.now() })
}

export async function fsDel(uid, col, id) {
  return await deleteDoc(doc(db, 'users', uid, col, id))
}

export async function fsUpdate(uid, col, id, data) {
  return await updateDoc(doc(db, 'users', uid, col, id), data)
}

export async function fsSavePortfolioHolding(uid, holding = {}) {
  const now = Date.now()
  const normalized = normalizePortfolioHolding(holding)
  const payload = {
    ...normalized,
    updatedAt: now,
  }
  delete payload._id
  delete payload.id
  delete payload.marketValue
  delete payload.totalCost
  delete payload.gainLoss
  delete payload.gainLossPct

  if (holding._id || holding.id) {
    const id = holding._id || holding.id
    await updateDoc(doc(db, 'users', uid, 'portfolioHoldings', id), payload)
    return id
  }

  const targetRef = doc(userCol(uid, 'portfolioHoldings'))
  await setDoc(targetRef, {
    ...payload,
    createdAt: now,
  })
  return targetRef.id
}

export async function fsDeletePortfolioHolding(uid, holdingId) {
  if (!holdingId) return
  await deleteDoc(doc(db, 'users', uid, 'portfolioHoldings', holdingId))
}

export async function fsDeleteAccountAndUnlinkTransactions(uid, accountId, data = {}) {
  if (!accountId) return

  const batchOps = []

  // 1. Gather income/expenses to unlink
  ;['income', 'expenses'].forEach(col => {
    const list = Array.isArray(data[col]) ? data[col] : []
    list.forEach(tx => {
      if (tx?._id && tx.accountId === accountId) {
        batchOps.push({
          type: 'update',
          col,
          id: tx._id,
          payload: {
            accountId: '',
            accountBalanceLinked: false,
            accountBalanceApplied: false,
          }
        })
      }
    })
  })

  // 2. Gather transfers to unlink/update
  const transfersList = Array.isArray(data.transfers) ? data.transfers : []
  transfersList.forEach(tx => {
    if (tx?._id && (tx.fromAccountId === accountId || tx.toAccountId === accountId)) {
      const updateData = {}
      if (tx.fromAccountId === accountId) {
        updateData.fromAccountId = ''
        updateData.fromAccountName = ''
      }
      if (tx.toAccountId === accountId) {
        updateData.toAccountId = ''
        updateData.toAccountName = ''
      }
      batchOps.push({
        type: 'update',
        col: 'transfers',
        id: tx._id,
        payload: updateData
      })
    }
  })

  // 3. Gather concrete debts to delete
  const debtsList = Array.isArray(data.debts) ? data.debts : []
  debtsList.forEach(d => {
    if (d?._id && d.accountId === accountId) {
      batchOps.push({
        type: 'delete',
        col: 'debts',
        id: d._id
      })
    }
  })

  if (!batchOps.length) {
    await deleteDoc(doc(db, 'users', uid, 'accounts', accountId))
    return
  }

  const chunks = chunkList(batchOps, 450)
  for (let index = 0; index < chunks.length; index += 1) {
    const batch = writeBatch(db)
    chunks[index].forEach(op => {
      const docRef = doc(db, 'users', uid, op.col, op.id)
      if (op.type === 'update') {
        batch.update(docRef, op.payload)
      } else {
        batch.delete(docRef)
      }
    })
    if (index === chunks.length - 1) {
      batch.delete(doc(db, 'users', uid, 'accounts', accountId))
    }
    await batch.commit()
  }
}

function getAccountRef(uid, accountId) {
  return doc(db, 'users', uid, 'accounts', accountId)
}

function buildAccountLookup(accounts = []) {
  return new Map(accounts.map(account => [account._id, account]))
}

function queueAccountAdjustment(adjustments, accountId, delta) {
  if (!accountId || !Number.isFinite(delta) || delta === 0) return
  adjustments.set(accountId, (adjustments.get(accountId) || 0) + delta)
}

function hasOwn(object = {}, key) {
  return Object.prototype.hasOwnProperty.call(object, key)
}

function getTransactionState(base = {}, overrides = {}, options = {}) {
  const hasOverride = key => Object.prototype.hasOwnProperty.call(overrides, key)
  const date = normalizeDate(hasOverride('date') ? overrides.date : base.date)
  const amount = Number(hasOverride('amount') ? overrides.amount : base.amount) || 0
  const type = hasOverride('type') ? overrides.type : base.type
  const paymentStatus = String(hasOverride('paymentStatus') ? overrides.paymentStatus : (base.paymentStatus || 'paid')).toLowerCase() === 'unpaid'
    ? 'unpaid'
    : 'paid'
  const accountId = hasOverride('accountId') ? (overrides.accountId || '') : (base.accountId || '')
  const requestedLink = hasOverride('accountBalanceLinked')
    ? Boolean(overrides.accountBalanceLinked)
    : Boolean(base.accountBalanceLinked)
  const accountBalanceLinked = Boolean(requestedLink && accountId)
  const computedAccountBalanceApplied = shouldAffectCurrentAccountBalance({
    date,
    accountId,
    accountBalanceLinked,
    paymentStatus,
  })
  const accountBalanceApplied = options.useStoredApplied && hasOwn(base, 'accountBalanceApplied')
    ? Boolean(base.accountBalanceApplied)
    : computedAccountBalanceApplied

  return {
    date,
    amount,
    type,
    paymentStatus,
    accountId,
    accountBalanceLinked,
    accountBalanceApplied,
  }
}

function applyAccountAdjustments(batch, uid, adjustments, accountLookup) {
  adjustments.forEach((delta, accountId) => {
    if (!delta || !accountLookup.has(accountId)) return
    batch.update(getAccountRef(uid, accountId), { balance: increment(delta) })
  })
}

export async function fsAddTransaction(uid, col, data, accounts = []) {
  const accountLookup = buildAccountLookup(accounts)
  const tx = getTransactionState(data, {
    accountBalanceLinked: Boolean(data?.accountBalanceLinked ?? data?.accountId),
  })
  const transactionRef = doc(userCol(uid, col))
  const payload = {
    ...data,
    date: tx.date,
    amount: tx.amount,
    paymentStatus: tx.paymentStatus,
    accountId: tx.accountId,
    accountBalanceLinked: tx.accountBalanceLinked,
    accountBalanceApplied: tx.accountBalanceApplied,
    createdAt: Date.now(),
  }
  const adjustments = new Map()
  const batch = writeBatch(db)

  if (tx.accountBalanceApplied && tx.accountId) {
    const account = accountLookup.get(tx.accountId)
    if (account) queueAccountAdjustment(adjustments, tx.accountId, getAccountBalanceDelta(account, tx.type, tx.amount))
  }

  batch.set(transactionRef, payload)
  applyAccountAdjustments(batch, uid, adjustments, accountLookup)
  await batch.commit()
  return transactionRef
}

export async function fsMarkBillPaid(uid, bill = {}, payment = {}, accounts = []) {
  if (!uid || !bill?._id) throw new Error('Bill is required.')

  const amount = Number(payment.amount || bill.amount) || 0
  const date = normalizeDate(payment.date) || today()
  if (!amount || amount <= 0) throw new Error('Payment amount must be greater than zero.')
  if (!date) throw new Error('Payment date is required.')

  const period = getBillPeriodInfo(bill, payment.periodReferenceDate || today())
  const accountId = payment.accountId || bill.accountId || ''
  const txRef = await fsAddTransaction(uid, 'expenses', {
    desc: `${bill.name || 'Bill'} payment`,
    amount,
    date,
    cat: 'Bills',
    subcat: bill.subcat || 'Other',
    presetKey: bill.presetKey || '',
    recur: '',
    type: 'expense',
    paymentStatus: 'paid',
    accountId,
    accountBalanceLinked: Boolean(accountId),
    billId: bill._id,
    billPeriodKey: period.key,
    source: payment.source || 'bill-payment',
  }, accounts)
  const paidAt = Date.now()
  await fsUpdate(uid, 'bills', bill._id, {
    [`paidPeriods.${period.key}`]: {
      paidAt,
      amount,
      date,
      accountId,
      expenseId: txRef.id,
      dueDate: period.dueDate,
    },
    paid: true,
    paidAt,
    lastPaidPeriod: period.key,
    lastPaidExpenseId: txRef.id,
  })

  return { transactionId: txRef.id, paidAt, period }
}

function getTransferOutDelta(account = {}, amount = 0) {
  const normalizedAmount = Math.abs(Number(amount) || 0)
  if (!normalizedAmount) return 0
  const isCreditCard = String(account?.type || '').toLowerCase() === 'credit card'
  if (isCreditCard) {
    const isStoredNegative = (Number(account?.balance) || 0) < 0
    return isStoredNegative ? -normalizedAmount : normalizedAmount
  }
  return -normalizedAmount
}

function getTransferInDelta(account = {}, amount = 0) {
  const normalizedAmount = Math.abs(Number(amount) || 0)
  if (!normalizedAmount) return 0
  const isCreditCard = String(account?.type || '').toLowerCase() === 'credit card'
  if (isCreditCard) {
    const isStoredNegative = (Number(account?.balance) || 0) < 0
    return isStoredNegative ? normalizedAmount : -normalizedAmount
  }
  return normalizedAmount
}

export async function fsTransferAccounts(uid, transfer = {}, accounts = []) {
  const amount = Number(transfer.amount) || 0
  const fromAccountId = transfer.fromAccountId || ''
  const toAccountId = transfer.toAccountId || ''
  const date = normalizeDate(transfer.date) || today()
  if (!uid) throw new Error('User is required.')
  if (!amount || amount <= 0) throw new Error('Transfer amount must be greater than zero.')
  if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) throw new Error('Transfer needs two different accounts.')

  const accountLookup = buildAccountLookup(accounts)
  const fromAccount = accountLookup.get(fromAccountId)
  const toAccount = accountLookup.get(toAccountId)
  if (!fromAccount || !toAccount) throw new Error('Transfer account not found.')

  const transferRef = doc(userCol(uid, 'transfers'))
  const batch = writeBatch(db)
  batch.update(getAccountRef(uid, fromAccountId), { balance: increment(getTransferOutDelta(fromAccount, amount)) })
  batch.update(getAccountRef(uid, toAccountId), { balance: increment(getTransferInDelta(toAccount, amount)) })
  batch.set(transferRef, {
    amount,
    date,
    fromAccountId,
    fromAccountName: fromAccount.name || '',
    toAccountId,
    toAccountName: toAccount.name || '',
    desc: transfer.desc || 'transfer',
    type: 'transfer',
    source: transfer.source || 'manual',
    createdAt: Date.now(),
  })
  await batch.commit()
  return transferRef
}

export async function fsUpdateTransaction(uid, col, currentTx, data, accounts = []) {
  const accountLookup = buildAccountLookup(accounts)
  const previous = getTransactionState(currentTx, {}, { useStoredApplied: true })
  const next = getTransactionState(currentTx, data)
  const adjustments = new Map()
  const batch = writeBatch(db)

  if (previous.accountBalanceApplied && previous.accountId) {
    const previousAccount = accountLookup.get(previous.accountId)
    if (previousAccount) {
      queueAccountAdjustment(adjustments, previous.accountId, -getAccountBalanceDelta(previousAccount, previous.type, previous.amount))
    }
  }

  if (next.accountBalanceApplied && next.accountId) {
    const nextAccount = accountLookup.get(next.accountId)
    if (nextAccount) {
      queueAccountAdjustment(adjustments, next.accountId, getAccountBalanceDelta(nextAccount, next.type, next.amount))
    }
  }

  batch.update(doc(db, 'users', uid, col, currentTx._id), {
    ...data,
    date: next.date,
    amount: next.amount,
    paymentStatus: next.paymentStatus,
    accountId: next.accountId,
    accountBalanceLinked: next.accountBalanceLinked,
    accountBalanceApplied: next.accountBalanceApplied,
  })
  applyAccountAdjustments(batch, uid, adjustments, accountLookup)
  await batch.commit()
}

export async function fsSetTransactionPaymentStatus(uid, col, currentTx, paymentStatus, accounts = []) {
  const nextStatus = String(paymentStatus || '').toLowerCase() === 'unpaid' ? 'unpaid' : 'paid'
  return fsUpdateTransaction(uid, col, currentTx, { paymentStatus: nextStatus }, accounts)
}

export async function fsDeleteTransaction(uid, col, tx, accounts = []) {
  const accountLookup = buildAccountLookup(accounts)
  const current = getTransactionState(tx, {}, { useStoredApplied: true })
  const adjustments = new Map()
  const batch = writeBatch(db)

  if (current.accountBalanceApplied && current.accountId) {
    const account = accountLookup.get(current.accountId)
    if (account) {
      queueAccountAdjustment(adjustments, current.accountId, -getAccountBalanceDelta(account, current.type, current.amount))
    }
  }

  if (col === 'expenses' && tx.billId && tx.billPeriodKey) {
    batch.update(doc(db, 'users', uid, 'bills', tx.billId), {
      [`paidPeriods.${tx.billPeriodKey}`]: deleteField(),
      paid: false,
      paidAt: 0,
      lastPaidPeriod: '',
      lastPaidExpenseId: '',
    })
  }

  batch.delete(doc(db, 'users', uid, col, tx._id))
  applyAccountAdjustments(batch, uid, adjustments, accountLookup)
  await batch.commit()
}

export async function fsDeleteTransfer(uid, transfer, accounts = []) {
  const accountLookup = buildAccountLookup(accounts)
  const fromAccountId = transfer.fromAccountId
  const toAccountId = transfer.toAccountId
  const amount = Number(transfer.amount) || 0
  const adjustments = new Map()
  const batch = writeBatch(db)

  const fromAccount = accountLookup.get(fromAccountId)
  const toAccount = accountLookup.get(toAccountId)

  if (fromAccount) {
    queueAccountAdjustment(adjustments, fromAccountId, -getTransferOutDelta(fromAccount, amount))
  }
  if (toAccount) {
    queueAccountAdjustment(adjustments, toAccountId, -getTransferInDelta(toAccount, amount))
  }

  batch.delete(doc(db, 'users', uid, 'transfers', transfer._id))
  applyAccountAdjustments(batch, uid, adjustments, accountLookup)
  await batch.commit()
}

export async function fsSyncDueLinkedTransactions(uid, transactions = [], accounts = []) {
  const accountLookup = buildAccountLookup(accounts)
  const dueTransactions = transactions.filter(tx => (
    tx?._id
    && tx?.accountBalanceLinked
    && tx?.accountId
    && !tx?.accountBalanceApplied
    && shouldAffectCurrentAccountBalance(tx, today())
  ))

  if (!dueTransactions.length) return 0

  const adjustments = new Map()
  const batch = writeBatch(db)

  dueTransactions.forEach(tx => {
    const col = tx.type === 'income' ? 'income' : 'expenses'
    batch.update(doc(db, 'users', uid, col, tx._id), { accountBalanceApplied: true })
    const account = accountLookup.get(tx.accountId)
    if (account) {
      queueAccountAdjustment(adjustments, tx.accountId, getAccountBalanceDelta(account, tx.type, tx.amount))
    }
  })

  applyAccountAdjustments(batch, uid, adjustments, accountLookup)
  await batch.commit()
  return dueTransactions.length
}

function getReceiptExtension(fileName = '', fallback = 'jpg') {
  const match = String(fileName || '').match(/\.([a-z0-9]+)$/i)
  return (match?.[1] || fallback).toLowerCase()
}

async function deleteReceiptAsset(path) {
  if (!path) return
  try {
    await deleteObject(storageRef(storage, path))
  } catch {
    // Ignore missing or already-deleted assets so the Firestore delete can still finish.
  }
}

async function uploadLakasImage(uid, folder, docId, blob, fileName = '') {
  if (!blob) return null
  const extension = getReceiptExtension(fileName, 'jpg')
  const path = `users/${uid}/lakas/${folder}/${docId}/photo.${extension}`
  const target = storageRef(storage, path)
  await uploadBytes(target, blob, {
    contentType: blob.type || `image/${extension === 'jpg' ? 'jpeg' : extension}`,
    cacheControl: 'private,max-age=0,no-transform',
  })
  return { path }
}

async function deleteLakasAsset(path) {
  if (!path) return
  try {
    await deleteObject(storageRef(storage, path))
  } catch {
    // Missing Lakas photos should not block deleting the Firestore document.
  }
}

async function uploadLakasMealPhoto(uid, mealId, blob, fileName = '') {
  return uploadLakasImage(uid, 'meals', mealId, blob, fileName)
}

async function deleteLakasMealPhoto(path) {
  return deleteLakasAsset(path)
}

async function uploadLakasBodyPhoto(uid, bodyLogId, blob, fileName = '') {
  return uploadLakasImage(uid, 'bodyLogs', bodyLogId, blob, fileName)
}

async function deleteLakasBodyPhoto(path) {
  return deleteLakasAsset(path)
}

export async function fsSaveLakasMeal(uid, payload = {}) {
  const mealRef = doc(userCol(uid, 'lakasMeals'))
  const mealId = mealRef.id
  let photoUpload = null

  try {
    photoUpload = await uploadLakasMealPhoto(uid, mealId, payload.photoBlob, payload.fileName)
    const mealDoc = {
      name: String(payload.name || '').trim() || 'Meal',
      mealType: payload.mealType || 'Meal',
      date: normalizeDate(payload.date) || today(),
      calories: Number(payload.calories) || 0,
      protein: Number(payload.protein) || 0,
      carbs: Number(payload.carbs) || 0,
      fat: Number(payload.fat) || 0,
      notes: payload.notes || '',
      photoUrl: '',
      photoPath: photoUpload?.path || '',
      source: payload.source || 'photo-meal-log',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await setDoc(mealRef, mealDoc)
    return { _id: mealId, ...mealDoc }
  } catch (error) {
    await deleteLakasMealPhoto(photoUpload?.path)
    throw error
  }
}

export async function fsDeleteLakasMeal(uid, meal = {}) {
  await deleteLakasMealPhoto(meal.photoPath)
  await deleteDoc(doc(db, 'users', uid, 'lakasMeals', meal._id))
}

export async function fsSaveLakasBodyLog(uid, payload = {}) {
  const bodyRef = doc(userCol(uid, 'lakasBodyLogs'))
  const bodyLogId = bodyRef.id
  let photoUpload = null

  try {
    photoUpload = await uploadLakasBodyPhoto(uid, bodyLogId, payload.photoBlob, payload.fileName)
    const bodyDoc = {
      date: normalizeDate(payload.date) || today(),
      weight: Number(payload.weight) || 0,
      height: Number(payload.height) || 0,
      waist: Number(payload.waist) || 0,
      chest: Number(payload.chest) || 0,
      hips: Number(payload.hips) || 0,
      arm: Number(payload.arm) || 0,
      thigh: Number(payload.thigh) || 0,
      bmi: Number(payload.bmi) || 0,
      notes: payload.notes || '',
      photoUrl: '',
      photoPath: photoUpload?.path || '',
      source: payload.source || 'lakas-body',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await setDoc(bodyRef, bodyDoc)
    return { _id: bodyLogId, ...bodyDoc }
  } catch (error) {
    await deleteLakasBodyPhoto(photoUpload?.path)
    throw error
  }
}

export async function fsDeleteLakasBodyLog(uid, bodyLog = {}) {
  await deleteLakasBodyPhoto(bodyLog.photoPath)
  await deleteDoc(doc(db, 'users', uid, 'lakasBodyLogs', bodyLog._id))
}

export function listenCol(uid, col, callback, onError) {
  const q = query(userCol(uid, col), orderBy('createdAt', 'asc'))
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ ...d.data(), _id: d.id })))
  }, error => {
    onError?.(error)
  })
}

export async function fsSetProfile(uid, profile) {
  return await setDoc(doc(db, 'users', uid, 'profile', 'main'), profile, { merge: true })
}

export async function fsTrackImportUsage(uid, monthKey, amount = 1) {
  const profileRef = doc(db, 'users', uid, 'profile', 'main')
  try {
    await updateDoc(profileRef, {
      [`importUsage.${monthKey}`]: increment(amount),
    })
  } catch {
    await setDoc(profileRef, {
      importUsage: {
        [monthKey]: amount,
      },
    }, { merge: true })
  }
}

export async function fsSetMonthStartBalance(uid, monthKey, amount) {
  return await setDoc(
    doc(db, 'users', uid, 'profile', 'main'),
    { monthStartBalances: { [monthKey]: Number(amount) || 0 } },
    { merge: true },
  )
}

export async function fsClearMonthStartBalance(uid, monthKey) {
  return await updateDoc(doc(db, 'users', uid, 'profile', 'main'), {
    [`monthStartBalances.${monthKey}`]: deleteField(),
  })
}

export async function fsSetDailyBalanceOverride(uid, dateKey, amount) {
  return await setDoc(
    doc(db, 'users', uid, 'profile', 'main'),
    { dailyBalanceOverrides: { [dateKey]: Number(amount) || 0 } },
    { merge: true },
  )
}

export async function fsClearDailyBalanceOverride(uid, dateKey) {
  return await updateDoc(doc(db, 'users', uid, 'profile', 'main'), {
    [`dailyBalanceOverrides.${dateKey}`]: deleteField(),
  })
}

async function fsLogBalanceOverride(uid, entry = {}) {
  if (!uid) return
  const payload = {
    action: entry.action || 'set',
    scope: entry.scope || 'takda-closing-balance',
    source: entry.source || 'calendar',
    dateKey: entry.dateKey || '',
    amount: Number(entry.amount) || 0,
    createdAt: Date.now(),
  }
  await setDoc(doc(userCol(uid, 'balanceOverrideLog')), payload)
}

export async function fsSetDailyBalanceOverrideAudited(uid, dateKey, amount, meta = {}) {
  await fsSetDailyBalanceOverride(uid, dateKey, amount)
  await fsLogBalanceOverride(uid, { ...meta, action: 'set', dateKey, amount })
}

export async function fsClearDailyBalanceOverrideAudited(uid, dateKey, meta = {}) {
  await fsClearDailyBalanceOverride(uid, dateKey)
  await fsLogBalanceOverride(uid, { ...meta, action: 'clear', dateKey, amount: 0 })
}

export async function fsCompleteOnboarding(uid, payload = {}) {
  const now = Date.now()
  const batch = writeBatch(db)
  let createdAtOffset = 0

  const profile = payload.profile && typeof payload.profile === 'object' ? payload.profile : {}
  batch.set(doc(db, 'users', uid, 'profile', 'main'), {
    ...profile,
    onboardedAt: profile.onboardedAt || now,
  }, { merge: true })

  function seedCollection(col, rows = []) {
    rows.forEach(row => {
      const providedId = typeof row?._id === 'string' && row._id.trim() ? row._id.trim() : ''
      const targetRef = providedId ? doc(db, 'users', uid, col, providedId) : doc(userCol(uid, col))
      const payload = { ...row }
      delete payload._id
      delete payload.id
      batch.set(targetRef, {
        ...payload,
        createdAt: row?.createdAt || now + createdAtOffset,
      })
      createdAtOffset += 1
    })
  }

  seedCollection('income', Array.isArray(payload.income) ? payload.income : [])
  seedCollection('expenses', Array.isArray(payload.expenses) ? payload.expenses : [])
  seedCollection('accounts', Array.isArray(payload.accounts) ? payload.accounts : [])
  seedCollection('debts', Array.isArray(payload.debts) ? payload.debts : [])
  seedCollection('bills', Array.isArray(payload.bills) ? payload.bills : [])
  seedCollection('lakasBodyLogs', Array.isArray(payload.lakasBodyLogs) ? payload.lakasBodyLogs : [])

  await batch.commit()
}

export function listenProfile(uid, callback, onError) {
  return onSnapshot(doc(db, 'users', uid, 'profile', 'main'), snap => {
    callback(snap.exists() ? snap.data() : {})
  }, error => {
    onError?.(error)
  })
}

function sanitizeRestoreDoc(entry = {}) {
  const payload = { ...entry }
  delete payload._id
  delete payload.id
  return payload
}

function chunkList(items = [], size = 400) {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function collectRestoreAssetPaths(rows = [], keys = []) {
  const paths = new Set()
  rows.forEach(row => {
    keys.forEach(key => {
      const value = typeof row?.[key] === 'string' ? row[key].trim() : ''
      if (value) paths.add(value)
    })
  })
  return paths
}

function getDeletableRestorePaths(value = '', preservedPaths = new Set()) {
  const path = typeof value === 'string' ? value.trim() : ''
  if (!path || preservedPaths.has(path)) return []
  return [path]
}

async function fsWriteCollection(uid, col, rows = [], clearExisting = false) {
  const targetCollection = userCol(uid, col)

  if (clearExisting) {
    const existing = await getDocs(targetCollection)
    for (const snapshots of chunkList(existing.docs)) {
      const batch = writeBatch(db)
      snapshots.forEach(snapshot => batch.delete(snapshot.ref))
      await batch.commit()
    }
  }

  for (const entries of chunkList(rows)) {
    const batch = writeBatch(db)
    entries.forEach(entry => {
      const id = entry?._id || entry?.id || doc(targetCollection).id
      batch.set(doc(db, 'users', uid, col, id), sanitizeRestoreDoc(entry))
    })
    await batch.commit()
  }
}

async function fsDeleteCollection(uid, col) {
  const targetCollection = userCol(uid, col)
  const existing = await getDocs(targetCollection)
  for (const snapshots of chunkList(existing.docs)) {
    const batch = writeBatch(db)
    snapshots.forEach(snapshot => batch.delete(snapshot.ref))
    await batch.commit()
  }
}

export async function fsRestoreBackup(uid, backup = {}, mode = 'merge') {
  const clearExisting = mode === 'replace'
  const collections = [
    'income',
    'expenses',
    'bills',
    'goals',
    'accounts',
    'budgets',
    'receipts',
    'transfers',
    'calendarEvents',
    'portfolioHoldings',
    'lakasRoutines',
    'lakasWorkouts',
    'lakasBodyLogs',
    'lakasActivities',
    'lakasHabits',
    'lakasReminders',
    'lakasMeals',
    'lakasGoals',
    'talaCheckins',
    'talaJournal',
    'talaMoods',
    'talaTasks',
    'talaGoals',
  ]

  if (clearExisting) {
    const incomingReceiptPaths = collectRestoreAssetPaths(Array.isArray(backup.receipts) ? backup.receipts : [], ['imagePath', 'cleanedImagePath'])
    const incomingMealPaths = collectRestoreAssetPaths(Array.isArray(backup.lakasMeals) ? backup.lakasMeals : [], ['photoPath'])
    const incomingBodyPaths = collectRestoreAssetPaths(Array.isArray(backup.lakasBodyLogs) ? backup.lakasBodyLogs : [], ['photoPath'])
    const receiptsSnapshot = await getDocs(userCol(uid, 'receipts'))
    const mealsSnapshot = await getDocs(userCol(uid, 'lakasMeals'))
    const bodySnapshot = await getDocs(userCol(uid, 'lakasBodyLogs'))
    await Promise.all([
      ...receiptsSnapshot.docs.flatMap(snapshot => {
        const data = snapshot.data() || {}
        return [
          ...getDeletableRestorePaths(data.imagePath, incomingReceiptPaths).map(deleteReceiptAsset),
          ...getDeletableRestorePaths(data.cleanedImagePath, incomingReceiptPaths).map(deleteReceiptAsset),
        ]
      }),
      ...mealsSnapshot.docs.flatMap(snapshot => getDeletableRestorePaths((snapshot.data() || {}).photoPath, incomingMealPaths).map(deleteLakasMealPhoto)),
      ...bodySnapshot.docs.flatMap(snapshot => getDeletableRestorePaths((snapshot.data() || {}).photoPath, incomingBodyPaths).map(deleteLakasBodyPhoto)),
    ])
  }

  for (const col of collections) {
    const rows = Array.isArray(backup[col]) ? backup[col] : []
    await fsWriteCollection(uid, col, rows, clearExisting)
  }

  if (clearExisting) {
    await setDoc(doc(db, 'users', uid, 'profile', 'main'), backup.profile || {})
  } else if (backup.profile && typeof backup.profile === 'object') {
    await setDoc(doc(db, 'users', uid, 'profile', 'main'), backup.profile, { merge: true })
  }
}

export async function fsResetFinancialData(uid) {
  const receiptsSnapshot = await getDocs(userCol(uid, 'receipts'))
  const mealsSnapshot = await getDocs(userCol(uid, 'lakasMeals'))
  const bodySnapshot = await getDocs(userCol(uid, 'lakasBodyLogs'))
  await Promise.all([
    ...receiptsSnapshot.docs.flatMap(snapshot => {
      const data = snapshot.data() || {}
      return [
        deleteReceiptAsset(data.imagePath),
        deleteReceiptAsset(data.cleanedImagePath),
      ]
    }),
    ...mealsSnapshot.docs.map(snapshot => deleteLakasMealPhoto((snapshot.data() || {}).photoPath)),
    ...bodySnapshot.docs.map(snapshot => deleteLakasBodyPhoto((snapshot.data() || {}).photoPath)),
  ])

  const collections = ['income', 'expenses', 'bills', 'goals', 'accounts', 'budgets', 'receipts', 'transfers', 'calendarEvents', 'portfolioHoldings', 'lakasRoutines', 'lakasWorkouts', 'lakasBodyLogs', 'lakasActivities', 'lakasHabits', 'lakasReminders', 'lakasMeals', 'lakasGoals']
  for (const col of collections) {
    await fsDeleteCollection(uid, col)
  }
}

export async function fsDeleteAccountData(uid) {
  const receiptsSnapshot = await getDocs(userCol(uid, 'receipts'))
  const mealsSnapshot = await getDocs(userCol(uid, 'lakasMeals'))
  const bodySnapshot = await getDocs(userCol(uid, 'lakasBodyLogs'))
  await Promise.all([
    ...receiptsSnapshot.docs.flatMap(snapshot => {
      const data = snapshot.data() || {}
      return [
        deleteReceiptAsset(data.imagePath),
        deleteReceiptAsset(data.cleanedImagePath),
      ]
    }),
    ...mealsSnapshot.docs.map(snapshot => deleteLakasMealPhoto((snapshot.data() || {}).photoPath)),
    ...bodySnapshot.docs.map(snapshot => deleteLakasBodyPhoto((snapshot.data() || {}).photoPath)),
  ])

  const collections = ['income', 'expenses', 'bills', 'goals', 'accounts', 'budgets', 'feedback', 'receipts', 'transfers', 'calendarEvents', 'portfolioHoldings', 'lakasRoutines', 'lakasWorkouts', 'lakasBodyLogs', 'lakasActivities', 'lakasHabits', 'lakasReminders', 'lakasMeals', 'lakasGoals', 'talaCheckins', 'talaJournal', 'talaMoods', 'talaTasks', 'talaGoals']

  for (const col of collections) {
    await fsDeleteCollection(uid, col)
  }

  await deleteDoc(doc(db, 'users', uid, 'profile', 'main'))
}
