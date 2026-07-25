import { useState, useEffect } from 'react'
import { listenCol } from '../lib/firestore'

/**
 * Reusable hook to subscribe to user transactions from Firestore.
 * @param {string} uid - User ID
 * @returns {{ transactions: Array, loading: boolean }}
 */
export function useTransactions(uid) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) {
      setTransactions([])
      setLoading(false)
      return
    }

    const unsub = listenCol(uid, 'transactions', data => {
      setTransactions(data || [])
      setLoading(false)
    })

    return () => {
      if (unsub) unsub()
    }
  }, [uid])

  return { transactions, loading }
}
