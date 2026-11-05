import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { Bell, LogOut, Moon, Sun } from 'lucide-react'
import { useAdminAuth } from '../../hooks/useAdminAuth'
import { ChatSocketProvider, useChatSocket } from '../../hooks/useChatSocket'
import { adminApi } from '../../services/adminApi'
import { Spinner } from '../states'
import { useTheme } from '../ThemeProvider'

const TABS = [
  { to: '/admin', label: 'ภาพรวม', end: true },
  { to: '/admin/bookings', label: 'การจอง' },
  { to: '/admin/chat', label: 'แชต', badge: true },
  { to: '/admin/services', label: 'บริการ' },
  { to: '/admin/slots', label: 'รอบเวลา' },
  { to: '/admin/queue-update', label: 'อัพเดทคิว' },
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
  const { unread, socket } = useChatSocket()
  const { theme, toggleTheme } = useTheme()
  const [notices, setNotices] = useState<{ id: string; title: string; detail: string; time: string }[]>([])
  const [noticeOpen, setNoticeOpen] = useState(false)

  useEffect(() => {
    if (!socket) return

    const addNotice = (title: string, detail: string, id: string) => {
      setNotices((items) => [
        { id, title, detail, time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) },
        ...items,
      ].slice(0, 30))
    }

    const onBooking = (b: { id?: string; serviceName?: string; date?: string; time?: string }) => {
      addNotice('มีการจองใหม่', `${b.serviceName ?? 'รายการจอง'} · ${b.date ?? ''} ${b.time ?? ''}`, `booking-${b.id ?? Date.now()}`)
    }

    const onMessage = (m: { id?: string; senderRole?: string; body?: string; bookingId?: string }) => {
      if (m?.senderRole !== 'customer') return
      addNotice('มีข้อความแชตใหม่', m.body ?? 'ลูกค้าส่งข้อความใหม่', `chat-${m.id ?? Date.now()}`)
    }

    socket.on('booking:new', onBooking)
    socket.on('message:new', onMessage)
    return () => {
      socket.off('booking:new', onBooking)
      socket.off('message:new', onMessage)
    }
  }, [socket])

  return (
    <div className="min-h-full bg-night">
      <header className="sticky top-0 z-20 border-b border-line bg-night/95 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <img src="/icon.png" alt="" className="h-9 w-9 rounded-lg object-cover" />
          <div className="flex-1">
            <div className="font-display text-lg font-semibold leading-tight">Witchyu Admin</div>
            <div className="text-xs text-mute">{displayName}</div>
          </div>
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
            title={theme === 'dark' ? 'โหมดสว่าง' : 'โหมดมืด'}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface text-mute transition-colors hover:text-gold"
          >
            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <div className="relative">
            <button
              onClick={() => setNoticeOpen((v) => !v)}
              aria-label="การแจ้งเตือน"
              className="relative grid h-11 w-11 place-items-center rounded-xl bg-surface"
            >
              <Bell size={19} />
              {notices.length > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-bad px-1 text-[10px] font-bold text-ink">
                  {notices.length > 99 ? '99+' : notices.length}
                </span>
              )}
            </button>
            {noticeOpen && (
              <div className="absolute right-0 top-14 z-50 w-[min(320px,85vw)] overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <span className="font-semibold">การแจ้งเตือน</span>
                  <button onClick={() => setNotices([])} className="text-xs text-mute">ล้างทั้งหมด</button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notices.length === 0 ? (
                    <p className="p-5 text-center text-sm text-mute">ยังไม่มีการแจ้งเตือน</p>
                  ) : notices.map((n) => (
                    <div key={n.id} className="border-b border-line px-4 py-3">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="mt-1 break-words text-xs text-mute">{n.detail}</p>
                      <p className="mt-1 text-[10px] text-mute">{n.time}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
