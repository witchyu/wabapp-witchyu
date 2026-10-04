import { AppError } from './errors'
import { isHHMM, isISODate, toMinutes } from './time'

export const SERVICE_GROUPS = ['question', 'call', 'topic', 'choice', 'love59', 'love49', 'work', 'study'] as const
export type ServiceGroupId = (typeof SERVICE_GROUPS)[number]

const bad = (message: string, code = 'VALIDATION') => new AppError(400, code, message)

function obj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw bad('ข้อมูลไม่ถูกต้อง')
  return v as Record<string, unknown>
}
function str(v: unknown, label: string, min: number, max: number): string {
  if (typeof v !== 'string') throw bad(`กรุณากรอก${label}`)
  const t = v.trim()
  if (t.length < min) throw bad(`กรุณากรอก${label}`)
  if (t.length > max) throw bad(`${label}ยาวเกินไป (ไม่เกิน ${max} ตัวอักษร)`)
  return t
}
function int(v: unknown, label: string, min: number, max: number): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) throw bad(`${label}ต้องเป็นจำนวนเต็ม ${min}–${max}`)
  return n
}
function bool(v: unknown, label: string): boolean {
  if (typeof v !== 'boolean') throw bad(`${label}ไม่ถูกต้อง`)
  return v
}

// ---------- บริการ ----------
export interface ServiceInput {
  group: ServiceGroupId
  name: string
  description: string
  price: number
  durationMin: number | null
  unlimited: boolean
  perQuestion: boolean
  questions: string[]
  active: boolean
}

function parseGroup(v: unknown): ServiceGroupId {
  if (typeof v !== 'string' || !(SERVICE_GROUPS as readonly string[]).includes(v)) throw bad('หมวดบริการไม่ถูกต้อง')
  return v as ServiceGroupId
}
function parseQuestions(v: unknown): string[] {
  if (!Array.isArray(v) || v.length > 30) throw bad('รายการคำถามไม่ถูกต้อง (ไม่เกิน 30 ข้อ)')
  return v.map((q) => str(q, 'คำถาม', 1, 200))
}

export function parseServiceCreate(body: unknown): ServiceInput {
  const o = obj(body)
  return {
    group: parseGroup(o.group),
    name: str(o.name, 'ชื่อบริการ', 1, 80),
    description: o.description == null ? '' : str(o.description, 'รายละเอียด', 0, 200),
    price: int(o.price, 'ราคา', 1, 100000),
    durationMin: o.durationMin == null ? null : int(o.durationMin, 'ระยะเวลา (นาที)', 1, 600),
    unlimited: o.unlimited == null ? false : bool(o.unlimited, 'โทรไม่จำกัด'),
    perQuestion: o.perQuestion == null ? false : bool(o.perQuestion, 'คิดราคาต่อข้อ'),
    questions: o.questions == null ? [] : parseQuestions(o.questions),
    active: o.active == null ? true : bool(o.active, 'สถานะเปิดใช้งาน'),
  }
}

export function parseServicePatch(body: unknown): Partial<ServiceInput> {
  const o = obj(body)
  const out: Partial<ServiceInput> = {}
  if (o.group !== undefined) out.group = parseGroup(o.group)
  if (o.name !== undefined) out.name = str(o.name, 'ชื่อบริการ', 1, 80)
  if (o.description !== undefined) out.description = str(o.description, 'รายละเอียด', 0, 200)
  if (o.price !== undefined) out.price = int(o.price, 'ราคา', 1, 100000)
  if (o.durationMin !== undefined) out.durationMin = o.durationMin === null ? null : int(o.durationMin, 'ระยะเวลา (นาที)', 1, 600)
  if (o.unlimited !== undefined) out.unlimited = bool(o.unlimited, 'โทรไม่จำกัด')
  if (o.perQuestion !== undefined) out.perQuestion = bool(o.perQuestion, 'คิดราคาต่อข้อ')
  if (o.questions !== undefined) out.questions = parseQuestions(o.questions)
  if (o.active !== undefined) out.active = bool(o.active, 'สถานะเปิดใช้งาน')
  if (Object.keys(out).length === 0) throw bad('ไม่มีข้อมูลที่ต้องการแก้ไข')
  return out
}

// ---------- รอบเวลา ----------
export function parseSlotCreate(body: unknown): { time: string; capacity: number; active: boolean } {
  const o = obj(body)
  if (!isHHMM(o.time)) throw bad('รูปแบบเวลาไม่ถูกต้อง (HH:mm)')
  return {
    time: o.time,
    capacity: o.capacity == null ? 1 : int(o.capacity, 'จำนวนคิวสูงสุด', 1, 20),
    active: o.active == null ? true : bool(o.active, 'สถานะ'),
  }
}

