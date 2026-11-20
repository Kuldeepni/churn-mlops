import { useCallback, useEffect, useState } from 'react'
import { healthCheck } from '../lib/api'

export type ApiStatus = 'checking' | 'waking' | 'online' | 'offline'

const RETRY_MS = 4000
const GIVE_UP_MS = 90_000

/**
 * Small state machine for the free-tier model server:
 * checking -> online, or checking -> waking -> online / offline.
 * Retries every 4s for 90s, then settles on offline (demo mode).
 */
export function useApiStatus() {
  const [status, setStatus] = useState<ApiStatus>('checking')
  const [nonce, setNonce] = useState(0)

  const retry = useCallback(() => setNonce((value) => value + 1), [])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const startedAt = Date.now()

    const tick = async () => {
      if (cancelled) return
      try {
        const ok = await healthCheck()
        if (cancelled) return
        if (ok) {
          setStatus('online')
          return
        }
      } catch {
        /* a failed health check is expected while the space wakes */
      }

      if (cancelled) return
      if (Date.now() - startedAt >= GIVE_UP_MS) {
        setStatus('offline')
        return
      }
      setStatus('waking')
      timer = setTimeout(tick, RETRY_MS)
    }

    setStatus('checking')
    void tick()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [nonce])

  return { status, retry }
}
