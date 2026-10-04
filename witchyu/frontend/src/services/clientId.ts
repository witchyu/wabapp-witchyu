// รหัสอุปกรณ์สุ่ม (ใช้ระบุเจ้าของการจองจนกว่าจะมีระบบล็อกอินใน Phase 8) — เก็บในเบราว์เซอร์นี้
const KEY = 'witchyu.clientId'
const OK = /^[A-Za-z0-9_-]{16,64}$/
let cached: string | null = null

export function getClientId(): string {
  if (cached) return cached
  try {
    const v = localStorage.getItem(KEY)
    if (v && OK.test(v)) return (cached = v)
  } catch { /* ใช้ค่าในหน่วยความจำแทน */ }
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  try { localStorage.setItem(KEY, id) } catch { /* ignore */ }
  return (cached = id)
}
