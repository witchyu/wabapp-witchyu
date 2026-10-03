import { useBooking } from '../../hooks/useBooking'
import { RELATIONSHIPS } from '../../data/shop'

const input = 'h-12 w-full rounded-xl border border-line bg-surface px-4 text-ink placeholder:text-mute/60 focus:border-gold focus:outline-none'

export default function StepInfo() {
  const { draft, patchDraft } = useBooking()
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
      <label className="flex min-h-[48px] items-center gap-3 rounded-xl bg-surface px-4 text-sm">
        <input type="checkbox" className="h-5 w-5 accent-[#D4AE5C]" checked={draft.remember} onChange={(e) => patchDraft({ remember: e.target.checked })} />
        บันทึกข้อมูลไว้สำหรับการจองครั้งถัดไป
      </label>
    </div>
  )
}
