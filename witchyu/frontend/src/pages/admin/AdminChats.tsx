import { useCallback, useEffect, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import ThreadList from '../../components/chat/ThreadList'
import { EmptyState, ErrorState, Spinner } from '../../components/states'
import { useChatSocket } from '../../hooks/useChatSocket'
import { adminApi } from '../../services/adminApi'
import { errorMessage } from '../../services/api'
import type { ChatThread } from '../../types/chat'

export const CustomerAvatar = ({ name, size = 40 }: { name: string; size?: number }) => (
  <span className="grid shrink-0 place-items-center rounded-full border border-gold/40 bg-raised font-display text-gold" style={{ width: size, height: size }}>{name.slice(0, 1) || '?'}</span>
)

export default function AdminChats() {
  const { socket, unread } = useChatSocket()
  const [threads, setThreads] = useState<ChatThread[] | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    adminApi.chats().then((t) => { setThreads(t); setError('') }).catch((e) => setError(errorMessage(e)))
  }, [])

  useEffect(load, [load, unread])
  useEffect(() => {
    if (!socket) return
    socket.on('message:new', load)
    return () => { socket.off('message:new', load) }
  }, [socket, load])

  if (!threads && !error) return <Spinner />
  if (!threads) return <ErrorState title="โหลดรายการแชตไม่สำเร็จ" text={error} onRetry={load} />
  if (threads.length === 0) return <EmptyState icon={<MessageCircle size={28} />} title="ยังไม่มีบทสนทนา" text="เมื่อลูกค้าทักเข้ามา หรือคุณกดปุ่ม “แชต” ที่หน้าการจอง บทสนทนาจะแสดงที่นี่" />

  return (
    <div className="mx-auto max-w-3xl">
      <ThreadList threads={threads} role="admin" hrefOf={(t) => `/admin/chat/${t.booking.id}`} titleOf={(t) => `${t.booking.customer.nickname} (${t.booking.customer.fullName})`} avatarOf={(t) => <CustomerAvatar name={t.booking.customer.nickname} size={44} />} />
    </div>
  )
}
