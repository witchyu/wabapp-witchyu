import { PAYMENT_LIMIT_MS, SHOP, UNLIMITED_SLOT } from '../data/shop'
import { getService, isMultiGroup, selectedServices, selectionTotal } from '../data/services'
import type { Booking, CustomerInfo, Draft } from '../types'
import { fromISO } from './format'
import { slotStatus } from './slots'

export const EMPTY_CUSTOMER: CustomerInfo = { nickname: '', fullName: '', age: '', relationship: '' }

export function validateCustomer(c: CustomerInfo): string | null {
  if (!c.nickname.trim()) return 'กรุณากรอกชื่อเล่น'
  if (!c.fullName.trim()) return 'กรุณากรอกชื่อจริง'
  const age = Number(c.age)
  if (!c.age || !Number.isInteger(age) || age < 1 || age > 120) return 'กรุณากรอกอายุให้ถูกต้อง'
  if (!c.relationship) return 'กรุณาเลือกสถานะความสัมพันธ์'
  return null
}

export function validateSelection(d: Pick<Draft, 'serviceIds' | 'multi' | 'questionCount' | 'otherQuestion'>): string | null {
  const ids = d.serviceIds
  if (ids.length === 0) return 'กรุณาเลือกบริการอย่างน้อย 1 รายการ'
  const svcs = selectedServices(ids)
  if (svcs.length !== ids.length || svcs.some((s) => !s.active) || new Set(ids).size !== ids.length) return 'มีบริการที่ไม่พร้อมให้จอง กรุณาเลือกใหม่'
  if (svcs.length > 1 && !(d.multi && svcs.every((s) => isMultiGroup(s.group)))) return 'บริการนี้เลือกหลายรายการไม่ได้'
  if (svcs.some((s) => s.group === 'call') && !SHOP.callsEnabled) return 'ขณะนี้ปิดรับจองโทร'
  if (svcs.some((s) => s.perQuestion) && (!Number.isInteger(d.questionCount) || d.questionCount < 1 || d.questionCount > 50)) return 'กรุณากรอกจำนวนคำถาม 1-50 ข้อ'
  if (ids.includes('ch-other') && !d.otherQuestion.trim()) return 'กรุณาพิมพ์คำถามของคุณในช่อง “อื่นๆ”'
  return null
}

export function validateSchedule(d: Pick<Draft, 'serviceIds' | 'date' | 'time'>, bookings: Booking[], now: number): string | null {
  if (!d.time) return 'กรุณาเลือกเวลา'
  const unlimited = selectedServices(d.serviceIds).find((s) => s.unlimited)
  if (unlimited && d.time !== UNLIMITED_SLOT) return 'โทรไม่จำกัดจองได้เฉพาะรอบ 22:30 น.'
  const st = slotStatus(bookings, d.date, d.time, unlimited, now)
  if (st === 'full') return 'เวลานี้เต็มแล้ว กรุณาเลือกเวลาอื่น'
  if (st === 'closed') return 'เวลานี้ปิดรับจอง กรุณาเลือกเวลาอื่น'
  return null
}

export interface DraftError { message: string; step: number }

// ตรวจทั้งหมดอีกรอบก่อนสร้างการจอง (กันกรณีข้อมูลเปลี่ยนระหว่างกรอก เช่น มีคนจองรอบเดียวกันตัดหน้า)
export function validateDraft(d: Draft, bookings: Booking[], now: number): DraftError | null {
  if (!SHOP.isOpen) return { message: 'ขณะนี้ร้านปิดรับจองคิว', step: 0 }
  const c = validateCustomer(d.customer)
  if (c) return { message: c, step: 0 }
  const s = validateSelection(d)
  if (s) return { message: s, step: 1 }
  const t = validateSchedule(d, bookings, now)
  if (t) return { message: t, step: 2 }
  return null
}

// WY-YYYYMMDD-NNN  (NNN นับต่อวันที่ของคิว ไม่ซ้ำแม้มีรายการที่ยกเลิก)
export function nextBookingId(bookings: Booking[], dateISO: string): string {
  const ymd = dateISO.split('-').join('')
  const re = new RegExp(`^WY-${ymd}-(\\d+)$`)
  const max = bookings.reduce((m, b) => {
    const hit = re.exec(b.id)
    return hit ? Math.max(m, Number(hit[1])) : m
  }, 0)
  return `WY-${ymd}-${String(max + 1).padStart(3, '0')}`
}

export function buildBooking(d: Draft, bookings: Booking[], now: number): Booking {
  const svcs = selectedServices(d.serviceIds)
  const custom = svcs.some((s) => s.perQuestion)
  const other = svcs.some((s) => s.id === 'ch-other')
  return {
    id: nextBookingId(bookings, d.date),
    serviceId: svcs[0].id,
    serviceName: svcs.map((s) => s.name).join(', '),
    questionCount: custom ? d.questionCount : undefined,
    otherQuestion: other ? d.otherQuestion.trim() : undefined,
    price: selectionTotal(d.serviceIds, d.questionCount),
    date: d.date,
    time: d.time,
    note: d.note.trim(),
    customer: {
      nickname: d.customer.nickname.trim(),
      fullName: d.customer.fullName.trim(),
      age: d.customer.age,
      relationship: d.customer.relationship,
    },
    status: 'pending_payment',
    isCall: svcs.some((s) => s.group === 'call'),
    createdAt: now,
  }
}

export function bookingEndMs(b: Booking): number {
  const [h, m] = b.time.split(':').map(Number)
  const start = fromISO(b.date)
  start.setHours(h, m, 0, 0)
  const svc = getService(b.serviceId)
  const minutes = svc?.unlimited ? 120 : svc?.durationMin ?? 60
  return start.getTime() + minutes * 60000
}

// อัปเดตสถานะตามเวลา: รอชำระเกินกำหนด → ยกเลิก (คืนรอบเวลา), ยืนยันแล้วและเลยเวลา → เสร็จแล้ว
// คืนอาร์เรย์เดิมถ้าไม่มีอะไรเปลี่ยน (กัน re-render ไม่จำเป็น)
export function settleBookings(bookings: Booking[], now: number): Booking[] {
  let changed = false
  const out = bookings.map((b): Booking => {
    if (b.status === 'pending_payment' && now - b.createdAt >= PAYMENT_LIMIT_MS) {
      changed = true
      return { ...b, status: 'cancelled' }
    }
    if (b.status === 'confirmed' && bookingEndMs(b) <= now) {
      changed = true
      return { ...b, status: 'completed' }
    }
    return b
  })
  return changed ? out : bookings
}
