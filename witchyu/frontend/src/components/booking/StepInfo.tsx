import { useMemo, useState } from 'react'
import Modal from '../Modal'
import { useBooking } from '../../hooks/useBooking'
import { useToast } from '../../hooks/useToast'
import { RELATIONSHIPS } from '../../data/shop'
import { storageWritable } from '../../utils/storage'

const input = 'h-12 w-full rounded-xl border border-line bg-surface px-4 text-ink placeholder:text-mute/60 focus:border-gold focus:outline-none'

export default function StepInfo() {
  const { draft, patchDraft, hasSavedCustomer, clearSavedCustomer } = useBooking()
  const toast = useToast()
  const [askClear, setAskClear] = useState(false)
  const writable = useMemo(storageWritable, [])
  const c = draft.customer
  const set = (p: Partial<typeof c>) => patchDraft({ customer: { ...c, ...p } })

  return (
    <div className="grid gap-4">
      <label className="grid gap-1.5 text-sm">ชื่อเล่น
        <input className={input} value={c.nickname} onChange={(e) => set({ nickname: e.target.value })} placeholder="เช่น มิ้นท์" autoComplete="nickname" />
      </label>
      <label className="grid gap-1.5 text-sm">ชื่อจริง
        <input className={input} value={c.fullName} onChange={(e) => set({ fullName: e.target.value })} placeholder="ชื่อ นามสกุล" autoComplete="name" />
      </label>
      <label className="grid gap-1.5 text-sm">อายุ
        <input className={input} value={c.age} inputMode="numeric" onChange={(e) => set({ age: e.target.value.replace(/\D/g, '').slice(0, 3) })} placeholder="เช่น 24" />
      </label>
      <div className="grid gap-1.5 text-sm">สถานะความสัมพันธ์
        <div className="flex flex-wrap gap-2">
          {RELATIONSHIPS.map((r) => (
            <button key={r} type="button" onClick={() => set({ relationship: r })} className={`h-11 rounded-full px-4 text-sm ${c.relationship === r ? 'bg-gold font-semibold text-night' : 'bg-surface text-mute'}`}>{r}</button>
          ))}
        </div>
      </div>
      <div className="rounded-xl bg-surface px-4 py-3 text-sm">
        <label className="flex min-h-[40px] items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-purple-500" checked={draft.remember} onChange={(e) => patchDraft({ remember: e.target.checked })} />
          จำข้อมูลของฉันในอุปกรณ์นี้
        </label>
        <p className="mt-1 text-xs leading-relaxed text-mute">
          บันทึกไว้ในเบราว์เซอร์ของอุปกรณ์นี้ เพื่อกรอกให้อัตโนมัติในการจองครั้งถัดไป ข้อมูลอาจหายถ้าคุณล้างข้อมูลเบราว์เซอร์ หรือเปลี่ยนเครื่อง/เบราว์เซอร์
        </p>
        {!writable && (
          <p role="alert" className="mt-2 rounded-lg bg-warn/15 px-3 py-2 text-xs text-warn">เบราว์เซอร์นี้ไม่อนุญาตให้บันทึกข้อมูล (เช่น โหมดส่วนตัว) ข้อมูลจะไม่ถูกจำ</p>
        )}
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
          <span className="text-xs text-mute">{hasSavedCustomer ? 'มีข้อมูลที่บันทึกไว้ในอุปกรณ์นี้' : 'ยังไม่มีข้อมูลที่บันทึกไว้ในอุปกรณ์นี้'}</span>
          {hasSavedCustomer && (
            <button type="button" onClick={() => setAskClear(true)} className="h-10 shrink-0 rounded-lg bg-bad/15 px-3 text-xs font-medium text-bad">ล้างข้อมูลที่บันทึกไว้</button>
          )}
        </div>
      </div>

      <Modal
        open={askClear}
        danger
        title="ล้างข้อมูลที่บันทึกไว้?"
        confirmLabel="ล้างข้อมูล"
        cancelLabel="ไม่ล้าง"
        onCancel={() => setAskClear(false)}
        onConfirm={() => { clearSavedCustomer(); setAskClear(false); toast('ล้างข้อมูลที่บันทึกไว้แล้ว', 'success') }}
      >
        ชื่อเล่น ชื่อจริง อายุ และสถานะที่จำไว้ในอุปกรณ์นี้จะถูกลบ และช่องกรอกด้านบนจะถูกล้าง (การจองที่ทำไปแล้วไม่ได้รับผลกระทบ)
      </Modal>
    </div>
  )
}
