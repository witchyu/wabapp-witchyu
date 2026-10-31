import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, CalendarDays, Check, CheckCheck, CreditCard,
  MessageCircle, Settings2, Trash2, Wrench,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { EmptyState, ErrorState, Spinner } from '../components/states'
import { useChatSocket } from '../hooks/useChatSocket'
import { notificationApi, type NotificationItem, type NotificationPreferences } from '../services/notificationApi'

const TYPE_META = {
  booking: { label: 'การจอง', icon: CalendarDays },
  payment: { label: 'การชำระเงิน', icon: CreditCard },
  reminder: { label: 'เตือนความจำ', icon: Bell },
  chat: { label: 'ข้อความ', icon: MessageCircle },
  system: { label: 'ระบบ', icon: Wrench },
} as const

const PREFS: { key: keyof NotificationPreferences; label: string; detail: string }[] = [
  { key: 'bookingEnabled', label: 'การจอง', detail: 'แจ้งเตือนเมื่อจองหรือยกเลิกคิว' },
  { key: 'paymentEnabled', label: 'การชำระเงิน', detail: 'แจ้งผลตรวจสอบหลักฐานการชำระเงิน' },
  { key: 'chatEnabled', label: 'ข้อความแชต', detail: 'แจ้งเมื่อหมอดูส่งข้อความถึงคุณ' },
  { key: 'reminderEnabled', label: 'เตือนความจำ', detail: 'การแจ้งเตือนกำหนดการ' },
  { key: 'systemEnabled', label: 'ข่าวสารระบบ', detail: 'ประกาศและข้อมูลจากระบบ' },
]

function timeLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export default function Notifications() {
  const navigate = useNavigate()
  const { refreshNotificationUnread } = useChatSocket()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [rows, prefs] = await Promise.all([
        notificationApi.list(),
        notificationApi.preferences(),
      ])
      setItems(rows)
      setPreferences(prefs)
      refreshNotificationUnread()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดการแจ้งเตือนไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [refreshNotificationUnread])

  useEffect(() => { void load() }, [load])

  const markRead = async (item: NotificationItem) => {
    if (item.readAt) return
    try {
      await notificationApi.markRead(item.id)
      setItems((current) => current.map((n) =>
        n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n
      ))
      refreshNotificationUnread()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ทำเครื่องหมายไม่สำเร็จ')
    }
  }

  const markAll = async () => {
    try {
      await notificationApi.markAllRead()
      setItems((current) => current.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })))
      refreshNotificationUnread()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ทำเครื่องหมายไม่สำเร็จ')
    }
  }

  const remove = async (id: string) => {
    try {
      await notificationApi.remove(id)
      setItems((current) => current.filter((n) => n.id !== id))
      refreshNotificationUnread()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ลบการแจ้งเตือนไม่สำเร็จ')
    }
  }

  const togglePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!preferences || saving) return
    const previous = preferences
    setPreferences({ ...preferences, [key]: value })
    setSaving(true)
    try {
      const updated = await notificationApi.savePreferences({ [key]: value })
      setPreferences(updated)
    } catch (e) {
      setPreferences(previous)
      setError(e instanceof Error ? e.message : 'บันทึกการตั้งค่าไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const openNotification = async (item: NotificationItem) => {
    await markRead(item)
    const bookingId = item.data?.bookingId
    if (typeof bookingId === 'string' && bookingId) {
      navigate(`/bookings/${encodeURIComponent(bookingId)}`)
    }
  }

  const unreadCount = items.filter((item) => !item.readAt).length

  return (
    <div className="min-h-screen">
      <PageHeader
        title="การแจ้งเตือน"
        back="/"
        right={
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            aria-label="ตั้งค่าการแจ้งเตือน"
            className="grid h-10 w-10 place-items-center rounded-full text-mute hover:bg-raised"
          >
            <Settings2 size={20} />
          </button>
        }
      />

      {showSettings && (
        <section className="mx-4 mt-4 rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-semibold">ตั้งค่าการแจ้งเตือน</h2>
          <p className="mt-1 text-xs text-mute">เลือกประเภทการแจ้งเตือนที่ต้องการรับ</p>
          <div className="mt-3 divide-y divide-line">
            {PREFS.map((pref) => (
              <label key={pref.key} className="flex min-h-16 items-center justify-between gap-3 py-3">
                <span>
                  <span className="block text-sm font-medium">{pref.label}</span>
                  <span className="mt-0.5 block text-xs text-mute">{pref.detail}</span>
                </span>
                <input
                  type="checkbox"
                  checked={preferences?.[pref.key] ?? true}
                  disabled={!preferences || saving}
                  onChange={(e) => void togglePreference(pref.key, e.target.checked)}
                  className="h-5 w-5 accent-purple-600"
                />
              </label>
            ))}
          </div>
        </section>
      )}

      <div className="flex items-center justify-between px-4 pb-2 pt-5">
        <div>
          <h2 className="font-semibold">รายการล่าสุด</h2>
          <p className="text-xs text-mute">ยังไม่อ่าน {unreadCount} รายการ</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={() => void markAll()} className="flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-gold hover:bg-raised">
            <CheckCheck size={16} /> อ่านทั้งหมด
          </button>
        )}
      </div>

      {loading ? <Spinner /> : error && items.length === 0 ? (
        <ErrorState title="โหลดการแจ้งเตือนไม่สำเร็จ" text={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState icon={<Bell size={28} />} title="ยังไม่มีการแจ้งเตือน" text="เมื่อมีรายการจอง ผลการชำระเงิน หรือข้อความใหม่ การแจ้งเตือนจะแสดงที่นี่" />
      ) : (
        <ul className="grid gap-2 px-4 pb-8">
          {items.map((item) => {
            const meta = TYPE_META[item.type]
            const Icon = meta.icon
            return (
              <li key={item.id} className={`rounded-2xl border p-3 transition-colors ${item.readAt ? 'border-line bg-surface' : 'border-purple-500/30 bg-purple-500/[0.07]'}`}>
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => void openNotification(item)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.readAt ? 'bg-raised text-mute' : 'bg-purple-500/15 text-gold'}`}>
                      <Icon size={19} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{item.title}</span>
                        {!item.readAt && <span className="h-2 w-2 rounded-full bg-purple-500" />}
                      </span>
                      <span className="mt-1 block whitespace-pre-wrap break-words text-sm text-mute">{item.message}</span>
                      <span className="mt-2 block text-[11px] text-mute">{meta.label} · {timeLabel(item.createdAt)}</span>
                    </span>
                  </button>
                  <div className="flex shrink-0 flex-col gap-1">
                    {!item.readAt && (
                      <button onClick={() => void markRead(item)} aria-label="ทำเครื่องหมายว่าอ่านแล้ว" className="grid h-9 w-9 place-items-center rounded-lg text-gold hover:bg-raised">
                        <Check size={17} />
                      </button>
                    )}
                    <button onClick={() => void remove(item.id)} aria-label="ลบการแจ้งเตือน" className="grid h-9 w-9 place-items-center rounded-lg text-mute hover:bg-raised hover:text-bad">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {error && items.length > 0 && <p role="alert" className="mx-4 mb-4 text-sm text-bad">{error}</p>}
    </div>
  )
}
