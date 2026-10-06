import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { adminApi } from '../../services/adminApi'
import { errorMessage } from '../../services/api'
import { useLoad } from '../../components/admin/useLoad'
import BottomSheet from '../../components/BottomSheet'
import Modal from '../../components/Modal'
import StatusBadge from '../../components/StatusBadge'
import { EmptyState, ErrorState, Spinner } from '../../components/states'
import { useToast } from '../../hooks/useToast'
import type { Booking } from '../../types'
import type { AdminBookingFilter } from '../../types/admin'
import { baht, dateLong, dateShort } from '../../utils/format'

const FILTERS: { id: AdminBookingFilter; label: string }[] = [
  { id: 'active', label: 'ที่ยังไม่เสร็จ' },
  { id: 'pending_payment', label: 'รอชำระเงิน' },
  { id: 'confirmed', label: 'ยืนยันแล้ว' },
  { id: 'completed', label: 'เสร็จแล้ว' },
  { id: 'cancelled', label: 'ยกเลิก' },
  { id: 'all', label: 'ทั้งหมด' },
]

const svcName = (b: Booking) => `${b.serviceName}${b.questionCount ? ` (${b.questionCount} คำถาม)` : ''}`
const btn = 'h-10 rounded-lg px-3 text-xs font-medium'

interface ActionProps { b: Booking; onDetail: () => void; onConfirm: () => void; onCancel: () => void; onChat: () => void; onCall: () => void; onDelete: () => void }
function Actions({ b, onDetail, onConfirm, onCancel, onChat, onCall, onDelete }: ActionProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button onClick={onDetail} className={`${btn} bg-raised`}>ดูรายละเอียด</button>
      {b.status === 'pending_payment' && <button onClick={onConfirm} className={`${btn} bg-ok/20 text-ok`}>ยืนยัน</button>}
      {(b.status === 'pending_payment' || b.status === 'confirmed') && <button onClick={onCancel} className={`${btn} bg-bad/15 text-bad`}>ยกเลิก</button>}
      {(b.status === 'completed' || b.status === 'cancelled') && <button onClick={onDelete} className={btn + ' bg-bad/15 text-bad'}>ลบถาวร</button>}
      <button onClick={onChat} className={`${btn} bg-raised`}>แชต</button>
      {b.isCall && <button onClick={onCall} className={`${btn} bg-raised`}>โทร</button>}
    </div>
  )
}

