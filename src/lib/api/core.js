import { db, storage } from '../firebase'
import {
  collection, addDoc, deleteDoc, updateDoc, setDoc, deleteField,
  doc, query, orderBy, onSnapshot, getDoc, getDocs, writeBatch, increment
} from 'firebase/firestore'
import { deleteObject, ref as storageRef, uploadBytes } from 'firebase/storage'
import { getAccountBalanceDelta, shouldAffectCurrentAccountBalance } from '../finance'
import { getBillPeriodInfo } from '../bills'
import { normalizeDate, today } from '../utils'

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

export function listenCol(uid, col, callback, onError) {
  const q = query(userCol(uid, col), orderBy('createdAt', 'asc'))
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ ...d.data(), _id: d.id })))
  }, error => {
    onError?.(error)
  })
}

export function chunkList(items = [], size = 400) {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

export function getAccountRef(uid, accountId) {
  return doc(db, 'users', uid, 'accounts', accountId)
}

export function buildAccountLookup(accounts = []) {
  return new Map(accounts.map(account => [account._id, account]))
}

export function queueAccountAdjustment(adjustments, accountId, delta) {
  if (!accountId || !Number.isFinite(delta) || delta === 0) return
  adjustments.set(accountId, (adjustments.get(accountId) || 0) + delta)
}

export function hasOwn(object = {}, key) {
  return Object.prototype.hasOwnProperty.call(object, key)
}

export function getTransactionState(base = {}, overrides = {}, options = {}) {
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

export function applyAccountAdjustments(batch, uid, adjustments, accountLookup) {
  adjustments.forEach((delta, accountId) => {
    if (!delta || !accountLookup.has(accountId)) return
    batch.update(getAccountRef(uid, accountId), { balance: increment(delta) })
  })
}

export function getTransferOutDelta(account = {}, amount = 0) {
  const normalizedAmount = Math.abs(Number(amount) || 0)
  if (!normalizedAmount) return 0
  return -normalizedAmount
}

export function getTransferInDelta(account = {}, amount = 0) {
  const normalizedAmount = Math.abs(Number(amount) || 0)
  if (!normalizedAmount) return 0
  return normalizedAmount
}

export async function deleteReceiptAsset(path) {
  if (!path) return
  try {
    await deleteObject(storageRef(storage, path))
  } catch {
    // Ignore missing or already-deleted assets so the Firestore delete can still finish.
  }
}

export function getReceiptExtension(fileName = '', fallback = 'jpg') {
  const match = String(fileName || '').match(/\.([a-z0-9]+)$/i)
  return (match?.[1] || fallback).toLowerCase()
}
