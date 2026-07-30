import { notifyApp } from './appFeedback'
import { fsAddTransaction } from './firestore'

const OFFLINE_QUEUE_KEY = 'buhay_offline_mutation_queue'

export function getOfflineQueue() {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveOfflineQueue(queue) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
  } catch (e) {
    console.warn('Failed to save offline queue:', e)
  }
}

export function enqueueOfflineTransaction(uid, col, data) {
  const queue = getOfflineQueue()
  const item = {
    id: 'offline_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    uid,
    col,
    data,
    queuedAt: Date.now(),
  }
  queue.push(item)
  saveOfflineQueue(queue)
  notifyApp({
    title: 'Saved Offline 📡',
    message: 'Your transaction was saved locally and will auto-sync when online.',
    tone: 'info',
  })
  return item
}

export async function processOfflineQueue(accounts = []) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return
  const queue = getOfflineQueue()
  if (!queue.length) return

  let syncedCount = 0
  const remaining = []

  for (const item of queue) {
    try {
      await fsAddTransaction(item.uid, item.col, item.data, accounts)
      syncedCount++
    } catch (e) {
      console.warn('Failed to sync offline item:', item, e)
      remaining.push(item)
    }
  }

  saveOfflineQueue(remaining)

  if (syncedCount > 0) {
    notifyApp({
      title: 'Back Online! ⚡',
      message: `Synced ${syncedCount} offline transaction(s) to Buhay.`,
      tone: 'success',
    })
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    processOfflineQueue()
  })
}
