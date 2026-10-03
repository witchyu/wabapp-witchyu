import { BASE_SLOTS, BOOKING_DAYS, PAYMENT_LIMIT_MS, SLOT_CAPACITY, UNLIMITED_SLOT } from '../data/shop'
import type { Booking, Service, SlotStatus } from '../types'
import { addDays, toISO } from './format'

export const SLOTS = BASE_SLOTS

// รายการที่ "ถือรอบเวลาไว้": ยืนยันแล้ว หรือรอชำระเงินที่ยังไม่หมดเวลา
export function isActiveBooking(b: Booking, now: number): boolean {
  if (b.status === 'confirmed') return true
  if (b.status === 'pending_payment') return now - b.createdAt < PAYMENT_LIMIT_MS
  return false
}

export function slotCount(bookings: Booking[], dateISO: string, time: string, now: number): number {
  return bookings.filter((b) => b.date === dateISO && b.time === time && isActiveBooking(b, now)).length
}

// unlimitedSvc = บริการ "โทรไม่จำกัด" ถ้าลูกค้าเลือกไว้ (จองได้เฉพาะ 22:30)
export function slotStatus(bookings: Booking[], dateISO: string, time: string, unlimitedSvc?: Service, now: number = Date.now()): SlotStatus {
  if (!SLOTS.includes(time)) return 'closed'
  const nowDate = new Date(now)
  const today = toISO(nowDate)
  if (dateISO < today || dateISO > toISO(addDays(nowDate, BOOKING_DAYS - 1))) return 'closed'
  if (dateISO === today) {
    const [h, m] = time.split(':').map(Number)
    if (h * 60 + m <= nowDate.getHours() * 60 + nowDate.getMinutes()) return 'closed'
  }
  if (unlimitedSvc?.unlimited && time !== UNLIMITED_SLOT) return 'closed'
  return slotCount(bookings, dateISO, time, now) >= SLOT_CAPACITY ? 'full' : 'available'
}
