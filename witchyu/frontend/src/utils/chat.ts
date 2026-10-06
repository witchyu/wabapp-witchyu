import type { ChatMessage, ChatRole } from '../types/chat'
import { dateLong } from './format'

const pad = (n: number) => String(n).padStart(2, '0')

// ข้อความที่ยังไม่ยืนยัน (กำลังส่ง/ส่งไม่สำเร็จ) อยู่ท้ายสุดเสมอ ที่เหลือเรียงตามเวลาของเซิร์ฟเวอร์
const order = (a: ChatMessage, b: ChatMessage) =>
  Number(!!a.local) - Number(!!b.local) || a.createdAt - b.createdAt || a.id.localeCompare(b.id)

// รวมข้อความ: ซ้ำ (id เดียวกัน หรือ clientMsgId เดียวกัน) → ใช้ฉบับจากเซิร์ฟเวอร์แทนฉบับชั่วคราว
export function mergeMessages(list: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const out = [...list]
  for (const m of incoming) {
    const i = out.findIndex((x) => x.id === m.id || (!!m.clientMsgId && x.clientMsgId === m.clientMsgId))
    if (i >= 0) {
      const { local: _local, ...rest } = out[i]
      void _local
      out[i] = { ...rest, ...m, local: m.local }
    } else out.push(m)
  }
  return out.sort(order)
}

// อีกฝ่ายอ่านแล้ว ณ เวลา readAt → ข้อความของเราที่ส่งก่อนหน้านั้นเป็น "อ่านแล้ว"
export function markOwnRead(list: ChatMessage[], myRole: ChatRole, readAt: number): ChatMessage[] {
  return list.map((m) => (m.senderRole === myRole && !m.local && m.readAt === null && m.createdAt <= readAt ? { ...m, readAt } : m))
}

// แสดงคำว่า "อ่านแล้ว" เฉพาะใต้ข้อความล่าสุดของเราที่อีกฝ่ายอ่านแล้ว
export function lastReadOwnId(list: ChatMessage[], myRole: ChatRole): string | null {
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i]
    if (m.senderRole === myRole && m.readAt !== null) return m.id
  }
  return null
}

export const dayKey = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function dayLabel(ms: number, nowMs: number = Date.now()): string {
  const key = dayKey(ms)
  if (key === dayKey(nowMs)) return 'วันนี้'
  if (key === dayKey(nowMs - 86400000)) return 'เมื่อวาน'
  return dateLong(key)
}

export const timeLabel = (ms: number) => {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function newClientMsgId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

export const previewOf = (m: ChatMessage | null, myRole: ChatRole) =>
  m ? `${m.senderRole === myRole ? 'คุณ: ' : ''}${m.body.replace(/\s+/g, ' ').slice(0, 80)}` : ''
