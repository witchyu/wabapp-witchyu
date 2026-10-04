import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ClipboardX } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import { EmptyState, ErrorState, Spinner } from '../components/states'
import { useBooking } from '../hooks/useBooking'
import type { Booking } from '../types'
import { baht, dateShort } from '../utils/format'

const TABS = [
  { id: 'upcoming', label: 'กำลังจะถึง', match: (b: Booking) => b.status === 'confirmed' || b.status === 'pending_payment' },
  { id: 'done', label: 'เสร็จแล้ว', match: (b: Booking) => b.status === 'completed' },
  { id: 'cancelled', label: 'ยกเลิก', match: (b: Booking) => b.status === 'cancelled' },
] as const

export default function Bookings() {
  const nav = useNavigate()
  const { bookings, bookingsStatus, bookingsError, refreshBookings } = useBooking()
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('upcoming')
  const current = TABS.find((t) => t.id === tab)!
  const list = bookings
    .filter(current.match)
    .sort((a, b) => (tab === 'upcoming' ? `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`) : `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)))

  if (bookingsStatus === 'loading') return <div><PageHeader title="การจอง" /><Spinner /></div>
  if (bookingsStatus === 'error') return <div><PageHeader title="การจอง" /><ErrorState title="โหลดรายการจองไม่สำเร็จ" text={bookingsError} onRetry={refreshBookings} /></div>

  return (
    <div>
      <PageHeader title="การจอง" />
      <div className="grid grid-cols-3 gap-1 px-4 pt-3">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`h-11 rounded-xl text-sm font-medium ${tab === t.id ? 'bg-gold text-night' : 'bg-surface text-mute'}`}>
            {t.label} <span className="opacity-70">{bookings.filter(t.match).length}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<ClipboardX size={28} />} title="ยังไม่มีรายการ" text="เมื่อคุณจองคิว รายการจะมาแสดงที่นี่" action={tab === 'upcoming' ? <button onClick={() => nav('/booking')} className="h-12 rounded-2xl bg-gold px-8 font-semibold text-night">จองคิว</button> : undefined} />
      ) : (
        <ul className="grid gap-3 px-4 pt-4 md:grid-cols-2 lg:grid-cols-3">
          {list.map((b) => (
            <li key={b.id}>
              <Link to={`/bookings/${b.id}`} className="block rounded-2xl border border-line bg-surface p-4 active:bg-raised">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-mute">{b.id}</span>
                  <StatusBadge status={b.status} />
                </div>
                <div className="mt-2 font-semibold">{b.serviceName}{b.questionCount ? ` (${b.questionCount} คำถาม)` : ''}</div>
                <div className="mt-1 flex items-center justify-between text-sm text-mute">
                  <span>{dateShort(b.date)} · {b.time} น.</span>
                  <span className="font-semibold text-gold">{baht(b.price)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
