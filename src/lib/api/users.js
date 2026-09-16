import { db, storage } from '../firebase'
import {
  collection, addDoc, deleteDoc, updateDoc, setDoc, deleteField,
  doc, query, orderBy, onSnapshot, getDoc, getDocs, writeBatch, increment
} from 'firebase/firestore'
import { deleteObject, ref as storageRef, uploadBytes } from 'firebase/storage'
import { getAccountBalanceDelta, shouldAffectCurrentAccountBalance } from '../finance'
import { getBillPeriodInfo } from '../bills'
import { normalizeDate, today } from '../utils'

import { userCol, fsAdd, fsUpdate, fsDel, chunkList, deleteReceiptAsset } from './core'

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
    'debts',
    'accounts',
    'budgets',
    'receipts',
    'transfers',
    'calendarEvents',
    'balanceOverrideLog',
    'portfolioHoldings',
  ]

  if (clearExisting) {
    const incomingReceiptPaths = collectRestoreAssetPaths(Array.isArray(backup.receipts) ? backup.receipts : [], ['imagePath', 'cleanedImagePath'])

    const receiptsSnapshot = await getDocs(userCol(uid, 'receipts'))

    await Promise.all([
      ...receiptsSnapshot.docs.flatMap(snapshot => {
        const data = snapshot.data() || {}
        return [
          ...getDeletableRestorePaths(data.imagePath, incomingReceiptPaths).map(deleteReceiptAsset),
          ...getDeletableRestorePaths(data.cleanedImagePath, incomingReceiptPaths).map(deleteReceiptAsset),
        ]
      }),
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

  await Promise.all([
    ...receiptsSnapshot.docs.flatMap(snapshot => {
      const data = snapshot.data() || {}
      return [
        deleteReceiptAsset(data.imagePath),
        deleteReceiptAsset(data.cleanedImagePath),
      ]
    }),
  ])

  const collections = [
    'income',
    'expenses',
    'bills',
    'goals',
    'debts',
    'accounts',
    'budgets',
    'receipts',
    'transfers',
    'calendarEvents',
    'balanceOverrideLog',
    'portfolioHoldings',
  ]
  for (const col of collections) {
    await fsDeleteCollection(uid, col)
  }

  try {
    await updateDoc(doc(db, 'users', uid, 'profile', 'main'), {
      dailyBalanceOverrides: deleteField(),
      monthStartBalances: deleteField(),
    })
  } catch (err) {
    console.warn('Could not clear balance overrides on profile', err)
  }
}


export async function fsDeleteAccountData(uid) {
  const receiptsSnapshot = await getDocs(userCol(uid, 'receipts'))

  await Promise.all([
    ...receiptsSnapshot.docs.flatMap(snapshot => {
      const data = snapshot.data() || {}
      return [
        deleteReceiptAsset(data.imagePath),
        deleteReceiptAsset(data.cleanedImagePath),
      ]
    }),
  ])

  const collections = [
    'income',
    'expenses',
    'bills',
    'goals',
    'debts',
    'accounts',
    'budgets',
    'feedback',
    'receipts',
    'transfers',
    'calendarEvents',
    'balanceOverrideLog',
    'portfolioHoldings',
  ]

  for (const col of collections) {
    await fsDeleteCollection(uid, col)
  }

  await deleteDoc(doc(db, 'users', uid, 'profile', 'main'))
}

