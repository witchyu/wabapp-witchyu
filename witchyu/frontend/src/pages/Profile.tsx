import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, ChevronRight, ClipboardList, Instagram, LogOut, Mail, MessageCircle, Moon, Sun, Trash2, UserRound } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import BottomSheet from '../components/BottomSheet'
import Modal from '../components/Modal'
import { useBooking } from '../hooks/useBooking'
import { useToast } from '../hooks/useToast'
import { RELATIONSHIPS, SHOP } from '../data/shop'
import type { CustomerInfo } from '../types'
import { useTheme } from '../components/ThemeProvider'
import { useAuth } from '../hooks/useAuth'

const input = 'h-12 w-full rounded-xl border border-line bg-night px-4 text-ink focus:border-gold focus:outline-none'

export default function Profile() {
  const nav = useNavigate()
  const toast = useToast()
  const { profile, setProfile, hasSavedCustomer, clearSavedCustomer } = useBooking()
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [askClear, setAskClear] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<CustomerInfo>(profile)

  const handleLogout = () => {
    logout()
    toast('ออกจากระบบแล้ว ข้อมูลการจองและโปรไฟล์ในอุปกรณ์ยังอยู่', 'success')
    nav('/')
  }
  const save = () => {
    const age = Number(form.age)
    if (!form.nickname.trim() || !form.fullName.trim()) return toast('กรุณากรอกชื่อเล่นและชื่อจริง', 'error')
    if (!form.age || age < 1 || age > 120) return toast('กรุณากรอกอายุให้ถูกต้อง', 'error')
    setProfile(form)
    setEditing(false)
    toast('บันทึกข้อมูลแล้ว', 'success')
  }

  const menu: { icon: ReactNode; label: string; onClick: () => void; soon?: boolean; disabled?: boolean }[] = [
    { icon: <UserRound size={20} />, label: 'ข้อมูลส่วนตัว', onClick: () => { setForm(profile); setEditing(true) } },
    { icon: <ClipboardList size={20} />, label: 'ประวัติการจอง', onClick: () => nav('/bookings') },
    { icon: <Trash2 size={20} />, label: 'ล้างข้อมูลที่บันทึกไว้', onClick: () => (hasSavedCustomer ? setAskClear(true) : toast('ยังไม่มีข้อมูลที่บันทึกไว้ในอุปกรณ์นี้', 'info')) },
    { icon: <Bell size={20} />, label: 'การแจ้งเตือน', onClick: () => nav('/notifications') },
    { icon: <Mail size={20} />, label: 'ติดต่อเรา', onClick: () => setContactOpen(true) },
    {
      icon: theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />,
      label: theme === 'dark' ? 'โหมดสว่าง' : 'โหมดมืด',
      onClick: toggleTheme,
    },
    ...(user
      ? [{ icon: <LogOut size={20} />, label: 'ออกจากระบบ', onClick: handleLogout }]
      : [
          { icon: <UserRound size={20} />, label: 'เข้าสู่ระบบ', onClick: () => nav('/login') },
          { icon: <LogOut size={20} />, label: 'สมัครสมาชิก', onClick: () => nav('/register') },
        ]),
  ]

  return (
    <div>
      <PageHeader title="โปรไฟล์" />
      <div className="flex flex-col items-center px-5 pt-6">
        <div className="grid h-24 w-24 place-items-center rounded-full border border-gold/40 bg-raised font-display text-4xl text-gold">{profile.nickname.slice(0, 1) || '?'}</div>
        <h2 className="mt-3 font-display text-xl font-semibold">{profile.fullName || 'ยังไม่ได้ตั้งชื่อ'}</h2>
        <p className="text-sm text-mute">ชื่อเล่น {profile.nickname || '-'}</p>
        {user ? (
          <p className="mt-1 text-xs text-purple-400">{user.email}</p>
        ) : (
          <p className="mt-1 text-xs text-mute">ใช้งานแบบ Guest</p>
        )}
        <div className="mt-4 flex gap-2 text-sm">
          <span className="rounded-full bg-surface px-3 py-1.5">อายุ {profile.age || '-'}</span>
          <span className="rounded-full bg-surface px-3 py-1.5">{profile.relationship || 'ไม่ระบุสถานะ'}</span>
        </div>
      </div>

      <ul className="mx-4 mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {menu.map((m) => (
          <li key={m.label}>
            <button onClick={m.onClick} disabled={m.disabled} className="flex h-14 w-full items-center gap-3 px-4 text-left active:bg-raised disabled:cursor-not-allowed disabled:opacity-60">
              <span className="text-gold">{m.icon}</span>
              <span className="flex-1">{m.label}</span>
              {m.soon && <span className="rounded-full bg-raised px-2 py-0.5 text-[11px] text-mute">เร็ว ๆ นี้</span>}
              <ChevronRight size={18} className="text-mute" />
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-8 mb-4 text-center text-xs text-mute">
        Witchyu v1.0.0
      </p>

      <BottomSheet open={contactOpen} title="ติดต่อ Witchyu" onClose={() => setContactOpen(false)}>
        <p className="text-sm text-mute">เวลาทำการ: {SHOP.hoursLabel}</p>
        <a
          href="https://www.instagram.com/witchyu_2006?xtok=MTY1dzFwYTZxcHg2Ng%3D%3D&utm_source=qr"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex h-12 items-center justify-center gap-2 rounded-2xl bg-gold font-semibold text-white active:scale-[.98]"
        >
          <Instagram size={18} /> Instagram @witchyu_2006
        </a>
        <button
          onClick={() => { setContactOpen(false); nav('/chat') }}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-raised font-semibold text-ink"
        >
          <MessageCircle size={18} /> ไปที่แชต
        </button>
      </BottomSheet>

      <Modal
        open={askClear}
        danger
        title="ล้างข้อมูลที่บันทึกไว้?"
        confirmLabel="ล้างข้อมูล"
        cancelLabel="ไม่ล้าง"
        onCancel={() => setAskClear(false)}
        onConfirm={() => { clearSavedCustomer(); setAskClear(false); toast('ล้างข้อมูลที่บันทึกไว้แล้ว', 'success') }}
      >
        ข้อมูลที่จำไว้ในอุปกรณ์นี้จะถูกลบ (การจองที่ทำไปแล้วไม่ได้รับผลกระทบ)
      </Modal>

      <BottomSheet open={editing} title="ข้อมูลส่วนตัว" onClose={() => setEditing(false)}>
        <div className="grid gap-3">
          <input className={input} placeholder="ชื่อเล่น" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} />
          <input className={input} placeholder="ชื่อจริง" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <input className={input} placeholder="อายุ" inputMode="numeric" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value.replace(/\D/g, '').slice(0, 3) })} />
          <div className="flex flex-wrap gap-2">
            {RELATIONSHIPS.map((r) => (
              <button key={r} onClick={() => setForm({ ...form, relationship: r })} className={`h-11 rounded-full px-4 text-sm ${form.relationship === r ? 'bg-gold font-semibold text-night' : 'bg-raised text-mute'}`}>{r}</button>
            ))}
          </div>
          <button onClick={save} className="mt-2 h-14 rounded-2xl bg-gold font-semibold text-night">บันทึก</button>
        </div>
      </BottomSheet>
    </div>
  )
}
