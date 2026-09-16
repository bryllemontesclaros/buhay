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


