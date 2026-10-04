import { BOOKING_DAYS } from '../data/shop'
import { getServices } from '../data/services'
import type { CustomerInfo, Draft } from '../types'
import { addDays, toISO } from './format'

// เก็บเฉพาะข้อมูลฝั่งเครื่อง: ข้อมูลผู้จอง และแบบฟอร์มที่กรอกค้างไว้ (การจองจริงอยู่ที่เซิร์ฟเวอร์)
const DRAFT_KEY = 'witchyu.draft.v1'
const CUSTOMER_KEY = 'witchyu.customer'
const LEGACY_KEYS = ['witchyu.bookings.v1'] // ข้อมูลทดลองเก่าของ Phase 2 (เก็บในเครื่อง) ไม่ใช้แล้ว

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
    if (localStorage.getItem(key) !== s) localStorage.setItem(key, s)
  } catch { /* โหมดส่วนตัว/พื้นที่เต็ม: ใช้งานต่อได้แต่ไม่บันทึก */ }
}

export function clearLegacyStorage() {
  try { LEGACY_KEYS.forEach((k) => localStorage.removeItem(k)) } catch { /* ignore */ }
}

const cleanCustomer = (raw: unknown): CustomerInfo => {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return { nickname: str(o.nickname), fullName: str(o.fullName), age: str(o.age), relationship: str(o.relationship) }
}

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
  const known = new Set(getServices().filter((s) => s.active).map((s) => s.id))
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
    time: date === o.date && typeof o.time === 'string' && /^\d{2}:\d{2}$/.test(o.time) ? o.time : '',
    note: str(o.note).slice(0, 500),
  }
}

export const loadDraft = (fallbackCustomer: CustomerInfo): Draft => sanitizeDraft(read(DRAFT_KEY), fallbackCustomer)
export const saveDraft = (d: Draft) => write(DRAFT_KEY, d)
