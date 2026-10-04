import { useState } from 'react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { adminApi } from '../../services/adminApi'
import { errorMessage } from '../../services/api'
import { useLoad } from '../../components/admin/useLoad'
import Toggle from '../../components/admin/Toggle'
import Modal from '../../components/Modal'
import { ErrorState, Spinner } from '../../components/states'
import { useToast } from '../../hooks/useToast'
import type { AdminSlot } from '../../types/admin'

export default function AdminSlots() {
  const toast = useToast()
  const { data, setData, status, error, reload } = useLoad(() => adminApi.slots())
  const [time, setTime] = useState('')
  const [capacity, setCapacity] = useState(1)
  const [adding, setAdding] = useState(false)
  const [del, setDel] = useState<AdminSlot | null>(null)

  if (status === 'loading') return <Spinner />
  if (status === 'error' || !data) return <ErrorState title="โหลดรอบเวลาไม่สำเร็จ" text={error} onRetry={reload} />

  const replace = (s: AdminSlot) => setData(data.map((x) => (x.id === s.id ? s : x)))

  const patch = async (s: AdminSlot, p: { capacity?: number; active?: boolean }) => {
    replace({ ...s, ...p })
    try {
      replace(await adminApi.updateSlot(s.id, p))
    } catch (e) {
      replace(s)
      toast(errorMessage(e), 'error')
    }
  }

  const add = async () => {
    if (adding) return
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return toast('กรุณาเลือกเวลา', 'error')
    setAdding(true)
    try {
      const s = await adminApi.createSlot({ time, capacity })
      setData([...data, s].sort((a, b) => a.time.localeCompare(b.time)))
      setTime('')
      toast('เพิ่มรอบเวลาแล้ว', 'success')
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setAdding(false)
    }
  }

  const remove = async () => {
    if (!del) return
    try {
      await adminApi.deleteSlot(del.id)
      setData(data.filter((x) => x.id !== del.id))
      toast('ลบรอบเวลาแล้ว', 'success')
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setDel(null)
    }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 font-display text-base font-semibold">เพิ่มรอบเวลาใหม่</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-sm">เวลา
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-12 rounded-xl border border-line bg-night px-3 focus:border-gold focus:outline-none" />
          </label>
          <div className="grid gap-1.5 text-sm">จำนวนคิวสูงสุด
            <div className="flex h-12 items-center gap-2">
              <button aria-label="ลดจำนวนคิว" onClick={() => setCapacity(Math.max(1, capacity - 1))} className="grid h-11 w-11 place-items-center rounded-full bg-raised"><Minus size={18} /></button>
              <span className="w-8 text-center text-lg font-semibold">{capacity}</span>
              <button aria-label="เพิ่มจำนวนคิว" onClick={() => setCapacity(Math.min(20, capacity + 1))} className="grid h-11 w-11 place-items-center rounded-full bg-raised"><Plus size={18} /></button>
            </div>
          </div>
          <button disabled={adding} onClick={add} className="flex h-12 items-center gap-2 rounded-xl bg-gold px-5 font-semibold text-night disabled:opacity-60"><Plus size={18} />เพิ่ม</button>
        </div>
      </section>

      <section>
        <h2 className="mb-1 font-display text-base font-semibold">รอบเวลาทั้งหมด</h2>
        <p className="mb-3 text-sm text-mute">สวิตช์ = เปิด/ปิดรับจองรอบนั้น · จำนวนคิว = รับได้กี่คนต่อรอบ</p>
        <ul className="grid gap-2 md:grid-cols-2">
          {data.map((s) => (
            <li key={s.id} className={`flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 ${s.active ? '' : 'opacity-60'}`}>
              <span className="w-16 font-display text-xl font-semibold">{s.time}</span>
              <div className="flex flex-1 items-center gap-2">
                <button aria-label={`ลดจำนวนคิว ${s.time}`} disabled={s.capacity <= 1} onClick={() => patch(s, { capacity: s.capacity - 1 })} className="grid h-11 w-11 place-items-center rounded-full bg-raised disabled:opacity-40"><Minus size={18} /></button>
                <span className="min-w-[2.5rem] text-center"><span className="text-lg font-semibold">{s.capacity}</span><span className="block text-[11px] text-mute">คิว</span></span>
                <button aria-label={`เพิ่มจำนวนคิว ${s.time}`} disabled={s.capacity >= 20} onClick={() => patch(s, { capacity: s.capacity + 1 })} className="grid h-11 w-11 place-items-center rounded-full bg-raised disabled:opacity-40"><Plus size={18} /></button>
              </div>
              <Toggle label={`เปิดรับจองรอบ ${s.time}`} checked={s.active} onChange={(v) => patch(s, { active: v })} />
              <button aria-label={`ลดรอบ ${s.time}`} onClick={() => setDel(s)} className="grid h-11 w-11 place-items-center rounded-xl bg-bad/15 text-bad"><Trash2 size={18} /></button>
            </li>
          ))}
        </ul>
        {data.length === 0 && <p className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-mute">ยังไม่มีรอบเวลา — ลูกค้าจะจองไม่ได้จนกว่าจะเพิ่ม</p>}
      </section>

      <Modal open={!!del} danger title="ลบรอบเวลานี้?" confirmLabel="ลบ" cancelLabel="ไม่ลบ" onCancel={() => setDel(null)} onConfirm={remove}>
        รอบ {del?.time} จะหายจากหน้าลูกค้า (ถ้ายังมีการจองรอบนี้ที่ยังไม่ถึงเวลา ระบบจะไม่ให้ลบ ให้ปิดสวิตช์แทน)
      </Modal>
    </div>
  )
}
