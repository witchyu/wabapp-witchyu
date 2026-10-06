import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAdminAuth } from '../../hooks/useAdminAuth'
import { ChatSocketProvider, useChatSocket } from '../../hooks/useChatSocket'
import { adminApi } from '../../services/adminApi'
import { Spinner } from '../states'

const TABS = [
  { to: '/admin', label: 'ภาพรวม', end: true },
  { to: '/admin/bookings', label: 'การจอง' },
  { to: '/admin/chat', label: 'แชต', badge: true },
  { to: '/admin/services', label: 'บริการ' },
  { to: '/admin/slots', label: 'รอบเวลา' },
  { to: '/admin/hours', label: 'เวลาทำการ' },
  { to: '/admin/holidays', label: 'วันหยุด' },
]

// โครงหน้า Admin (แยกจากแอปลูกค้า) — ต้องล็อกอินก่อนถึงเห็นเนื้อหา
export default function AdminShell() {
  const { status } = useAdminAuth()
  if (status === 'checking') return <div className="pt-24"><Spinner label="กำลังตรวจสอบการเข้าสู่ระบบ" /></div>
  if (status === 'out') return <Navigate to="/admin/login" replace />
  // เชื่อม Socket.IO ตลอดที่เปิดหน้า Admin → ลูกค้าจะเห็นว่าหมอดู "ออนไลน์" และแอดมินได้รับแจ้งข้อความใหม่ทันที
  return (
    <ChatSocketProvider role="admin" fetchUnread={adminApi.chatUnread}>
      <Frame />
    </ChatSocketProvider>
  )
}

function Frame() {
  const { displayName, logout } = useAdminAuth()
  const { unread } = useChatSocket()

  return (
    <div className="min-h-full bg-night">
      <header className="sticky top-0 z-20 border-b border-line bg-night/95 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <img src="/icon.png" alt="" className="h-9 w-9 rounded-lg object-cover" />
          <div className="flex-1">
            <div className="font-display text-lg font-semibold leading-tight">Witchyu Admin</div>
            <div className="text-xs text-mute">{displayName}</div>
          </div>
          <button onClick={logout} className="flex h-11 items-center gap-2 rounded-xl bg-surface px-4 text-sm"><LogOut size={16} />ออกจากระบบ</button>
        </div>
        <nav className="no-scrollbar mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3" aria-label="เมนูแอดมิน">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `flex h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium ${isActive ? 'bg-gold text-night' : 'bg-surface text-mute'}`}>
              {t.label}
              {'badge' in t && unread > 0 && <span className="ml-2 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-bad px-1 text-[11px] font-bold text-ink">{unread > 99 ? '99+' : unread}</span>}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)' }}>
        <Outlet />
      </main>
    </div>
  )
}
