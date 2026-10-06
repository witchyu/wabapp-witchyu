import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import ThreadList from '../components/chat/ThreadList'
import { EmptyState, ErrorState, Spinner } from '../components/states'
import { useChatSocket } from '../hooks/useChatSocket'
import { customerChatApi } from '../services/chatApi'
import { errorMessage } from '../services/api'
import type { ChatThread } from '../types/chat'

export function DoctorAvatar({ size = 40 }: { size?: number }) {
  return <img src="/icon.png" alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
}

export default function Chat() {
  const nav = useNavigate()
  const { socket, unread } = useChatSocket()
  const [threads, setThreads] = useState<ChatThread[] | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    customerChatApi.threads().then((t) => { setThreads(t); setError('') }).catch((e) => setError(errorMessage(e)))
  }, [])

  // โหลดตอนเปิดหน้า และโหลดใหม่เมื่อมีข้อความเข้า/อ่านแล้ว (unread เปลี่ยน)
  useEffect(load, [load, unread])
  useEffect(() => {
    if (!socket) return
    socket.on('message:new', load)
    return () => { socket.off('message:new', load) }
  }, [socket, load])

  return (
    <div>
      <PageHeader title="แชต" />
      {!threads && !error && <Spinner />}
      {!threads && error && <ErrorState title="โหลดรายการแชตไม่สำเร็จ" text={error} onRetry={load} />}
      {threads && threads.length === 0 && (
        <EmptyState icon={<MessageCircle size={28} />} title="ยังไม่มีแชต" text="แชตกับหมอดูเปิดให้หลังจากจองคิวและชำระเงินแล้ว" action={<button onClick={() => nav('/booking')} className="h-12 rounded-2xl bg-gold px-8 font-semibold text-night">จองคิว</button>} />
      )}
      {threads && threads.length > 0 && (() => {
        const upcoming = threads
          .filter((t) => t.booking.status === 'confirmed')
          .sort((a, b) => {
            const aKey = `${a.booking.date} ${a.booking.time}`
            const bKey = `${b.booking.date} ${b.booking.time}`
            return aKey.localeCompare(bKey)
          })

        const completed = threads
          .filter((t) => t.booking.status === 'completed')
          .sort((a, b) => {
            const aStamp = a.lastMessage?.createdAt ?? 0
            const bStamp = b.lastMessage?.createdAt ?? 0
            return bStamp - aStamp
          })

        const threadList = (items: ChatThread[]) => (
          <ThreadList
            threads={items}
            role="customer"
            hrefOf={(t) => `/chat/${t.booking.id}`}
            titleOf={() => 'Witchyu · หมอดู'}
            avatarOf={() => <DoctorAvatar size={44} />}
          />
        )

        return (
          <div className="grid gap-6 px-4 pt-4 pb-6">
            {upcoming.length > 0 && (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-lg font-semibold">แชตที่กำลังจะถึง</h2>
                  <span className="text-xs text-mute">{upcoming.length} รายการ</span>
                </div>
                {threadList(upcoming)}
              </section>
            )}

            {completed.length > 0 && (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-lg font-semibold">แชตที่ผ่านมา</h2>
                  <span className="text-xs text-mute">{completed.length} รายการ</span>
                </div>
                {threadList(completed)}
              </section>
            )}
          </div>
        )
      })()}
    </div>
  )
}
