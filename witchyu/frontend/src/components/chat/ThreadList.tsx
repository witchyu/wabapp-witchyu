import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { ChatRole, ChatThread } from '../../types/chat'
import { dateShort } from '../../utils/format'
import { previewOf, timeLabel } from '../../utils/chat'

// รายการบทสนทนา (ใช้ร่วมกันทั้งฝั่งลูกค้าและแอดมิน)
export default function ThreadList({ threads, role, hrefOf, titleOf, avatarOf }: {
  threads: ChatThread[]
  role: ChatRole
  hrefOf: (t: ChatThread) => string
  titleOf: (t: ChatThread) => string
  avatarOf: (t: ChatThread) => ReactNode
}) {
  return (
    <ul className="grid gap-2">
      {threads.map((t) => (
        <li key={t.booking.id}>
          <Link to={hrefOf(t)} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 active:bg-raised">
            {avatarOf(t)}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate font-medium">{titleOf(t)}</span>
                <span className="shrink-0 text-xs text-mute">{t.lastMessage ? timeLabel(t.lastMessage.createdAt) : ''}</span>
              </div>
              <div className="truncate text-xs text-mute">{t.booking.serviceName} · {dateShort(t.booking.date)} {t.booking.time} · {t.booking.id}</div>
              <div className={`mt-0.5 truncate text-sm ${t.unread > 0 ? 'font-semibold text-ink' : 'text-mute'}`}>
                {t.lastMessage ? previewOf(t.lastMessage, role) : 'ยังไม่มีข้อความ — แตะเพื่อเริ่มคุย'}
              </div>
            </div>
            {t.unread > 0 && <span className="grid h-6 min-w-[1.5rem] place-items-center rounded-full bg-gold px-1.5 text-xs font-bold text-night" aria-label={`ยังไม่อ่าน ${t.unread} ข้อความ`}>{t.unread > 99 ? '99+' : t.unread}</span>}
          </Link>
        </li>
      ))}
    </ul>
  )
}
