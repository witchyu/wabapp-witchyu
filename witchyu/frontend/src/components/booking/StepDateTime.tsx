import { useEffect, useMemo, useState } from 'react'
import { CalendarX } from 'lucide-react'
import { useBooking } from '../../hooks/useBooking'
import { selectedServices } from '../../data/services'
import { BOOKING_DAYS } from '../../data/shop'
import { addDays, dateShort, dayShort, toISO } from '../../utils/format'
import { bookingApi } from '../../services/bookingApi'
import { errorMessage } from '../../services/api'
import { EmptyState, ErrorState, Spinner } from '../states'
import type { DaySlots } from '../../types'

const LABEL = { available: 'ว่าง', full: 'เต็ม', closed: 'ปิด' } as const

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: DaySlots }

export default function StepDateTime() {
  const { draft, patchDraft } = useBooking()
  const unlimited = selectedServices(draft.serviceIds).some((x) => x.unlimited)
  const days = useMemo(() => Array.from({ length: BOOKING_DAYS }, (_, i) => toISO(addDays(new Date(), i))), [])
  const today = days[0]
  const [state, setState] = useState<State>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const idsKey = draft.serviceIds.join(',')

  // สถานะว่าง/เต็มมาจากเซิร์ฟเวอร์ (นับจากการจองจริงของทุกคน)
  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    bookingApi
      .slots(draft.date, draft.serviceIds)
      .then((data) => {
        if (cancelled) return
        setState({ status: 'ready', data })
        // รอบที่เลือกค้างไว้เต็ม/ปิดไปแล้ว ให้เลือกใหม่
        const cur = data.slots.find((s) => s.time === draft.time)
        if (draft.time && cur?.status !== 'available') patchDraft({ time: '' })
      })
      .catch((e) => !cancelled && setState({ status: 'error', message: errorMessage(e) }))
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.date, idsKey, reloadKey])

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
      {unlimited && <p className="mb-3 rounded-xl bg-gold/10 px-3 py-2 text-sm text-gold">บริการโทรไม่จำกัด จองได้เฉพาะรอบ 22:30</p>}

      {state.status === 'loading' && <Spinner label="กำลังตรวจสอบรอบว่าง" />}
      {state.status === 'error' && <ErrorState title="โหลดรอบเวลาไม่สำเร็จ" text={state.message} onRetry={() => setReloadKey((k) => k + 1)} />}
      {state.status === 'ready' && state.data.closed && (
        <EmptyState icon={<CalendarX size={28} />} title="วันนี้ปิดรับจอง" text={state.data.reason ?? 'กรุณาเลือกวันอื่น'} />
      )}
      {state.status === 'ready' && !state.data.closed && (
        <div className="grid gap-2 sm:grid-cols-2">
          {state.data.slots.map(({ time: t, status: st }) => {
            const selected = draft.time === t
            return (
              <button
                key={t}
                disabled={st !== 'available'}
                onClick={() => patchDraft({ time: t })}
                className={`flex h-14 items-center justify-between rounded-2xl border px-4 ${selected ? 'border-gold bg-gold text-night' : 'border-line bg-surface'} disabled:opacity-40`}
              >
                <span className="text-base font-semibold">{t}</span>
                <span className={`text-sm ${selected ? 'font-semibold' : st === 'available' ? 'text-ok' : 'text-mute'}`}>{selected ? 'เลือกแล้ว' : LABEL[st]}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