export function parseSlotPatch(body: unknown): { capacity?: number; active?: boolean } {
  const o = obj(body)
  const out: { capacity?: number; active?: boolean } = {}
  if (o.capacity !== undefined) out.capacity = int(o.capacity, 'จำนวนคิวสูงสุด', 1, 20)
  if (o.active !== undefined) out.active = bool(o.active, 'สถานะ')
  if (Object.keys(out).length === 0) throw bad('ไม่มีข้อมูลที่ต้องการแก้ไข')
  return out
}

// ---------- เวลาทำการ ----------
export interface HoursInput { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }

export function parseHoursAll(body: unknown): HoursInput[] {
  const o = obj(body)
  if (!Array.isArray(o.hours) || o.hours.length !== 7) throw bad('ต้องระบุเวลาทำการครบ 7 วัน')
  const seen = new Set<number>()
  return o.hours.map((row) => {
    const r = obj(row)
    const dayOfWeek = int(r.dayOfWeek, 'วันในสัปดาห์', 0, 6)
    if (seen.has(dayOfWeek)) throw bad('ระบุวันซ้ำกัน')
    seen.add(dayOfWeek)
    if (!isHHMM(r.openTime) || !isHHMM(r.closeTime)) throw bad('รูปแบบเวลาไม่ถูกต้อง (HH:mm)')
    const isClosed = bool(r.isClosed, 'สถานะปิดทำการ')
    if (!isClosed && toMinutes(r.openTime) >= toMinutes(r.closeTime)) throw bad('เวลาเปิดต้องมาก่อนเวลาปิด')
    return { dayOfWeek, openTime: r.openTime, closeTime: r.closeTime, isClosed }
  })
}

// ---------- วันหยุด ----------
export function parseHolidayCreate(body: unknown): { date: string; reason: string } {
  const o = obj(body)
  if (!isISODate(o.date)) throw bad('วันที่ไม่ถูกต้อง')
  return { date: o.date, reason: o.reason == null ? '' : str(o.reason, 'เหตุผล', 0, 100) }
}

// ---------- สวิตช์ร้าน ----------
export function parseSettingsPatch(body: unknown): { shopOpen?: boolean; callsEnabled?: boolean } {
  const o = obj(body)
  const out: { shopOpen?: boolean; callsEnabled?: boolean } = {}
  if (o.shopOpen !== undefined) out.shopOpen = bool(o.shopOpen, 'สถานะร้าน')
  if (o.callsEnabled !== undefined) out.callsEnabled = bool(o.callsEnabled, 'สถานะรับจองโทร')
  if (Object.keys(out).length === 0) throw bad('ไม่มีข้อมูลที่ต้องการแก้ไข')
  return out
}

// ---------- ล็อกอิน / รายการจอง ----------
export function parseLogin(body: unknown): { username: string; password: string } {
  const o = obj(body)
  if (typeof o.username !== 'string' || typeof o.password !== 'string' || !o.username.trim() || !o.password) {
    throw bad('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน')
  }
  if (o.username.length > 64 || o.password.length > 200) throw bad('ข้อมูลยาวเกินไป')
  return { username: o.username.trim().toLowerCase(), password: o.password }
}

export const ADMIN_BOOKING_STATUSES = ['all', 'active', 'pending_payment', 'confirmed', 'completed', 'cancelled'] as const
export type AdminBookingStatus = (typeof ADMIN_BOOKING_STATUSES)[number]

export function parseAdminBookingsQuery(q: Record<string, unknown>): { status: AdminBookingStatus; date?: string; search?: string; page: number; pageSize: number } {
  const status = (q.status === undefined || q.status === '' ? 'active' : q.status) as string
  if (!(ADMIN_BOOKING_STATUSES as readonly string[]).includes(status)) throw bad('สถานะที่ค้นหาไม่ถูกต้อง')
  let date: string | undefined
  if (q.date !== undefined && q.date !== '') {
    if (!isISODate(q.date)) throw bad('วันที่ไม่ถูกต้อง')
    date = q.date
  }
  const search = typeof q.search === 'string' && q.search.trim() ? q.search.trim().slice(0, 60) : undefined
  const page = q.page === undefined ? 1 : int(q.page, 'หน้า', 1, 10000)
  return { status: status as AdminBookingStatus, date, search, page, pageSize: 25 }
}

export function parseIntParam(v: unknown, label = 'รหัส'): number {
  return int(v, label, 1, 2147483647)
}
