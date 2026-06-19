import { getBlob, ref as storageRef } from 'firebase/storage'
import { storage } from './firebase'

export async function loadStorageObjectUrl(path = '') {
  const cleanedPath = String(path || '').trim()
  if (!cleanedPath) return ''

  const blob = await getBlob(storageRef(storage, cleanedPath))
  return URL.createObjectURL(blob)
}
