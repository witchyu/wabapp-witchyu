import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Loader2, TimerOff } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { EmptyState, ErrorState, Spinner } from '../components/states'
import { useBooking } from '../hooks/useBooking'
import { baht, dateLong, mmss } from '../utils/format'
import { useToast } from '../hooks/useToast'
import { errorMessage } from '../services/api'

// QR จำลอง (ไม่ใช่ QR ชำระเงินจริง) สร้างจากเลขที่การจองเพื่อให้แต่ละรายการหน้าตาต่างกัน
function FakeQr({ seed }: { seed: string }) {
  const cells = useMemo(() => {
    let h = [...seed].reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 5381)
    const out: boolean[] = []
    for (let i = 0; i < 21 * 21; i++) {
      h = (h * 1664525 + 1013904223) >>> 0
      out.push((h >>> 16) % 2 === 0)
    }
    return out
  }, [seed])
  const finder = (x: number, y: number) => {
    const inBox = (ox: number, oy: number) => x >= ox && x < ox + 7 && y >= oy && y < oy + 7
    return inBox(0, 0) || inBox(14, 0) || inBox(0, 14)
  }
  return (
    <svg viewBox="0 0 21 21" className="h-48 w-48 rounded-xl bg-white p-2" shapeRendering="crispEdges" role="img" aria-label="QR ชำระเงินจำลอง">
      {cells.map((on, i) => {
        const x = i % 21, y = Math.floor(i / 21)
        if (finder(x, y)) return null
        return on ? <rect key={i} x={x} y={y} width="1" height="1" fill="#0D0A14" /> : null
      })}
      {[[0, 0], [14, 0], [0, 14]].map(([ox, oy]) => (
        <g key={`${ox}${oy}`}>
          <rect x={ox} y={oy} width="7" height="7" fill="#0D0A14" />
          <rect x={ox + 1} y={oy + 1} width="5" height="5" fill="#fff" />
          <rect x={ox + 2} y={oy + 2} width="3" height="3" fill="#0D0A14" />
        </g>
      ))}
    </svg>
  )
}

export default function Payment() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const { bookings, bookingsStatus, refreshBookings, payBooking } = useBooking()
  const booking = bookings.find((b) => b.id === id)
  const [now, setNow] = useState(() => Date.now())
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // เวลาที่เหลือคิดจากเวลาหมดอายุที่เซิร์ฟเวอร์กำหนด (รีเฟรชหน้าแล้วไม่รีเซ็ต)
  const left = booking ? Math.max(0, Math.ceil((booking.expiresAt - now) / 1000)) : 0
  const timedOut = left === 0

  // หมดเวลาแล้ว ให้ดึงสถานะล่าสุดจากเซิร์ฟเวอร์ (เซิร์ฟเวอร์เป็นผู้ยกเลิกและคืนรอบเวลา)
  const pending = booking?.status === 'pending_payment'
  useEffect(() => {
    if (pending && timedOut && !paying) refreshBookings()
  }, [pending, timedOut, paying, refreshBookings])

  if (!booking && bookingsStatus === 'loading') return <Spinner />
  if (!booking) return <ErrorState title="ไม่พบรายการจอง" text="ลิงก์นี้อาจไม่ถูกต้อง ลองกลับไปที่หน้าการจอง" onRetry={() => nav('/bookings')} />
  if ((booking.status === 'confirmed' || booking.status === 'completed') && !paying) return <Navigate to={`/bookings/${booking.id}`} replace />

  const expired = booking.status === 'cancelled' || left === 0

  // ชำระเงินจำลอง (เฉพาะช่วงพัฒนา เปิด/ปิดที่เซิร์ฟเวอร์) — Phase 7 ให้ Webhook ของ Payment Provider เป็นผู้ยืนยันการจ่ายเงินจริง
  const mockPay = async () => {
    if (paying || left === 0) return
    setPaying(true)
    try {
      await payBooking(booking.id)
      nav(`/success/${booking.id}`, { replace: true })
    } catch (e) {
      setPaying(false)
      toast(errorMessage(e), 'error')
      refreshBookings()
    }
  }

  const rebook = () => nav('/booking', { replace: true })

  if (expired) {
    return (
      <div>
        <PageHeader title="ชำระเงิน" />
        <EmptyState icon={<TimerOff size={28} />} title="รายการนี้ถูกยกเลิกหรือหมดเวลาชำระเงิน" text="รอบเวลานี้ถูกปล่อยคืนแล้ว คุณสามารถจองคิวใหม่ได้" action={<button onClick={rebook} className="h-12 rounded-2xl bg-gold px-8 font-semibold text-night">จองคิวใหม่</button>} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="ชำระเงิน" back="/" />
      <div className="px-4 pt-5">
        <div className="rounded-2xl border border-line bg-surface p-4 text-sm">
          <div className="flex justify-between"><span className="text-mute">บริการ</span><span>{booking.serviceName}{booking.questionCount ? ` (${booking.questionCount} คำถาม)` : ''}</span></div>
          <div className="mt-2 flex justify-between"><span className="text-mute">วันที่</span><span>{dateLong(booking.date)}</span></div>
          <div className="mt-2 flex justify-between"><span className="text-mute">เวลา</span><span>{booking.time} น.</span></div>
        </div>

        <div className="mt-6 text-center">
          <div className="text-sm text-mute">ยอดชำระ</div>
          <div className="font-display text-4xl font-semibold text-gold">{baht(booking.price)}</div>
        </div>

        <div className="mt-5 flex flex-col items-center">
          <FakeQr seed={booking.id} />
          <span className="mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs text-warn">QR จำลอง — ยังไม่ใช่การชำระเงินจริง</span>
        </div>

        <div className="mt-6 text-center">
          <div className="text-sm text-mute">เวลาที่เหลือในการชำระ</div>
          <div className={`font-display text-3xl font-semibold ${left < 60 ? 'text-bad' : ''}`} aria-live="off">{mmss(left)}</div>
        </div>

        <button disabled={paying} onClick={mockPay} className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gold text-base font-semibold text-night active:scale-[.98] disabled:opacity-70">
          {paying ? <><Loader2 className="animate-spin" size={20} />กำลังตรวจสอบ</> : 'ฉันชำระเงินแล้ว'}
        </button>
        <p className="mt-3 text-center text-xs text-mute">ปุ่มนี้เป็นการชำระเงินจำลองสำหรับช่วงพัฒนา ยังไม่ได้ตรวจสอบเงินเข้าจริง ระบบจริงจะให้เซิร์ฟเวอร์ยืนยันการชำระเงินใน Phase 7</p>
      </div>
    </div>
  )
}
