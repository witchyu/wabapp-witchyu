import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Instagram, MessageCircle } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import { ErrorState, Spinner } from '../components/states'
import { errorMessage } from '../services/api'
import { useBooking } from '../hooks/useBooking'
import { useToast } from '../hooks/useToast'
import { baht, dateLong } from '../utils/format'

export default function BookingDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const { bookings, bookingsStatus, bookingsError, refreshBookings, cancelBooking } = useBooking()
  const [askCancel, setAskCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const b = bookings.find((x) => x.id === id)

  if (!b && bookingsStatus === 'loading') return <div><PageHeader title="รายละเอียดการจอง" back="/bookings" /><Spinner /></div>
  if (!b && bookingsStatus === 'error') return <div><PageHeader title="รายละเอียดการจอง" back="/bookings" /><ErrorState title="โหลดรายการจองไม่สำเร็จ" text={bookingsError} onRetry={refreshBookings} /></div>
  if (!b) return <div><PageHeader title="รายละเอียดการจอง" back="/bookings" /><ErrorState title="ไม่พบรายการจอง" text="รายการนี้อาจถูกลบไปแล้ว" onRetry={() => nav('/bookings')} /></div>

  const rows: [string, string][] = [
    ['เลขที่การจอง', b.id],
    ['บริการ', `${b.serviceName}${b.questionCount ? ` (${b.questionCount} คำถาม)` : ''}`],
    ['วันที่', dateLong(b.date)],
    ['เวลา', `${b.time} น.`],
    ['ราคา', baht(b.price)],
    ...(b.otherQuestion ? ([['คำถามของคุณ', b.otherQuestion]] as [string, string][]) : []),
    ['หมายเหตุ', b.note || '-'],
  ]
  const canCancel = b.status === 'confirmed' || b.status === 'pending_payment'

  return (
    <div>
      <PageHeader title="รายละเอียดการจอง" back="/bookings" />
      <div className="px-4 pt-5">
        <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 px-4 py-3 text-sm"><span className="shrink-0 text-mute">{k}</span><span className="break-words text-right">{v}</span></div>
          ))}
          <div className="flex items-center justify-between px-4 py-3 text-sm"><span className="text-mute">สถานะ</span><StatusBadge status={b.status} /></div>
        </div>

        <div className="mt-5 grid gap-3">
          {b.status === 'pending_payment' && <button onClick={() => nav(`/payment/${b.id}`)} className="h-14 rounded-2xl bg-gold font-semibold text-night">ไปชำระเงิน</button>}
          {b.isCall && (
            <a
              href="https://www.instagram.com/witchyu_2006?xtok=MTY1dzFwYTZxcHg2Ng%3D%3D&utm_source=qr"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-gold/40 bg-gold font-semibold text-white active:scale-[.98]"
            >
              <Instagram size={20} />
              ติดต่อหมอดูผ่าน Instagram
            </a>
          )}
          <button onClick={() => nav(`/chat/${b.id}`)} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-raised font-medium"><MessageCircle size={20} />แชต</button>
          {canCancel && <button onClick={() => setAskCancel(true)} className="h-12 text-sm text-bad">ยกเลิกการจอง</button>}
        </div>
      </div>

      <Modal open={askCancel} danger title="ยกเลิกการจองนี้?" confirmLabel="ยกเลิกการจอง" cancelLabel="ไม่ยกเลิก" onCancel={() => setAskCancel(false)} onConfirm={async () => {
        if (cancelling) return
        setCancelling(true)
        try {
          await cancelBooking(b.id)
          toast('ยกเลิกการจองแล้ว', 'success')
        } catch (e) {
          toast(errorMessage(e), 'error')
          refreshBookings()
        } finally {
          setCancelling(false)
          setAskCancel(false)
        }
      }}>
        รายการ {b.id} จะย้ายไปอยู่ในแท็บ “ยกเลิก”
      </Modal>
    </div>
  )
}
