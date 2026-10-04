import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { adminApi, adminToken, setUnauthorizedHandler } from '../services/adminApi'

type Status = 'checking' | 'out' | 'in'
interface Ctx {
  status: Status
  displayName: string
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AdminAuthCtx = createContext<Ctx | null>(null)
export const useAdminAuth = () => {
  const c = useContext(AdminAuthCtx)
  if (!c) throw new Error('useAdminAuth must be inside AdminAuthProvider')
  return c
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(() => (adminToken.get() ? 'checking' : 'out'))
  const [displayName, setDisplayName] = useState('')

  const logout = useCallback(() => {
    adminToken.clear()
    setDisplayName('')
    setStatus('out')
  }, [])

  // โทเคนหมดอายุกลางคัน → กลับหน้าล็อกอินอัตโนมัติ
  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [logout])

  // เปิดหน้าใหม่แล้วมีโทเคนเก่าค้างอยู่ → ตรวจกับเซิร์ฟเวอร์ก่อน
  useEffect(() => {
    if (status !== 'checking') return
    adminApi
      .me()
      .then((r) => { setDisplayName(r.admin.displayName); setStatus('in') })
      .catch((e) => {
        // 401 ถูกจัดการโดย handler แล้ว ส่วนเครือข่ายล่ม ให้กลับไปหน้าล็อกอินเพื่อไม่ค้างหน้าโหลด
        if ((e as { status?: number })?.status !== 401) logout()
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const r = await adminApi.login(username, password)
    adminToken.set(r.token)
    setDisplayName(r.admin.displayName)
    setStatus('in')
  }, [])

  return <AdminAuthCtx.Provider value={{ status, displayName, login, logout }}>{children}</AdminAuthCtx.Provider>
}
