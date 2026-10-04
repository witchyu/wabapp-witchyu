import { useState } from 'react'
import { CalendarOff, Plus, Trash2 } from 'lucide-react'
import { adminApi } from '../../services/adminApi'
import { errorMessage } from '../../services/api'
import { useLoad } from '../../components/admin/useLoad'
import Modal from '../../components/Modal'
import { EmptyState, ErrorState, Spinner } from '../../components/states'
import { useToast } from '../../hooks/useToast'
import type { AdminHoliday } from '../../types/admin'
import { dateLong, toISO } from '../../utils/format'

export default function AdminHolidays() {
  const toast = useToast()
  const { data, setData, status, error, reload } = useLoad(() => adminApi.holidays())
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [adding, setAdding] = useState(false)
  const [del, setDel] = useState<AdminHoliday | null>(null)

  if (status === 'loading') return <Spinner />
  if (status === 'error' || !data) return <ErrorState title="โหลดวันหยุดไม่สำเร็จ" text={error} onRetry={reload} />

  const add = async () => {
    if (adding) return
    if (!date) return toast('กรุณาเลือกวันที่', 'error')
    setAdding(true)
    try {
      const r = await adminApi.addHoliday({ date, reason: reason.trim() })
      setData([...data.filter((h) => h.date !== r.holiday.date), r.holiday].sort((a, b) => a.date.localeCompare(b.date)))
      setDate('')
      setReason('')
      toast(r.affectedBookings > 0 ? `เพิ่มแล้ว — วันนั้นมีคิวที่จองไว้ ${r.affectedBookings} รายการ (ยังไม่ถูกยกเลิก ไปจัดการที่หน้า "การจอง")` : 'เพิ่มวันหยุดแล้ว', r.affectedBookings > 0 ? 'info' : 'success')
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setAdding(false)
    }
  }

  const remove = async () => {
    if (!del) return
    try {
      await adminApi.deleteHoliday(del.id)
      setData(data.filter((h) => h.id !== del.id))
      toast('เปิดรับจองวันนั้นอีกครั้งแล้ว', 'success')
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setDel(null)
    }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-display text-base font-semibold">เพิ่มวันหยุด / ปิดรับจองรายวัน</h2>
        <p className="mb-3 mt-1 text-sm text-mute">วันที่เลือกจะปิดรับจองทุกรอบ (คิวที่จองไว้แล้วไม่ถูกยกเลิกอัตโนมัติ)</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-sm">วันที่
            <input type="date" min={toISO(new Date())} value={date} onChange={(e) => setDate(e.target.value)} className="h-12 rounded-xl border border-line bg-night px-3 focus:border-gold focus:outline-none" />
          </label>
          <label className="grid min-w-[200px] flex-1 gap-1.5 text-sm">เหตุผล (ไม่บังคับ)
            <input value={reason} maxLength={100} onChange={(e) => setReason(e.target.value)} placeholder="เช่น หยุดพักร้อน" className="h-12 rounded-xl border border-line bg-night px-3 focus:border-gold focus:outline-none" />
          </label>
          <button disabled={adding} onClick={add} className="flex h-12 items-center gap-2 rounded-xl bg-gold px-5 font-semibold text-night disabled:opacity-60"><Plus size={18} />เพิ่ม</button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-base font-semibold">วันหยุดที่กำหนดไว้</h2>
        {data.length === 0 ? (
          <EmptyState icon={<CalendarOff size={28} />} title="ยังไม่มีวันหยุดที่ถูกบล็อก" text="วันที่เพิ่มไว้จะแสดงที่นี่" />
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {data.map((h) => (
              <li key={h.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                <div className="min-w-0 flex-1"><div className="font-medium">{dateLong(h.date)}</div><div className="break-words text-sm text-mute">{h.reason || 'ไม่ระบุเหตุผล'}</div></div>
                <button aria-label={`ลบวันหยุด ${h.date}`} onClick={() => setDel(h)} className="grid h-11 w-11 place-items-center rounded-xl bg-bad/15 text-bad"><Trash2 size={18} /></button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal open={!!del} title="เปิดรับจองวันนี้อีกครั้ง?" confirmLabel="เปิดรับจอง" cancelLabel="ไม่" onCancel={() => setDel(null)} onConfirm={remove}>
        {del && `ลบ ${dateLong(del.date)} ออกจากวันหยุด`}
      </Modal>
    </div>
  )
}
