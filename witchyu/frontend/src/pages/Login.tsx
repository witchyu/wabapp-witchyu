import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, LockKeyhole, Mail } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { ApiError } from '../services/api'

export default function Login() {
  const { login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim() || !password) return toast('กรุณากรอกอีเมลและรหัสผ่าน', 'error')

    setLoading(true)
    try {
      await login(email.trim(), password)
      toast('เข้าสู่ระบบสำเร็จ', 'success')
      navigate('/profile', { replace: true })
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'เข้าสู่ระบบไม่สำเร็จ', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen px-5 py-8">
      <button onClick={() => navigate(-1)} className="mb-8 flex items-center gap-2 text-sm text-mute">
        <ArrowLeft size={18} /> กลับ
      </button>

      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-purple-600/15 text-2xl text-purple-400">✦</div>
          <h1 className="font-display text-3xl font-bold">ยินดีต้อนรับกลับ</h1>
          <p className="mt-2 text-sm text-mute">เข้าสู่ระบบ Witchyu ของคุณ</p>
        </div>

        <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-line bg-surface p-5">
          <label className="grid gap-2 text-sm">
            อีเมล
            <span className="flex h-12 items-center gap-3 rounded-xl border border-line bg-night px-3">
              <Mail size={18} className="text-mute" />
              <input className="min-w-0 flex-1 bg-transparent outline-none" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" required />
            </span>
          </label>

          <label className="grid gap-2 text-sm">
            รหัสผ่าน
            <span className="flex h-12 items-center gap-3 rounded-xl border border-line bg-night px-3">
              <LockKeyhole size={18} className="text-mute" />
              <input className="min-w-0 flex-1 bg-transparent outline-none" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="รหัสผ่าน" required />
            </span>
          </label>

          <button disabled={loading} className="mt-2 h-12 rounded-xl bg-purple-600 font-semibold text-white disabled:opacity-50">
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-mute">
          ยังไม่มีบัญชี? <Link to="/register" className="font-semibold text-purple-400">สมัครสมาชิก</Link>
        </p>
        <p className="mt-5 text-center text-xs text-mute">
          หรือ <Link to="/" className="underline">ใช้งานต่อโดยไม่เข้าสู่ระบบ</Link>
        </p>
      </div>
    </main>
  )
}
