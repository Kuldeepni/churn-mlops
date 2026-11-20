import { useEffect, useState } from 'react'
import { healthCheck } from '../lib/api'
export type ApiStatus = 'checking' | 'waking' | 'online' | 'offline'
export function useApiStatus() {
  const [status, setStatus] = useState<ApiStatus>('checking')
  useEffect(() => {
    let cancelled = false
    let attempts = 0
    const maxAttempts = 22
    const tick = async () => {
      if (cancelled) return
      attempts++
      try {
        await healthCheck()
        if (!cancelled) setStatus('online')
      } catch {
        if (cancelled) return
        if (attempts < 3) setStatus('checking')
        else if (attempts < maxAttempts) { setStatus('waking'); setTimeout(tick, 4000) }
        else setStatus('offline')
      }
    }
    tick()
    return () => { cancelled = true }
  }, [])
  return { status }
}