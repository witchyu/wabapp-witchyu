import { AppError } from './errors'

const bad = (message: string, code = 'VALIDATION') =>
  new AppError(400, code, message)

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw bad('รูปแบบข้อมูลไม่ถูกต้อง')
  }
  return value as Record<string, unknown>
}

function text(value: unknown, field: string, max: number, optional = false): string | undefined {
  if (optional && value === undefined) return undefined
  if (typeof value !== 'string') throw bad(`${field}ต้องเป็นข้อความ`)
  const result = value.trim()
  if (result.length > max) throw bad(`${field}ยาวเกิน ${max} ตัวอักษร`)
  return result
}

export function parseQueueDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw bad('รูปแบบวันที่ต้องเป็น YYYY-MM-DD')
  }
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw bad('วันที่ไม่ถูกต้อง')
  }
  return value
}

function parseType(value: unknown): 'text' | 'call' {
  if (value !== 'text' && value !== 'call') throw bad('ประเภทคิวไม่ถูกต้อง')
  return value
}

function parseTime(value: unknown): string {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw bad('รูปแบบเวลาต้องเป็น HH:mm')
  }
  return value
}

function parseStatus(value: unknown): 'available' | 'full' {
  if (value !== 'available' && value !== 'full') throw bad('สถานะคิวไม่ถูกต้อง')
  return value
}

export function parseQueueCreate(body: unknown) {
  const b = object(body)
  return {
    date: parseQueueDate(b.date),
    type: parseType(b.type),
    time: parseTime(b.time),
    detail: text(b.detail ?? '', 'รายละเอียด', 200) ?? '',
  }
}

export function parseQueueEntryPatch(body: unknown) {
  const b = object(body)
  const date = parseQueueDate(b.date)

  const patch: {
    time?: string
    detail?: string
    status?: 'available' | 'full'
  } = {}

  if (b.time !== undefined) patch.time = parseTime(b.time)
  if (b.detail !== undefined) patch.detail = text(b.detail, 'รายละเอียด', 200)
  if (b.status !== undefined) patch.status = parseStatus(b.status)

  if (Object.keys(patch).length === 0) throw bad('ไม่มีข้อมูลที่ต้องการแก้ไข')
  return { date, patch }
}

export function parseQueueSettingsPatch(body: unknown) {
  const b = object(body)
  const patch: {
    textTitle?: string
    textDescription?: string
    callTitle?: string
    callDescription?: string
    showCall?: boolean
  } = {}

  if (b.textTitle !== undefined) patch.textTitle = text(b.textTitle, 'ชื่อคิวพิมพ์', 60)
  if (b.textDescription !== undefined) patch.textDescription = text(b.textDescription, 'คำอธิบายคิวพิมพ์', 300)
  if (b.callTitle !== undefined) patch.callTitle = text(b.callTitle, 'ชื่อคิวโทร', 60)
  if (b.callDescription !== undefined) patch.callDescription = text(b.callDescription, 'คำอธิบายคิวโทร', 300)
  if (b.showCall !== undefined) {
    if (typeof b.showCall !== 'boolean') throw bad('showCall ต้องเป็น true หรือ false')
    patch.showCall = b.showCall
  }

  if (Object.keys(patch).length === 0) throw bad('ไม่มีการตั้งค่าที่ต้องการแก้ไข')
  return patch
}
