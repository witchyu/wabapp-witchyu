import { useMemo } from 'react'
import { useBooking } from '../../hooks/useBooking'
import { selectedServices } from '../../data/services'
import { BOOKING_DAYS } from '../../data/shop'
import { addDays, dateShort, dayShort, toISO } from '../../utils/format'
import { SLOTS, slotStatus } from '../../utils/slots'

const LABEL = { available: 'ว่าง', full: 'เต็ม', closed: 'ปิด' } as const

export default function StepDateTime() {
  const { draft, patchDraft } = useBooking()
  const svc = selectedServices(draft.serviceIds).find((x) => x.unlimited)
  const days = useMemo(() => Array.from({ length: BOOKING_DAYS }, (_, i) => toISO(addDays(new Date(), i))), [])
  const today = days[0]

  return (
    <div>
      <h3 className="mb-2 text-sm text-mute">เลือกวัน (จองล่วงหน้าได้ {BOOKING_DAYS} วัน)</h3>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
        {days.map((d) => (
          <button key={d} onClick={() => patchDraft({ date: d, time: '' })} className={`flex h-20 w-16 shrink-0 flex-col items-center justify-center rounded-2xl ${draft.date === d ? 'bg-gold text-night' : 'bg-surface'}`}>
            <span className={`text-xs ${draft.date === d ? 'text-night/70' : 'text-mute'}`}>{d === today ? 'วันนี้' : dayShort(d)}</span>
            <span className="mt-1 text-sm font-semibold">{dateShort(d)}</span>
          </button>
        ))}
      </div>

      <h3 className="mb-2 mt-5 text-sm text-mute">เลือกเวลา</h3>
      {svc?.unlimited && <p className="mb-3 rounded-xl bg-gold/10 px-3 py-2 text-sm text-gold">บริการโทรไม่จำกัด จองได้เฉพาะรอบ 22:30</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        {SLOTS.map((t) => {
          const st = slotStatus(draft.date, t, svc)
          const selected = draft.time === t
          const disabled = st !== 'available'
          return (
            <button
              key={t}
              disabled={disabled}
              onClick={() => patchDraft({ time: t })}
              className={`flex h-14 items-center justify-between rounded-2xl border px-4 ${selected ? 'border-gold bg-gold text-night' : 'border-line bg-surface'} disabled:opacity-40`}
            >
              <span className="text-base font-semibold">{t}</span>
              <span className={`text-sm ${selected ? 'font-semibold' : st === 'available' ? 'text-ok' : 'text-mute'}`}>{selected ? 'เลือกแล้ว' : LABEL[st]}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
