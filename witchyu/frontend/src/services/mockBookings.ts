import type { Booking, CustomerInfo } from '../types'
import { addDays, toISO } from '../utils/format'

export const EMPTY_CUSTOMER: CustomerInfo = { nickname: '', fullName: '', age: '', relationship: '' }

const me: CustomerInfo = { nickname: 'มิ้นท์', fullName: 'ชลธิชา ใจดี', age: '24', relationship: 'โสด' }

// ข้อมูลตัวอย่างสำหรับ Phase 1 (Phase 2 ใช้ LocalStorage, Phase 3 ใช้ API)
export function seedBookings(): Booking[] {
  const t = new Date()
  const ymd = (n: number) => toISO(addDays(t, n)).split('-').join('')
  return [
    { id: `WY-${ymd(2)}-001`, serviceId: 'c-30', serviceName: 'โทร 30 นาที', price: 129, date: toISO(addDays(t, 2)), time: '20:00', note: 'อยากถามเรื่องงานใหม่', customer: me, status: 'confirmed', isCall: true },
    { id: `WY-${ymd(4)}-002`, serviceId: 'q-3', serviceName: '3 คำถาม', questionCount: 3, price: 79, date: toISO(addDays(t, 4)), time: '19:00', note: '', customer: me, status: 'confirmed', isCall: false },
    { id: `WY-${ymd(-3)}-001`, serviceId: 't-money', serviceName: 'การเงิน', price: 149, date: toISO(addDays(t, -3)), time: '21:00', note: '', customer: me, status: 'completed', isCall: false },
    { id: `WY-${ymd(-6)}-004`, serviceId: 'l-crush', serviceName: 'คนแอบชอบ', price: 59, date: toISO(addDays(t, -6)), time: '18:00', note: '', customer: me, status: 'cancelled', isCall: false },
  ]
}
