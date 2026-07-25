import { useState, useEffect } from 'react'
import { listenCol } from '../lib/firestore'

/**
 * Reusable hook to subscribe to Lakas workout logs from Firestore.
 * @param {string} uid - User ID
 * @returns {{ workouts: Array, loading: boolean }}
 */
export function useWorkouts(uid) {
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) {
      setWorkouts([])
      setLoading(false)
      return
    }

    const unsub = listenCol(uid, 'lakasWorkouts', data => {
      setWorkouts(data || [])
      setLoading(false)
    })

    return () => {
      if (unsub) unsub()
    }
  }, [uid])

  return { workouts, loading }
}
