import { useEffect, useState } from 'react'

const cache = new Map<string, Promise<unknown>>()

export function loadJson<T>(file: string): Promise<T> {
  const key = file
  if (!cache.has(key)) {
    const url = `${import.meta.env.BASE_URL}data/${file}`
    const promise = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`Could not load ${file} (HTTP ${response.status})`)
      return response.json() as Promise<T>
    })
    cache.set(key, promise)
    promise.catch(() => cache.delete(key))
  }
  return cache.get(key) as Promise<T>
}

interface DataState<T> {
  data: T | null
  error: string | null
  loading: boolean
}

export function useData<T>(file: string): DataState<T> {
  const [state, setState] = useState<DataState<T>>({ data: null, error: null, loading: true })

  useEffect(() => {
    let alive = true
    setState({ data: null, error: null, loading: true })
    loadJson<T>(file)
      .then((data) => {
        if (alive) setState({ data, error: null, loading: false })
      })
      .catch((error: unknown) => {
        if (alive)
          setState({
            data: null,
            error: error instanceof Error ? error.message : 'Could not load data.',
            loading: false,
          })
      })
    return () => {
      alive = false
    }
  }, [file])

  return state
}
