import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, ChevronLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useChatSocket } from '../hooks/useChatSocket'

interface Props { title: string; back?: boolean | string; right?: ReactNode }

export default function PageHeader({ title, back, right }: Props) {
  const nav = useNavigate()
  const { notificationUnread } = useChatSocket()
  const goBack = () => (typeof back === 'string' ? nav(back) : nav(-1))
  return (
    <header
      className="sticky top-0 z-20 mx-3 mt-2 flex items-center gap-2 rounded-2xl border border-line bg-night/90 px-3 pb-3 shadow-sm backdrop-blur"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
    >
      {back ? (
        <button onClick={goBack} aria-label="ย้อนกลับ" className="grid h-11 w-11 place-items-center rounded-full active:bg-raised"><ChevronLeft size={24} /></button>
      ) : <span className="w-2" />}
      <h1 className="flex-1 font-display text-lg font-semibold">{title}</h1>
      {right}
      <Link
        to="/notifications"
        aria-label={notificationUnread > 0 ? `การแจ้งเตือน ${notificationUnread} รายการที่ยังไม่อ่าน` : 'การแจ้งเตือน'}
        className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-mute transition-colors hover:bg-raised hover:text-gold"
      >
        <Bell size={21} />
        {notificationUnread > 0 && (
          <span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] font-bold text-white">
            {notificationUnread > 9 ? '9+' : notificationUnread}
          </span>
        )}
      </Link>
    </header>
  )
}
