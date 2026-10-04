import { useCallback, useEffect, useState } from 'react'
import { errorMessage } from '../../services/api'

// โหลดข้อมูลแบบมีสถานะ loading / error / ready และสั่งโหลดซ้ำได้
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setStatus((s) => (s === 'ready' ? 'ready' : 'loading')) // โหลดซ้ำแล้วคงข้อมูลเดิมไว้ ไม่กะพริบ
    fn()
      .then((d) => { if (!cancelled) { setData(d); setStatus('ready'); setError('') } })
      .catch((e) => { if (!cancelled) { setError(errorMessage(e)); setStatus((s) => (s === 'ready' ? 'ready' : 'error')) } })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, setData, status, error, reload }
}
