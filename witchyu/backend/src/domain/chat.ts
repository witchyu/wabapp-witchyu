import { AppError } from './errors'

export type ChatRole = 'customer' | 'admin'
export const MAX_BODY = 1000
export const HISTORY_DEFAULT = 30
export const HISTORY_MAX = 50

const bad = (code: string, message: string) => new AppError(400, code, message)

export function parseMessageBody(v: unknown): string {
  if (typeof v !== 'string') throw bad('VALIDATION', 'กรุณาพิมพ์ข้อความ')
  // ตัดอักขระควบคุมที่มองไม่เห็น (เก็บขึ้นบรรทัดใหม่/แท็บไว้)
  const t = v.replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
  if (!t) throw bad('VALIDATION', 'กรุณาพิมพ์ข้อความ')
  if (t.length > MAX_BODY) throw bad('VALIDATION', `ข้อความยาวเกินไป (ไม่เกิน ${MAX_BODY} ตัวอักษร)`)
  return t
}

export function parseClientMsgId(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined
  if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(v)) throw bad('VALIDATION', 'รหัสข้อความไม่ถูกต้อง')
  return v
}

export const encodeCursor = (createdAtMs: number, id: string) => `${createdAtMs}_${id}`

export function decodeCursor(v: string): { ms: number; id: string } {
  const m = /^(\d{10,16})_([A-Za-z0-9]{8,40})$/.exec(v)
  if (!m) throw bad('VALIDATION', 'ตัวชี้ตำแหน่งข้อความไม่ถูกต้อง')
  return { ms: Number(m[1]), id: m[2] }
}

export function parseHistoryQuery(q: Record<string, unknown>): { limit: number; before?: { ms: number; id: string } } {
  let limit = HISTORY_DEFAULT
  if (q.limit !== undefined && q.limit !== '') {
    const n = Number(q.limit)
    if (!Number.isInteger(n) || n < 1 || n > HISTORY_MAX) throw bad('VALIDATION', `limit ต้องเป็นจำนวนเต็ม 1–${HISTORY_MAX}`)
    limit = n
  }
  const before = typeof q.before === 'string' && q.before ? decodeCursor(q.before) : undefined
  return { limit, before }
}

export function parseBookingIdParam(v: unknown): string {
  if (typeof v !== 'string' || !/^WY-\d{8}-\d{1,6}$/.test(v)) throw new AppError(404, 'BOOKING_NOT_FOUND', 'ไม่พบรายการจอง')
  return v
}

// ใครส่งข้อความได้เมื่อรายการอยู่ในสถานะใด
// ลูกค้า: เฉพาะรายการที่ชำระแล้ว (ยืนยัน/เสร็จแล้ว) · แอดมิน: ทุกสถานะยกเว้นที่ยกเลิก
export function canSend(role: ChatRole, status: string): boolean {
  if (role === 'customer') return status === 'confirmed' || status === 'completed'
  return status !== 'cancelled'
}

export function cannotSendReason(role: ChatRole, status: string): string {
  if (status === 'cancelled') return 'รายการนี้ถูกยกเลิก ส่งข้อความไม่ได้'
  if (role === 'customer' && status === 'pending_payment') return 'ชำระเงินก่อน จึงจะแชตกับหมอดูได้'
  return 'ส่งข้อความไม่ได้ในสถานะนี้'
}

export const peerOf = (role: ChatRole): ChatRole => (role === 'customer' ? 'admin' : 'customer')

export interface MessageRowLike {
  id: string
  bookingId: string
  senderRole: string
  body: string
  clientMsgId: string | null
  createdAt: Date
  readAt: Date | null
}

export function toMessageDto(m: MessageRowLike) {
  return {
    id: m.id,
    bookingId: m.bookingId,
    senderRole: m.senderRole as ChatRole,
    body: m.body,
    clientMsgId: m.clientMsgId ?? undefined,
    createdAt: m.createdAt.getTime(),
    readAt: m.readAt ? m.readAt.getTime() : null,
  }
}
