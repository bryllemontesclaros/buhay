import { db, storage } from '../firebase'
import {
  collection, addDoc, deleteDoc, updateDoc, setDoc, deleteField,
  doc, query, orderBy, onSnapshot, getDoc, getDocs, writeBatch, increment
} from 'firebase/firestore'
import { deleteObject, ref as storageRef, uploadBytes } from 'firebase/storage'
import { getAccountBalanceDelta, shouldAffectCurrentAccountBalance } from '../finance'
import { getBillPeriodInfo } from '../bills'
import { normalizeDate, today } from '../utils'

import { userCol, fsAdd, fsUpdate, fsDel } from './core'

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


