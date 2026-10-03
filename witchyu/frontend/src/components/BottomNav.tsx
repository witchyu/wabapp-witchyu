import { NavLink } from 'react-router-dom'
import { CalendarPlus, ClipboardList, Home, MessageCircle, User } from 'lucide-react'

const ITEMS = [
  { to: '/', label: 'หน้าแรก', icon: Home, end: true },
  { to: '/booking', label: 'จองคิว', icon: CalendarPlus },
  { to: '/bookings', label: 'การจอง', icon: ClipboardList },
  { to: '/chat', label: 'แชต', icon: MessageCircle },
  { to: '/profile', label: 'โปรไฟล์', icon: User },
]

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur safe-bottom" aria-label="เมนูหลัก">
      <ul className="mx-auto flex max-w-2xl">
        {ITEMS.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink to={to} end={end} className={({ isActive }) => `flex h-16 flex-col items-center justify-center gap-1 text-[11px] transition-colors ${isActive ? 'text-gold' : 'text-mute'}`}>
              {({ isActive }) => (
                <>
                  <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
                  <span className={isActive ? 'font-semibold' : ''}>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
