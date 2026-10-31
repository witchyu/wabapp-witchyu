import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { ApiError } from '../services/api'
import { RELATIONSHIPS } from '../data/shop'
import { useBooking } from '../hooks/useBooking'

export default function Register() {
  const { register } = useAuth()
  const { profile } = useBooking()
  const toast = useToast()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [nickname, setNickname] = useState(profile.nickname || '')
  const [fullName, setFullName] = useState(profile.fullName || '')
  const [age, setAge] = useState(profile.age || '')
  const [relationship, setRelationship] = useState(profile.relationship || RELATIONSHIPS[0])
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()

    if (password.length < 10 || password.length > 128) {
      return toast('รหัสผ่านต้องมีความยาว 10–128 ตัวอักษร', 'error')
    }
    if (password !== confirm) return toast('รหัสผ่านทั้งสองช่องไม่ตรงกัน', 'error')
    if (!nickname.trim() || !fullName.trim()) return toast('กรุณากรอกชื่อเล่นและชื่อจริง', 'error')

    const numericAge = Number(age)
    if (!numericAge || numericAge < 1 || numericAge > 120) {
      return toast('กรุณากรอกอายุให้ถูกต้อง', 'error')
    }

    setLoading(true)
    try {
      await register(email.trim(), password, {
        nickname: nickname.trim(),
        fullName: fullName.trim(),
        age: numericAge,
        relationship,
      })
      toast('สมัครสมาชิกสำเร็จ', 'success')
      navigate('/profile', { replace: true })
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'สมัครสมาชิกไม่สำเร็จ', 'error')
    } finally {
      setLoading(false)
    }
  }

  const field = 'h-12 w-full rounded-xl border border-line bg-night px-4 outline-none focus:border-purple-500'

  return (
    <main className="min-h-screen px-5 py-8">
      <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-sm text-mute">
        <ArrowLeft size={18} /> กลับ
      </button>

      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-purple-600/15 text-2xl text-purple-400">✦</div>
          <h1 className="font-display text-3xl font-bold">สร้างบัญชี Witchyu</h1>
          <p className="mt-2 text-sm text-mute">บันทึกบัญชีเพื่อกลับมาใช้งานได้สะดวก</p>
        </div>

        <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-line bg-surface p-5">
          <label className="grid gap-1.5 text-sm">อีเมล
            <span className="relative"><Mail className="absolute left-3 top-3.5 text-mute" size={18} /><input className={`${field} pl-10`} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@example.com" /></span>
          </label>
          <label className="grid gap-1.5 text-sm">รหัสผ่าน
            <span className="relative"><LockKeyhole className="absolute left-3 top-3.5 text-mute" size={18} /><input className={`${field} pl-10`} type="password" autoComplete="new-password" minLength={10} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="อย่างน้อย 10 ตัวอักษร" /></span>
          </label>
          <label className="grid gap-1.5 text-sm">ยืนยันรหัสผ่าน
            <input className={field} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="กรอกรหัสผ่านอีกครั้ง" />
          </label>

          <div className="my-2 border-t border-line" />
          <p className="flex items-center gap-2 text-sm font-semibold"><UserRound size={18} /> ข้อมูลส่วนตัว</p>

          <label className="grid gap-1.5 text-sm">ชื่อเล่น
            <input className={field} value={nickname} onChange={(e) => setNickname(e.target.value)} required />
          </label>
          <label className="grid gap-1.5 text-sm">ชื่อจริง
            <input className={field} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </label>
          <label className="grid gap-1.5 text-sm">อายุ
            <input className={field} type="number" min="1" max="120" value={age} onChange={(e) => setAge(e.target.value)} required />
          </label>
          <label className="grid gap-1.5 text-sm">สถานะความสัมพันธ์
            <select className={field} value={relationship} onChange={(e) => setRelationship(e.target.value)}>
              {RELATIONSHIPS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <button disabled={loading} className="mt-3 h-12 rounded-xl bg-purple-600 font-semibold text-white disabled:opacity-50">
            {loading ? 'กำลังสมัครสมาชิก...' : 'สมัครสมาชิก'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-mute">
          มีบัญชีแล้ว? <Link to="/login" className="font-semibold text-purple-400">เข้าสู่ระบบ</Link>
        </p>
      </div>
    </main>
  )
}
