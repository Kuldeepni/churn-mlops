import { useEffect, useState } from 'react'
import { healthCheck } from '../lib/api'
export type ApiStatus = 'checking' | 'waking' | 'online' | 'offline'
export function useApiStatus() {
  const [status, setStatus] = useState<ApiStatus>('checking')
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    let cancelled = false
    const start = Date.now()
    const ping = async () => {
      try {
        await healthCheck()
        if (!cancelled) setStatus('online')
      } catch {
        if (cancelled) return
        const sec = (Date.now() - start) / 1000
        setElapsed(sec)
        if (sec < 90) {
          setStatus('waking')
          setTimeout(ping, 4000)
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