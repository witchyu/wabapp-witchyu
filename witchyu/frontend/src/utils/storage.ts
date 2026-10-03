import { BOOKING_DAYS } from '../data/shop'
import { SERVICES } from '../data/services'
import type { Booking, BookingStatus, CustomerInfo, Draft } from '../types'
import { addDays, toISO } from './format'
import { SLOTS } from './slots'

export const BOOKINGS_KEY = 'witchyu.bookings.v1'
const DRAFT_KEY = 'witchyu.draft.v1'
const CUSTOMER_KEY = 'witchyu.customer'

const STATUSES: BookingStatus[] = ['pending_payment', 'confirmed', 'completed', 'cancelled']
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback)

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
function write(key: string, value: unknown) {
  try {
    const s = JSON.stringify(value)
    if (localStorage.getItem(key) !== s) localStorage.setItem(key, s) // ไม่เขียนซ้ำถ้าเหมือนเดิม
  } catch { /* โหมดส่วนตัว/พื้นที่เต็ม: ใช้งานต่อได้แต่ไม่บันทึก */ }
}

const cleanCustomer = (raw: unknown): CustomerInfo => {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return { nickname: str(o.nickname), fullName: str(o.fullName), age: str(o.age), relationship: str(o.relationship) }
}

export function isBooking(x: unknown): x is Booking {
  if (!x || typeof x !== 'object') return false
  const b = x as Record<string, unknown>
  return (
    typeof b.id === 'string' && /^WY-\d{8}-\d+$/.test(b.id) &&
    typeof b.serviceId === 'string' && typeof b.serviceName === 'string' &&
    typeof b.price === 'number' && Number.isFinite(b.price) &&
    typeof b.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date) &&
    typeof b.time === 'string' && /^\d{2}:\d{2}$/.test(b.time) &&
    typeof b.note === 'string' && typeof b.isCall === 'boolean' &&
    typeof b.createdAt === 'number' &&
    STATUSES.includes(b.status as BookingStatus) &&
    !!b.customer && typeof b.customer === 'object'
  )
}

export function loadBookings(): Booking[] {
  const raw = read(BOOKINGS_KEY)
  return Array.isArray(raw) ? raw.filter(isBooking).map((b) => ({ ...b, customer: cleanCustomer(b.customer) })) : []
}
export const saveBookings = (list: Booking[]) => write(BOOKINGS_KEY, list)

export function loadCustomer(): CustomerInfo | null {
  const raw = read(CUSTOMER_KEY)
  return raw && typeof raw === 'object' ? cleanCustomer(raw) : null
}
export const saveCustomer = (c: CustomerInfo) => write(CUSTOMER_KEY, c)

export const blankDraft = (customer: CustomerInfo, now: number = Date.now()): Draft => ({
  customer, remember: true, serviceIds: [], multi: false, questionCount: 1, otherQuestion: '',
  date: toISO(new Date(now)), time: '', note: '',
})

// กู้ข้อมูลที่กรอกค้างไว้ โดยตรวจทุกช่องก่อนใช้ (กันข้อมูลเก่า/เสียหาย/วันที่ผ่านไปแล้ว)
export function sanitizeDraft(raw: unknown, fallbackCustomer: CustomerInfo, now: number = Date.now()): Draft {
  const base = blankDraft(fallbackCustomer, now)
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  const known = new Set(SERVICES.filter((s) => s.active).map((s) => s.id))
  const ids = Array.isArray(o.serviceIds) ? [...new Set(o.serviceIds.filter((x): x is string => typeof x === 'string' && known.has(x)))] : []
  const multi = o.multi === true
  const validDates = Array.from({ length: BOOKING_DAYS }, (_, i) => toISO(addDays(new Date(now), i)))
  const date = typeof o.date === 'string' && validDates.includes(o.date) ? o.date : base.date
  const qc = Number(o.questionCount)
  return {
    customer: cleanCustomer(o.customer),
    remember: o.remember !== false,
    serviceIds: multi ? ids : ids.slice(0, 1),
    multi,
    questionCount: Number.isInteger(qc) && qc >= 1 && qc <= 50 ? qc : 1,
    otherQuestion: str(o.otherQuestion).slice(0, 300),
    date,
    time: date === o.date && typeof o.time === 'string' && SLOTS.includes(o.time) ? o.time : '',
    note: str(o.note).slice(0, 500),
  }
}

export const loadDraft = (fallbackCustomer: CustomerInfo): Draft => sanitizeDraft(read(DRAFT_KEY), fallbackCustomer)
export const saveDraft = (d: Draft) => write(DRAFT_KEY, d)
