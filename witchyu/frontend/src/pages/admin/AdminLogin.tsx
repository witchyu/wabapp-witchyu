import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAdminAuth } from '../../hooks/useAdminAuth'
import { errorMessage } from '../../services/api'

const input = 'h-12 w-full rounded-xl border border-line bg-surface px-4 text-ink focus:border-gold focus:outline-none'

export default function AdminLogin() {
  const { status, login } = useAdminAuth()
  const nav = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (status === 'in') return <Navigate to="/admin" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await login(username, password)
      nav('/admin', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center px-6 py-16">
      <img src="/icon.png" alt="Witchyu" className="mx-auto h-16 w-16 rounded-2xl object-cover" />
      <h1 className="mt-4 text-center font-display text-2xl font-semibold">Witchyu Admin</h1>
      <p className="mt-1 text-center text-sm text-mute">เข้าสู่ระบบสำหรับผู้ดูแล</p>
      <form onSubmit={submit} className="mt-8 grid gap-3">
        <label className="grid gap-1.5 text-sm">ชื่อผู้ใช้
          <input className={input} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" />
        </label>
        <label className="grid gap-1.5 text-sm">รหัสผ่าน
          <input className={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        {error && <p role="alert" className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
        <button disabled={busy || !username || !password} className="mt-2 flex h-14 items-center justify-center gap-2 rounded-2xl bg-gold font-semibold text-night disabled:opacity-60">
          {busy ? <><Loader2 className="animate-spin" size={20} />กำลังเข้าสู่ระบบ</> : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </div>
  )
}
