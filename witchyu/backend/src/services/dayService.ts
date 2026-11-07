import type { Db } from '../db'
import { computeDaySlots, type DaySlots } from '../domain/rules'
import { dayOfWeek, shopNow } from '../domain/time'
import { readSettings } from './shopService'

// โหลดข้อมูลของวันหนึ่ง (รอบเวลา, เวลาทำการ, วันหยุด, คิวที่ถือรอบอยู่) แล้วคำนวณสถานะแต่ละรอบ
// ใช้ทั้งหน้าเลือกเวลา และตอนสร้าง/แก้ไขการจอง (ภายใน Transaction เดียวกัน)
export async function loadDaySlots(
  db: Db,
  date: string,
  opts: {
    services: { id: string; scheduleMode: 'shop' | 'custom' }[]
    nowMs: number
    excludeBookingId?: string
  },
): Promise<DaySlots> {
  const settings = await readSettings(db)
  const slots = await db.timeSlot.findMany()
  const customRows = opts.services.some((service) => service.scheduleMode === 'custom')
    ? await db.serviceTime.findMany({
        where: {
          serviceId: { in: opts.services.filter((service) => service.scheduleMode === 'custom').map((service) => service.id) },
          active: true,
        },
        select: { serviceId: true, time: true },
      })
    : []
  const customTimes: Record<string, string[]> = {}
  for (const row of customRows) {
    ;(customTimes[row.serviceId] ??= []).push(row.time)
  }
  const holiday = await db.holiday.findUnique({ where: { date } })
  const hours = await db.businessHours.findUnique({ where: { dayOfWeek: dayOfWeek(date) } })
  // ถือรอบไว้: ยืนยันแล้ว หรือรอชำระเงินที่ยังไม่หมดเวลา
  const held = await db.booking.findMany({
    where: {
      date,
      ...(opts.excludeBookingId ? { id: { not: opts.excludeBookingId } } : {}),
      OR: [
        { status: 'confirmed' },
        { status: 'pending_payment', expiresAt: { gt: new Date(opts.nowMs) } },
      ],
    },
    select: { time: true },
  })
  const counts: Record<string, number> = {}
  for (const b of held) counts[b.time] = (counts[b.time] ?? 0) + 1

  return computeDaySlots({
    date,
    shopOpen: settings.shopOpen,
    bookingDays: settings.bookingDays,
    now: shopNow(opts.nowMs),
    slots: slots.map((s) => ({ time: s.time, endTime: s.endTime, isLastSlot: s.isLastSlot, active: s.active })),
    hours: hours ? { openTime: hours.openTime, closeTime: hours.closeTime, isClosed: hours.isClosed } : null,
    holiday: holiday ? { reason: holiday.reason } : null,
    counts,
    services: opts.services,
    customTimes,
  })
}
