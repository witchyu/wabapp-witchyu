import { AppError } from './errors'
import { addDaysISO, startMs, toMinutes, type ShopNow } from './time'

export const BOOKING_DAYS = 7
export const MAX_QUESTIONS = 50
export const OTHER_SERVICE_ID = 'ch-other'
export const PAYMENT_LIMIT_MS = 15 * 60 * 1000
// เซ็ตที่เลือกหลายรายการพร้อมกันได้ (คำถาม 2 ทางเลือก / ความรัก / การงาน / การเรียน)
export const MULTI_GROUPS = ['choice', 'love59', 'love49', 'work', 'study']

export interface ServiceRow {
  id: string
  group: string
  name: string
  price: number
  durationMin: number | null
  scheduleMode: 'shop' | 'custom'
  perQuestion: boolean
  active: boolean
  category?: { multi: boolean; active?: boolean } | null
}

export interface Selection {
  services: ServiceRow[]
  price: number
  isCall: boolean
  questionCount?: number
  otherQuestion?: string
}

// ตรวจและคำนวณราคาฝั่งเซิร์ฟเวอร์ (ไม่เชื่อราคาที่ client ส่งมา)
export function resolveSelection(
  all: ServiceRow[],
  input: { serviceIds: string[]; questionCount?: number; otherQuestion?: string },
  callsEnabled: boolean,
): Selection {
  const services: ServiceRow[] = []
  for (const id of input.serviceIds) {
    const s = all.find((x) => x.id === id)
    if (!s) throw new AppError(422, 'SERVICE_NOT_FOUND', 'ไม่พบบริการที่เลือก กรุณาเลือกใหม่')
    if (!s.active) throw new AppError(422, 'SERVICE_UNAVAILABLE', `บริการ "${s.name}" ปิดให้บริการชั่วคราว`)
    services.push(s)
  }
  if (services.length > 1 && !services.every((s) =>
    s.category ? s.category.active !== false && s.category.multi : MULTI_GROUPS.includes(s.group)
  )) {
    throw new AppError(422, 'SELECTION_INVALID', 'บริการนี้เลือกหลายรายการพร้อมกันไม่ได้')
  }
  const isCall = services.some((s) => s.group === 'call')
  if (isCall && !callsEnabled) throw new AppError(422, 'CALLS_DISABLED', 'ขณะนี้ปิดรับจองโทร')

  const perQ = services.some((s) => s.perQuestion)
  const qc = input.questionCount
  if (perQ && (!Number.isInteger(qc) || (qc as number) < 1 || (qc as number) > MAX_QUESTIONS)) {
    throw new AppError(422, 'VALIDATION_SERVICE', `กรุณากรอกจำนวนคำถาม 1-${MAX_QUESTIONS} ข้อ`)
  }
  const other = services.some((s) => s.id === OTHER_SERVICE_ID)
  const otherQuestion = (input.otherQuestion ?? '').trim()
  if (other && !otherQuestion) throw new AppError(422, 'VALIDATION_SERVICE', 'กรุณาพิมพ์คำถามของคุณในช่อง “อื่นๆ”')

  const price = services.reduce((sum, s) => sum + (s.perQuestion ? s.price * (qc as number) : s.price), 0)
  return {
    services,
    price,
    isCall,
    questionCount: perQ ? qc : undefined,
    otherQuestion: other ? otherQuestion : undefined,
  }
}

// ---------- รอบเวลา ----------
export interface SlotRow {
  time: string
  endTime: string
  isLastSlot: boolean
  active: boolean
}
export interface HoursRow { openTime: string; closeTime: string; isClosed: boolean }
export type SlotState = 'available' | 'full' | 'closed'
export interface DaySlots {
  date: string
  closed: boolean
  reasonCode?: 'DATE_OUT_OF_RANGE' | 'DAY_CLOSED' | 'SHOP_CLOSED'
  reason?: string
  slots: { time: string; endTime: string; isLastSlot: boolean; status: SlotState }[]
}

function intervalMinutes(start: string, end: string): [number, number] {
  const a = toMinutes(start)
  let b = toMinutes(end)
  if (b <= a) b += 1440
  return [a, b]
}

