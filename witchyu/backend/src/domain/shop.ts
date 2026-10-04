import type { ShopNow } from './time'
import { toMinutes } from './time'

export interface HoursFull { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }

const DAY_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
const ORDER = [1, 2, 3, 4, 5, 6, 0] // จันทร์ → อาทิตย์

// "ทุกวัน 18:00 – 23:00 น." / "จ.–ศ. 18:00 – 23:00 น. · ส.–อา. ปิด"
export function formatHoursLabel(rows: HoursFull[]): string {
  const text = (d: number) => {
    const r = rows.find((x) => x.dayOfWeek === d)
    return !r || r.isClosed ? 'ปิด' : `${r.openTime} – ${r.closeTime} น.`
  }
  const groups: { days: number[]; text: string }[] = []
  for (const d of ORDER) {
    const t = text(d)
    const last = groups[groups.length - 1]
    if (last && last.text === t) last.days.push(d)
    else groups.push({ days: [d], text: t })
  }
  if (groups.length === 1) return groups[0].text === 'ปิด' ? 'ปิดทุกวัน' : `ทุกวัน ${groups[0].text}`
  return groups
    .map((g) => {
      const first = DAY_SHORT[g.days[0]]
      const lastDay = DAY_SHORT[g.days[g.days.length - 1]]
      return `${g.days.length === 1 ? first : `${first}–${lastDay}`} ${g.text}`
    })
    .join(' · ')
}

// ร้าน "เปิดอยู่ตอนนี้": สวิตช์เปิด + ไม่ใช่วันหยุด + อยู่ในเวลาทำการของวันนี้
export function computeOpenNow(a: { shopOpen: boolean; now: ShopNow; hoursToday: HoursFull | null; holidayToday: boolean }): boolean {
  if (!a.shopOpen || a.holidayToday || !a.hoursToday || a.hoursToday.isClosed) return false
  return a.now.minutes >= toMinutes(a.hoursToday.openTime) && a.now.minutes < toMinutes(a.hoursToday.closeTime)
}
