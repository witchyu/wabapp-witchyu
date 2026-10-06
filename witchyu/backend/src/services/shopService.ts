import { prisma, type Db } from '../db'
import { computeOpenNow, formatHoursLabel, type HoursFull } from '../domain/shop'
import { dayOfWeek, shopNow } from '../domain/time'

export interface Settings {
  shopOpen: boolean
  callsEnabled: boolean
  customerDataRetentionDays: number
  bookingRetentionDays: number
  chatRetentionDays: number
  callRecordRetentionDays: number
  systemLogRetentionDays: number
}

// ไม่มีแถวตั้งค่า = ค่าเริ่มต้น (เปิดทั้งหมด)
export async function readSettings(db: Db): Promise<Settings> {
  const row = await db.shopSetting.findUnique({ where: { id: 1 } })
  return {
    shopOpen: row?.shopOpen ?? true,
    callsEnabled: row?.callsEnabled ?? true,
    customerDataRetentionDays: row?.customerDataRetentionDays ?? 30,
    bookingRetentionDays: row?.bookingRetentionDays ?? 30,
    chatRetentionDays: row?.chatRetentionDays ?? 10,
    callRecordRetentionDays: row?.callRecordRetentionDays ?? 10,
    systemLogRetentionDays: row?.systemLogRetentionDays ?? 7,
  }
}

export async function readAllHours(db: Db): Promise<HoursFull[]> {
  const rows = await db.businessHours.findMany({ orderBy: { dayOfWeek: 'asc' } })
  return rows.map((r) => ({ dayOfWeek: r.dayOfWeek, openTime: r.openTime, closeTime: r.closeTime, isClosed: r.isClosed }))
}

// ข้อมูลร้านสำหรับหน้าลูกค้า (สาธารณะ)
export async function getPublicShop() {
  const settings = await readSettings(prisma)
  const hours = await readAllHours(prisma)
  const now = shopNow(Date.now())
  const holiday = await prisma.holiday.findUnique({ where: { date: now.date } })
  const hoursToday = hours.find((h) => h.dayOfWeek === dayOfWeek(now.date)) ?? null
  return {
    isOpen: settings.shopOpen,
    callsEnabled: settings.callsEnabled,
    openNow: computeOpenNow({ shopOpen: settings.shopOpen, now, hoursToday, holidayToday: !!holiday }),
    hoursLabel: formatHoursLabel(hours),
  }
}
