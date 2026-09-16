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
  if (bill.paidPeriods && bill.paidPeriods[period.key]) {
    throw new Error('This bill is already marked paid for this period.')
  }
  const accountId = payment.accountId || bill.accountId || ''
  
  let expenseId = ''
  if (!payment.skipExpense) {
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
    expenseId = txRef.id
  }

  const paidAt = Date.now()
  const periodRecord = {
    paidAt,
    amount,
    date,
    accountId,
    expenseId,
    dueDate: period.dueDate,
  }

  const existingPeriods = bill.paidPeriods && typeof bill.paidPeriods === 'object' ? bill.paidPeriods : {}
  const mergedPaidPeriods = {
    ...existingPeriods,
    [period.key]: periodRecord,
  }

  const billData = {
    name: bill.name || 'Bill',
    amount: Number(bill.amount) || amount,
    due: Number(bill.due) || 1,
    cat: bill.cat || 'Bills',
    subcat: bill.subcat || 'Other',
    presetKey: bill.presetKey || '',
    freq: bill.freq || 'monthly',
    accountId: bill.accountId || '',
    autoDeduct: Boolean(bill.autoDeduct),
    type: 'bill',
    paidPeriods: mergedPaidPeriods,
    paid: true,
    paidAt,
    lastPaidPeriod: period.key,
    lastPaidExpenseId: expenseId,
  }

  await setDoc(doc(db, 'users', uid, 'bills', bill._id), billData, { merge: true })

  if (bill.originalDebtId) {
    try {
      await setDoc(doc(db, 'users', uid, 'debts', bill.originalDebtId), {
        paidPeriods: mergedPaidPeriods,
      }, { merge: true })
    } catch (err) {
      console.warn('Could not update original debt paidPeriods', err)
    }
  } else if (bill.accountId && String(bill._id).startsWith('virtual-acc-')) {
    try {
      await setDoc(doc(db, 'users', uid, 'accounts', bill.accountId), {
        paidPeriods: mergedPaidPeriods,
      }, { merge: true })
    } catch (err) {
      console.warn('Could not update virtual account paidPeriods', err)
    }
  }

  return { transactionId: expenseId, paidAt, period }
}

function getTransferOutDelta(account = {}, amount = 0) {
  const normalizedAmount = Math.abs(Number(amount) || 0)
  if (!normalizedAmount) return 0
  return -normalizedAmount
}

function getTransferInDelta(account = {}, amount = 0) {
  const normalizedAmount = Math.abs(Number(amount) || 0)
  if (!normalizedAmount) return 0
  return normalizedAmount
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
    const billRef = doc(db, 'users', uid, 'bills', tx.billId)
    const billSnap = await getDoc(billRef)
    if (billSnap.exists()) {
      batch.update(billRef, {
        [`paidPeriods.${tx.billPeriodKey}`]: deleteField(),
        paid: false,
        paidAt: 0,
        lastPaidPeriod: '',
        lastPaidExpenseId: '',
      })
    }
  }

  batch.delete(doc(db, 'users', uid, col, tx._id))
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