export default function AdminBookings() {
  const toast = useToast()
  const nav = useNavigate()
  const [status, setStatus] = useState<AdminBookingFilter>('active')
  const [date, setDate] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<Booking | null>(null)
  const [ask, setAsk] = useState<{ kind: 'confirm' | 'cancel' | 'delete'; b: Booking } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data, status: load, error, reload } = useLoad(() => adminApi.bookings({ status, date, search, page }), [status, date, search, page])

  const placeholder = (what: string, phase: number) => () => toast(`${what}จะเปิดใช้ใน Phase ${phase} (ปุ่มนี้เป็น Placeholder)`, 'info')

  const run = async () => {
    if (!ask || busy) return
    setBusy(true)
    try {
      if (ask.kind === 'confirm') {
        await adminApi.confirmBooking(ask.b.id)
      } else if (ask.kind === 'cancel') {
        await adminApi.cancelBooking(ask.b.id)
      } else {
        await adminApi.deleteBooking(ask.b.id)
      }
      toast(
        ask.kind === 'confirm'
          ? 'ยืนยันการจองแล้ว'
          : ask.kind === 'cancel'
            ? 'ยกเลิกการจองแล้ว'
            : 'ลบรายการจองถาวรแล้ว',
        'success',
      )
      setAsk(null)
      reload()
    } catch (e) {
      toast(errorMessage(e), 'error')
      setAsk(null)
      reload()
    } finally {
      setBusy(false)
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const actions = (b: Booking) => (
    <Actions b={b} onDetail={() => setDetail(b)} onConfirm={() => setAsk({ kind: 'confirm', b })} onCancel={() => setAsk({ kind: 'cancel', b })} onChat={() => nav(`/admin/chat/${b.id}`)} onCall={placeholder('โทร', 6)} onDelete={() => setAsk({ kind: 'delete', b })} />
  )

  return (
    <div>
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <label className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="ค้นหาเลขที่การจอง / ชื่อลูกค้า" className="h-12 w-full rounded-xl border border-line bg-surface pl-10 pr-3 focus:border-gold focus:outline-none" />
        </label>
        <input type="date" aria-label="กรองตามวันที่" value={date} onChange={(e) => { setDate(e.target.value); setPage(1) }} className="h-12 rounded-xl border border-line bg-surface px-3 focus:border-gold focus:outline-none" />
        {date && <button onClick={() => { setDate(''); setPage(1) }} className="h-12 rounded-xl bg-surface px-4 text-sm">ล้างวันที่</button>}
      </div>
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => { setStatus(f.id); setPage(1) }} className={`h-11 shrink-0 rounded-full px-4 text-sm font-medium ${status === f.id ? 'bg-gold text-night' : 'bg-surface text-mute'}`}>{f.label}</button>
        ))}
      </div>

      {load === 'loading' && <Spinner />}
      {load === 'error' && <ErrorState title="โหลดรายการจองไม่สำเร็จ" text={error} onRetry={reload} />}
      {load === 'ready' && data && data.bookings.length === 0 && <EmptyState icon={<Search size={28} />} title="ไม่พบรายการ" text="ลองเปลี่ยนตัวกรองหรือคำค้นหา" />}
      {load === 'ready' && data && data.bookings.length > 0 && (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border border-line md:block">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-surface text-left text-mute">
                <tr>{['วันที่/เวลา', 'บริการ', 'ราคา', 'ลูกค้า', 'อายุ', 'สถานะ', 'หมายเหตุ', 'Actions'].map((h) => <th key={h} className="px-3 py-3 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.bookings.map((b) => (
                  <tr key={b.id} className="align-top">
                    <td className="whitespace-nowrap px-3 py-3"><div className="font-semibold">{dateShort(b.date)} · {b.time}</div><div className="text-xs text-mute">{b.id}</div></td>
                    <td className="max-w-[180px] break-words px-3 py-3">{svcName(b)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-gold">{baht(b.price)}</td>
                    <td className="px-3 py-3">{b.customer.nickname}<div className="text-xs text-mute">{b.customer.fullName}</div></td>
                    <td className="px-3 py-3">{b.customer.age}</td>
                    <td className="px-3 py-3"><StatusBadge status={b.status} /></td>
                    <td className="max-w-[160px] break-words px-3 py-3 text-mute">{b.otherQuestion ? `คำถาม: ${b.otherQuestion}` : b.note || '-'}</td>
                    <td className="px-3 py-3">{actions(b)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="grid gap-3 md:hidden">
            {data.bookings.map((b) => (
              <li key={b.id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex items-center justify-between"><span className="font-semibold">{dateShort(b.date)} · {b.time}</span><StatusBadge status={b.status} /></div>
                <div className="mt-1 text-xs text-mute">{b.id}</div>
                <div className="mt-2 break-words">{svcName(b)}</div>
                <div className="mt-1 text-sm text-mute">{b.customer.nickname} ({b.customer.fullName}) · อายุ {b.customer.age}</div>
                <div className="mt-1 font-semibold text-gold">{baht(b.price)}</div>
                {(b.note || b.otherQuestion) && <div className="mt-1 break-words text-sm text-mute">{b.otherQuestion ? `คำถาม: ${b.otherQuestion}` : b.note}</div>}
                <div className="mt-3">{actions(b)}</div>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-mute">ทั้งหมด {data.total} รายการ</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-11 rounded-xl bg-surface px-4 disabled:opacity-40">ก่อนหน้า</button>
              <span>{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="h-11 rounded-xl bg-surface px-4 disabled:opacity-40">ถัดไป</button>
            </div>
          </div>
        </>
      )}

      <BottomSheet open={!!detail} title="รายละเอียดการจอง" onClose={() => setDetail(null)}>
        {detail && (
          <div className="divide-y divide-line rounded-2xl border border-line bg-night/40 text-sm">
            {([
              ['เลขที่การจอง', detail.id],
              ['บริการ', svcName(detail)],
              ['วันที่', dateLong(detail.date)],
              ['เวลา', `${detail.time} น.`],
              ['ราคา', baht(detail.price)],
              ['ลูกค้า', `${detail.customer.nickname} (${detail.customer.fullName})`],
              ['อายุ / สถานะ', `${detail.customer.age} ปี · ${detail.customer.relationship}`],
              ...(detail.otherQuestion ? ([['คำถามของลูกค้า', detail.otherQuestion]] as [string, string][]) : []),
              ['หมายเหตุ', detail.note || '-'],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-3"><span className="shrink-0 text-mute">{k}</span><span className="break-words text-right">{v}</span></div>
            ))}
            <div className="flex items-center justify-between px-4 py-3"><span className="text-mute">สถานะ</span><StatusBadge status={detail.status} /></div>
          </div>
        )}
      </BottomSheet>

      <Modal
        open={!!ask}
        danger={ask?.kind === 'cancel' || ask?.kind === 'delete'}
        title={
          ask?.kind === 'confirm'
            ? 'ยืนยันการจองนี้?'
            : ask?.kind === 'cancel'
              ? 'ยกเลิกการจองนี้?'
              : 'ลบรายการจองถาวร?'
        }
        confirmLabel={
          ask?.kind === 'confirm'
            ? 'ยืนยัน'
            : ask?.kind === 'cancel'
              ? 'ยกเลิกการจอง'
              : 'ลบถาวร'
        }
        cancelLabel="ปิด"
        onCancel={() => setAsk(null)}
        onConfirm={run}
      >
        {ask?.kind === 'confirm'
          ? `ยืนยัน ${ask.b.id} (ใช้เมื่อคุณตรวจแล้วว่าลูกค้าชำระเงินจริง)`
          : ask?.kind === 'cancel'
            ? `ยกเลิก ${ask.b.id} — ถ้าลูกค้าชำระเงินแล้ว ต้องคืนเงินด้วยตัวเอง (ระบบคืนเงินอัตโนมัติจะมาพร้อมระบบชำระเงินจริง)`
            : ask && `ลบ ${ask.b.id} แบบถาวร? การลบจะไม่สามารถย้อนกลับได้ และข้อมูลข้อความ/การโทรของรายการนี้จะถูกลบด้วย`}
      </Modal>
    </div>
  )
}