export function computeDaySlots(a: {
  date: string
  shopOpen: boolean
  now: ShopNow
  slots: SlotRow[]
  hours: HoursRow | null
  holiday: { reason: string } | null
  counts: Record<string, number>
  services: { id: string; scheduleMode: 'shop' | 'custom' }[]
  customTimes: Record<string, string[]>
}): DaySlots {
  const allCustom = a.services.length > 0 && a.services.every((s) => s.scheduleMode === 'custom')
  const candidates = allCustom
    ? (a.customTimes[a.services[0].id] ?? [])
        .filter((time) => a.services.every((service) =>
          service.scheduleMode !== 'custom' || (a.customTimes[service.id] ?? []).includes(time)
        ))
        .map((time) => ({ time, endTime: time, isLastSlot: false, active: true }))
    : a.slots.filter((slot) => a.services.every((service) =>
        service.scheduleMode !== 'custom' || (a.customTimes[service.id] ?? []).includes(slot.time)
      ))

  const ordered = [...candidates].sort((x, y) => toMinutes(x.time) - toMinutes(y.time))
  const allClosed = (extra: Partial<DaySlots>): DaySlots => ({
    date: a.date,
    closed: true,
    ...extra,
    slots: ordered.map((slot) => ({
      time: slot.time,
      endTime: slot.endTime,
      isLastSlot: slot.isLastSlot,
      status: 'closed' as const,
    })),
  })

  if (!a.shopOpen) return allClosed({ reasonCode: 'SHOP_CLOSED', reason: 'ขณะนี้ร้านปิดรับจองคิว' })

  const last = addDaysISO(a.now.date, BOOKING_DAYS - 1)
  if (a.date < a.now.date || a.date > last) {
    return allClosed({ reasonCode: 'DATE_OUT_OF_RANGE', reason: `จองล่วงหน้าได้ ${BOOKING_DAYS} วันเท่านั้น` })
  }
  if (a.holiday) return allClosed({ reasonCode: 'DAY_CLOSED', reason: a.holiday.reason || 'วันหยุดร้าน' })
  if (!a.hours || a.hours.isClosed) return allClosed({ reasonCode: 'DAY_CLOSED', reason: 'ร้านปิดทำการวันนี้' })

  const [open, close] = intervalMinutes(a.hours.openTime, a.hours.closeTime)

  return {
    date: a.date,
    closed: false,
    slots: ordered.map((slot) => {
      const start = toMinutes(slot.time)
      const [normalStart, normalFinish] = intervalMinutes(slot.time, slot.endTime)
      let status: SlotState

      if (!slot.active) status = 'closed'
      else if (!allCustom && (normalFinish <= normalStart || normalStart < open || normalFinish > close)) status = 'closed'
      else if (a.date === a.now.date && start <= a.now.minutes) status = 'closed'
      else if ((a.counts[slot.time] ?? 0) > 0) status = 'full'
      else status = 'available'

      return { time: slot.time, endTime: slot.endTime, isLastSlot: slot.isLastSlot, status }
    }),
  }
}

export function assertSlotAvailable(day: DaySlots, time: string): void {
  if (day.closed) {
    throw new AppError(409, day.reasonCode ?? 'DAY_CLOSED', day.reason ?? 'วันนี้ปิดรับจอง')
  }
  const slot = day.slots.find((s) => s.time === time)
  if (!slot) throw new AppError(409, 'SLOT_CLOSED', 'ไม่มีรอบเวลานี้ กรุณาเลือกเวลาอื่น')
  if (slot.status === 'full') throw new AppError(409, 'SLOT_FULL', 'เวลานี้เต็มแล้ว กรุณาเลือกเวลาอื่น')
  if (slot.status === 'closed') throw new AppError(409, 'SLOT_CLOSED', 'เวลานี้ปิดรับจอง กรุณาเลือกเวลาอื่น')
}

// ---------- เลขที่การจอง / สถานะ ----------
export function nextBookingId(existingIds: string[], date: string): string {
  const ymd = date.split('-').join('')
  const prefix = `WY-${ymd}-`
  const max = existingIds.reduce((m, id) => {
    if (!id.startsWith(prefix)) return m
    const n = Number(id.slice(prefix.length))
    return Number.isInteger(n) ? Math.max(m, n) : m
  }, 0)
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

export function bookingEndMs(date: string, time: string, endTime: string): number {
  const start = startMs(date, time)
  let end = startMs(date, endTime)
  if (end <= start) end += 24 * 60 * 60 * 1000
  return end
}

export function isEditable(b: { status: string; expiresAtMs: number; date: string; time: string }, nowMs: number): boolean {
  if (b.status === 'pending_payment') return b.expiresAtMs > nowMs
  if (b.status === 'confirmed') return startMs(b.date, b.time) > nowMs
  return false
}
