import { useEffect, useState } from 'react'
import { healthCheck } from '../lib/api'

export type ApiStatus = 'checking' | 'waking' | 'online' | 'offline'

export function useApiStatus() {
  const [status, setStatus] = useState<ApiStatus>('checking')
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    let cancelled = false
    let attempts = 0
    const maxAttempts = 18
    const interval = 5000

    const ping = async () => {
      attempts++
      try {
        await healthCheck()
        if (!cancelled) setStatus('online')
      } catch {
        if (cancelled) return
        if (attempts < maxAttempts) {
          setStatus('waking')
          setElapsed(attempts * 5)
          setTimeout(ping, interval)
        } else {
          setStatus('offline')
        }
      }
    }
    ping()
    return () => { cancelled = true }
  }, [])

  return { status, elapsed }
}
