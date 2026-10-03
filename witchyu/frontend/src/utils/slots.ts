import { BASE_SLOTS, UNLIMITED_SLOT } from '../data/shop'
import type { Service, SlotStatus } from '../types'
import { toISO } from './format'

// สถานะเวลาแบบจำลอง (Phase 3 จะดึงจาก API)
export function slotStatus(dateISO: string, time: string, svc?: Service): SlotStatus {
  const now = new Date()
  if (dateISO === toISO(now)) {
    const [h, m] = time.split(':').map(Number)
    if (h * 60 + m <= now.getHours() * 60 + now.getMinutes()) return 'closed'
  }
  if (svc?.unlimited && time !== UNLIMITED_SLOT) return 'closed'
  const seed = dateISO.split('-').join('') + time.replace(':', '')
  const hash = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 97, 7)
  return hash % 4 === 0 ? 'full' : 'available'
}

export const SLOTS = BASE_SLOTS
