// ร้านใช้เวลาไทย (UTC+7 ไม่มี Daylight Saving) — เซิร์ฟเวอร์บน Render เป็น UTC จึงต้องคำนวณเอง ห้ามใช้เวลาท้องถิ่นของเครื่อง
const OFFSET_MS = 7 * 3600 * 1000
const pad = (n: number) => String(n).padStart(2, '0')

export interface ShopNow { date: string; minutes: number }

const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`

export function shopNow(nowMs: number): ShopNow {
  const d = new Date(nowMs + OFFSET_MS)
  return { date: fmt(d), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() }
}

export function isISODate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

export function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return fmt(new Date(Date.UTC(y, m - 1, d + n)))
}

export function dayOfWeek(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function isHHMM(s: unknown): s is string {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s)
}

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export const startMs = (date: string, time: string): number => Date.parse(`${date}T${time}:00+07:00`)
