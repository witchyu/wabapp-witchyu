import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import { ErrorState, Spinner } from '../components/states'
import StatusBadge from '../components/StatusBadge'
import { useBooking } from '../hooks/useBooking'
import { dateLong } from '../utils/format'

export default function Success() {
  const { id } = useParams()
  const nav = useNavigate()
  const { bookings, bookingsStatus } = useBooking()
  const b = bookings.find((x) => x.id === id)
  if (!b && bookingsStatus === 'loading') return <Spinner />
  if (!b) return <ErrorState title="ไม่พบรายการจอง" text="ลองเปิดดูในหน้าการจอง" onRetry={() => nav('/bookings')} />

  const rows: [string, string][] = [
    ['เลขที่การจอง', b.id],
    ['บริการ', `${b.serviceName}${b.questionCount ? ` (${b.questionCount} คำถาม)` : ''}`],
    ['วันที่', dateLong(b.date)],
    ['เวลา', `${b.time} น.`],
  ]

  return (
    <div className="px-5 pt-16">
      <div className="flex flex-col items-center text-center">
        <div className="grid h-20 w-20 animate-pop place-items-center rounded-full bg-ok/15 text-ok"><Check size={40} strokeWidth={3} /></div>
        <h1 className="mt-5 font-display text-2xl font-semibold">จองคิวสำเร็จ</h1>
      </div>
      <div className="mt-8 divide-y divide-line rounded-2xl border border-line bg-surface">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-3 text-sm"><span className="text-mute">{k}</span><span className="text-right">{v}</span></div>
        ))}
        <div className="flex items-center justify-between px-4 py-3 text-sm"><span className="text-mute">สถานะ</span><StatusBadge status={b.status} /></div>
      </div>
      <div className="mt-6 grid gap-3">
        <button onClick={() => nav(`/bookings/${b.id}`)} className="h-14 rounded-2xl bg-gold font-semibold text-night active:scale-[.98]">ดูรายละเอียด</button>
        <button onClick={() => nav('/chat')} className="h-14 rounded-2xl bg-raised font-medium active:scale-[.98]">แชตกับหมอดู</button>
        <Link to="/" className="py-3 text-center text-sm text-mute">กลับหน้าแรก</Link>
      </div>
    </div>
  )
}
