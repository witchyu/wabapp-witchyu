import { AppError } from './errors'
import { isHHMM, isISODate } from './time'

export interface CustomerInput { nickname: string; fullName: string; age: number; relationship: string }
export interface CreateBookingInput {
  customer: CustomerInput
  serviceIds: string[]
  questionCount?: number
  otherQuestion?: string
  date: string
  time: string
  note: string
}
export interface UpdateBookingInput {
  note?: string
  customer?: CustomerInput
  date?: string
  time?: string
}

const bad = (code: string, message: string) => new AppError(400, code, message)

function asObject(v: unknown, what = 'ข้อมูล'): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw bad('VALIDATION', `${what}ไม่ถูกต้อง`)
  return v as Record<string, unknown>
}

function text(v: unknown, label: string, code: string, opts: { min?: number; max: number }): string {
  if (typeof v !== 'string') throw bad(code, `กรุณากรอก${label}`)
  const t = v.trim()
  if (t.length < (opts.min ?? 0)) throw bad(code, `กรุณากรอก${label}`)
  if (t.length > opts.max) throw bad(code, `${label}ยาวเกินไป (ไม่เกิน ${opts.max} ตัวอักษร)`)
  return t
}

export function parseCustomer(v: unknown): CustomerInput {
  const o = asObject(v, 'ข้อมูลผู้จอง')
  const C = 'VALIDATION_CUSTOMER'
  const age = typeof o.age === 'string' && o.age.trim() !== '' ? Number(o.age) : o.age
  if (typeof age !== 'number' || !Number.isInteger(age) || age < 1 || age > 120) throw bad(C, 'กรุณากรอกอายุให้ถูกต้อง')
  return {
    nickname: text(o.nickname, 'ชื่อเล่น', C, { min: 1, max: 50 }),
    fullName: text(o.fullName, 'ชื่อจริง', C, { min: 1, max: 100 }),
    age,
    relationship: text(o.relationship, 'สถานะความสัมพันธ์', C, { min: 1, max: 30 }),
  }
}

function parseDate(v: unknown): string {
  if (!isISODate(v)) throw bad('VALIDATION_SCHEDULE', 'วันที่ไม่ถูกต้อง')
  return v
}
function parseTime(v: unknown): string {
  if (!isHHMM(v)) throw bad('VALIDATION_SCHEDULE', 'กรุณาเลือกเวลา')
  return v
}

export function parseServiceIds(v: unknown): string[] {
  if (!Array.isArray(v) || v.length < 1 || v.length > 10 || v.some((x) => typeof x !== 'string' || !x || x.length > 40)) {
    throw bad('VALIDATION_SERVICE', 'กรุณาเลือกบริการอย่างน้อย 1 รายการ')
  }
  const ids = v as string[]
  if (new Set(ids).size !== ids.length) throw bad('VALIDATION_SERVICE', 'เลือกบริการซ้ำกัน')
  return ids
}

export function parseCreateBooking(body: unknown): CreateBookingInput {
  const o = asObject(body)
  const qc = o.questionCount
  if (qc !== undefined && qc !== null && (typeof qc !== 'number' || !Number.isInteger(qc))) {
    throw bad('VALIDATION_SERVICE', 'จำนวนคำถามไม่ถูกต้อง')
  }
  return {
    customer: parseCustomer(o.customer),
    serviceIds: parseServiceIds(o.serviceIds),
    questionCount: typeof qc === 'number' ? qc : undefined,
    otherQuestion: o.otherQuestion == null ? undefined : text(o.otherQuestion, 'คำถาม', 'VALIDATION_SERVICE', { max: 300 }),
    date: parseDate(o.date),
    time: parseTime(o.time),
    note: o.note == null ? '' : text(o.note, 'หมายเหตุ', 'VALIDATION', { max: 500 }),
  }
}

export function parseUpdateBooking(body: unknown): UpdateBookingInput {
  const o = asObject(body)
  const out: UpdateBookingInput = {}
  if (o.note !== undefined) out.note = text(o.note, 'หมายเหตุ', 'VALIDATION', { max: 500 })
  if (o.customer !== undefined) out.customer = parseCustomer(o.customer)
  if ((o.date === undefined) !== (o.time === undefined)) throw bad('VALIDATION_SCHEDULE', 'ต้องระบุทั้งวันที่และเวลา')
  if (o.date !== undefined) {
    out.date = parseDate(o.date)
    out.time = parseTime(o.time)
  }
  if (Object.keys(out).length === 0) throw bad('VALIDATION', 'ไม่มีข้อมูลที่ต้องการแก้ไข')
  return out
}

export function parseClientId(v: unknown): string {
  if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(v)) {
    throw new AppError(401, 'CLIENT_ID_REQUIRED', 'ไม่พบรหัสอุปกรณ์ (X-Client-Id)')
  }
  return v
}

export function parseSlotsQuery(q: Record<string, unknown>): { date: string; serviceIds: string[] } {
  const date = parseDate(q.date)
  const raw = typeof q.serviceIds === 'string' && q.serviceIds ? q.serviceIds.split(',') : []
  if (raw.length > 10 || raw.some((x) => !x || x.length > 40)) throw bad('VALIDATION_SERVICE', 'รายการบริการไม่ถูกต้อง')
  return { date, serviceIds: raw }
}
