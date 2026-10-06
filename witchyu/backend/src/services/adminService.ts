import { randomBytes } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { toAdminServiceDto, toBookingDto } from '../domain/dto'
import { AppError } from '../domain/errors'
import { addDaysISO, shopNow } from '../domain/time'
import type { AdminBookingStatus, HoursInput, ServiceInput } from '../domain/adminValidation'
import { settleBookings } from './bookingService'
import { readAllHours, readSettings } from './shopService'

const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `ไม่พบ${what}`)
const isCode = (e: unknown, code: string) => (e as { code?: string })?.code === code

// รายการที่ถือรอบเวลาไว้ (ยืนยันแล้ว หรือรอชำระที่ยังไม่หมดเวลา)
const activeWhere = (now: Date): Prisma.BookingWhereInput => ({
  OR: [{ status: 'confirmed' }, { status: 'pending_payment', expiresAt: { gt: now } }],
})

// ---------- ภาพรวม ----------
export async function dashboard() {
  await settleBookings()
  const now = new Date()
  const today = shopNow(now.getTime()).date
  const todayCount = await prisma.booking.count({ where: { date: today, ...activeWhere(now) } })
  const pendingCount = await prisma.booking.count({ where: { status: 'pending_payment' } })
  const upcomingCount = await prisma.booking.count({ where: { status: 'confirmed', date: { gte: today } } })

  // Revenue = รายการที่ชำระแล้ว/ยืนยันแล้วเท่านั้น
  // pending_payment และ cancelled จะไม่ถูกนับเป็นรายได้
  const paidWhere: Prisma.BookingWhereInput = {
    status: { in: ['confirmed', 'completed'] },
  }

  const [todayRevenueAgg, totalRevenueAgg, paidCount] = await prisma.$transaction([
    prisma.booking.aggregate({
      where: { ...paidWhere, date: today },
      _sum: { price: true },
    }),
    prisma.booking.aggregate({
      where: paidWhere,
      _sum: { price: true },
    }),
    prisma.booking.count({ where: paidWhere }),
  ])

  const todayRevenue = todayRevenueAgg._sum.price ?? 0
  const totalRevenue = totalRevenueAgg._sum.price ?? 0

  const next = await prisma.booking.findMany({
    where: { status: 'confirmed', date: { gte: today } },
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
    take: 5,
  })
  return {
    today,
    stats: {
      todayCount,
      pendingCount,
      upcomingCount,
      todayRevenue,
      totalRevenue,
      paidCount,
    },
    next: next.map(toBookingDto),
    settings: await readSettings(prisma),
  }
}

// ---------- การจอง ----------
export async function listBookings(q: { status: AdminBookingStatus; date?: string; search?: string; page: number; pageSize: number }) {
  await settleBookings()
  const where: Prisma.BookingWhereInput = {}
  if (q.status === 'active') where.status = { in: ['pending_payment', 'confirmed'] }
  else if (q.status !== 'all') where.status = q.status
  if (q.date) where.date = q.date
  if (q.search) {
    where.OR = [
      { id: { contains: q.search, mode: 'insensitive' } },
      { nickname: { contains: q.search, mode: 'insensitive' } },
      { fullName: { contains: q.search, mode: 'insensitive' } },
    ]
  }
  // คิวที่ยังไม่ถึง → เรียงจากใกล้สุด / ประวัติ → เรียงจากล่าสุด
  const upcomingView = q.status === 'active' || q.status === 'pending_payment' || q.status === 'confirmed'
  const dir = upcomingView ? 'asc' : 'desc'
  const [total, rows] = await prisma.$transaction([
    prisma.booking.count({ where }),
    prisma.booking.findMany({ where, orderBy: [{ date: dir }, { time: dir }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ])
  return { bookings: rows.map(toBookingDto), total, page: q.page, pageSize: q.pageSize }
}

export async function getBooking(id: string) {
  await settleBookings()
  const b = await prisma.booking.findUnique({ where: { id } })
  if (!b) throw notFound('รายการจอง')
  return toBookingDto(b)
}

// ยืนยันด้วยมือ: เฉพาะรายการที่รอชำระเงิน (เช่น แอดมินตรวจเห็นว่าเงินเข้าแล้ว)
export async function confirmBooking(id: string) {
  await settleBookings()
  const r = await prisma.booking.updateMany({ where: { id, status: 'pending_payment' }, data: { status: 'confirmed' } })
  if (r.count === 0) {
    const cur = await prisma.booking.findUnique({ where: { id } })
    if (!cur) throw notFound('รายการจอง')
    if (cur.status === 'confirmed') return toBookingDto(cur)
    throw new AppError(409, 'INVALID_STATUS', 'ยืนยันได้เฉพาะรายการที่รอชำระเงิน (รายการนี้อาจหมดเวลาหรือถูกยกเลิกแล้ว)')
  }
  return getBooking(id)
}

export async function cancelBooking(id: string) {
  await settleBookings()
  const r = await prisma.booking.updateMany({ where: { id, status: { in: ['pending_payment', 'confirmed'] } }, data: { status: 'cancelled' } })
  if (r.count === 0) {
    const cur = await prisma.booking.findUnique({ where: { id } })
    if (!cur) throw notFound('รายการจอง')
    if (cur.status === 'cancelled') return toBookingDto(cur)
    throw new AppError(409, 'INVALID_STATUS', 'รายการนี้ยกเลิกไม่ได้แล้ว')
  }
  return getBooking(id)
}

// ลบถาวรได้เฉพาะรายการที่เสร็จแล้วหรือยกเลิกแล้ว
// ไม่เรียก settleBookings() ที่นี่ เพราะ confirmed ต้องถูกปฏิเสธตามสถานะปัจจุบัน
export async function deleteBooking(id: string) {
  return prisma.$transaction(async (tx) => {
    const cur = await tx.booking.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!cur) throw notFound('รายการจอง')

    if (cur.status !== 'completed' && cur.status !== 'cancelled') {
      throw new AppError(
        409,
        'INVALID_STATUS',
        'ลบถาวรได้เฉพาะรายการที่เสร็จแล้วหรือยกเลิกแล้ว',
      )
    }

    // ลบข้อมูลที่อ้างอิง Booking ก่อน เพราะ Prisma schema
    // ยังไม่ได้ตั้ง onDelete: Cascade สำหรับ Message/CallSession
    await tx.message.deleteMany({ where: { bookingId: id } })
    await tx.callSession.deleteMany({ where: { bookingId: id } })
    await tx.booking.delete({ where: { id } })

    return { ok: true, id }
  })
}

// ---------- บริการ ----------
export async function listServices() {
  const rows = await prisma.service.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { category: true },
  })
  return rows.map(toAdminServiceDto)
}

export async function createService(input: ServiceInput) {
  const categoryId = input.categoryId ?? input.group

  const category = await prisma.serviceCategory.findUnique({
    where: { id: categoryId },
    select: { id: true },
  })

  if (!category) {
    throw new AppError(400, 'CATEGORY_NOT_FOUND', 'ไม่พบหมวดหมู่บริการ')
  }

  const last = await prisma.service.aggregate({ _max: { sortOrder: true } })

  const row = await prisma.service.create({
    data: {
      id: `svc-${randomBytes(4).toString('hex')}`,
      ...input,
      categoryId,
      sortOrder: (last._max.sortOrder ?? 0) + 1,
    },
    include: { category: true },
  })

  return toAdminServiceDto(row)
}

export async function updateService(id: string, patch: Partial<ServiceInput>) {
  try {
    if (patch.categoryId !== undefined) {
      const category = await prisma.serviceCategory.findUnique({
        where: { id: patch.categoryId },
        select: { id: true },
      })

      if (!category) {
        throw new AppError(400, 'CATEGORY_NOT_FOUND', 'ไม่พบหมวดหมู่บริการ')
      }
    }

    const row = await prisma.service.update({
      where: { id },
      data: patch,
      include: { category: true },
    })

    return toAdminServiceDto(row)
  } catch (e) {
    if (isCode(e, 'P2025')) throw notFound('บริการ')
    throw e
  }
}

// การจองเดิมเก็บชื่อและราคาไว้ในตัวเองแล้ว จึงลบบริการได้โดยประวัติไม่เสีย
export async function deleteService(id: string) {
  try {
    await prisma.service.delete({ where: { id } })
  } catch (e) {
    if (isCode(e, 'P2025')) throw notFound('บริการ')
    throw e
  }
}


// ---------- หมวดหมู่บริการ ----------
export async function listServiceCategories() {
  return prisma.serviceCategory.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  })
}

export async function createServiceCategory(input: {
  id: string
  label: string
  hint: string
  note: string
  multi: boolean
  active: boolean
  sortOrder: number
}) {
  try {
    return await prisma.serviceCategory.create({ data: input })
  } catch (e) {
    if (isCode(e, 'P2002')) {
      throw new AppError(409, 'CATEGORY_EXISTS', 'มีรหัสหมวดหมู่นี้อยู่แล้ว')
    }
    throw e
  }
}

export async function updateServiceCategory(
  id: string,
  patch: {
    label?: string
    hint?: string
    note?: string
    multi?: boolean
    active?: boolean
    sortOrder?: number
  },
) {
  try {
    return await prisma.serviceCategory.update({
      where: { id },
      data: patch,
    })
  } catch (e) {
    if (isCode(e, 'P2025')) throw notFound('หมวดหมู่บริการ')
    throw e
  }
}

export async function deleteServiceCategory(id: string) {
  const category = await prisma.serviceCategory.findUnique({
    where: { id },
    select: { id: true },
  })

  if (!category) throw notFound('หมวดหมู่บริการ')

  const serviceCount = await prisma.service.count({
    where: { categoryId: id },
  })

  if (serviceCount > 0) {
    throw new AppError(
      409,
      'CATEGORY_IN_USE',
      `ลบหมวดหมู่นี้ไม่ได้ เพราะมีบริการใช้งานอยู่ ${serviceCount} รายการ`,
    )
  }

  await prisma.serviceCategory.delete({
    where: { id },
  })

  return { ok: true, id }
}

// ---------- รอบเวลา ----------
export const listSlots = () => prisma.timeSlot.findMany({ orderBy: { time: 'asc' } })

export async function createSlot(input: { time: string; capacity: number; active: boolean }) {
  try {
    return await prisma.timeSlot.create({ data: input })
  } catch (e) {
    if (isCode(e, 'P2002')) throw new AppError(409, 'SLOT_EXISTS', 'มีรอบเวลานี้อยู่แล้ว')
    throw e
  }
}

export async function updateSlot(id: number, patch: { capacity?: number; active?: boolean }) {
  try {
    return await prisma.timeSlot.update({ where: { id }, data: patch })
  } catch (e) {
    if (isCode(e, 'P2025')) throw notFound('รอบเวลา')
    throw e
  }
}

export async function deleteSlot(id: number) {
  const slot = await prisma.timeSlot.findUnique({ where: { id } })
  if (!slot) throw notFound('รอบเวลา')
  const now = new Date()
  const inUse = await prisma.booking.count({
    where: { time: slot.time, date: { gte: shopNow(now.getTime()).date }, ...activeWhere(now) },
  })
  if (inUse > 0) {
    throw new AppError(409, 'SLOT_IN_USE', `ลบไม่ได้ เพราะมีการจองรอบ ${slot.time} ที่ยังไม่ถึงเวลา ${inUse} รายการ — ให้ "ปิดรอบ" แทน หรือยกเลิกการจองเหล่านั้นก่อน`)
  }
  await prisma.timeSlot.delete({ where: { id } })
}

// ---------- เวลาทำการ ----------
export async function getHours() {
  const rows = await readAllHours(prisma)
  // เติมวันที่ยังไม่มีแถวด้วยค่าเริ่มต้น
  return Array.from({ length: 7 }, (_, d) => rows.find((r) => r.dayOfWeek === d) ?? { dayOfWeek: d, openTime: '18:00', closeTime: '23:00', isClosed: false })
}

export async function saveHours(rows: HoursInput[]) {
  await prisma.$transaction(
    rows.map((r) =>
      prisma.businessHours.upsert({
        where: { dayOfWeek: r.dayOfWeek },
        update: { openTime: r.openTime, closeTime: r.closeTime, isClosed: r.isClosed },
        create: r,
      }),
    ),
  )
  return getHours()
}

// ---------- วันหยุด / ปิดรับจองรายวัน ----------
export async function listHolidays() {
  const today = shopNow(Date.now()).date
  return prisma.holiday.findMany({ where: { date: { gte: today } }, orderBy: { date: 'asc' } })
}

export async function addHoliday(input: { date: string; reason: string }) {
  const today = shopNow(Date.now()).date
  if (input.date < today) throw new AppError(400, 'VALIDATION', 'เลือกวันที่ย้อนหลังไม่ได้')
  if (input.date > addDaysISO(today, 365)) throw new AppError(400, 'VALIDATION', 'กำหนดล่วงหน้าได้ไม่เกิน 1 ปี')
  const holiday = await prisma.holiday.upsert({ where: { date: input.date }, update: { reason: input.reason }, create: input })
  // การจองที่มีอยู่แล้วในวันนั้นไม่ถูกยกเลิกอัตโนมัติ — แจ้งจำนวนให้แอดมินจัดการเอง
  const now = new Date()
  const affectedBookings = await prisma.booking.count({ where: { date: input.date, ...activeWhere(now) } })
  return { holiday, affectedBookings }
}

export async function deleteHoliday(id: number) {
  try {
    await prisma.holiday.delete({ where: { id } })
  } catch (e) {
    if (isCode(e, 'P2025')) throw notFound('วันหยุด')
    throw e
  }
}

// ---------- สวิตช์ร้าน ----------
export const getSettings = () => readSettings(prisma)

export async function updateSettings(patch: {
  shopOpen?: boolean
  callsEnabled?: boolean
  customerDataRetentionDays?: number
  bookingRetentionDays?: number
  chatRetentionDays?: number
  callRecordRetentionDays?: number
  systemLogRetentionDays?: number
}) {
  await prisma.shopSetting.upsert({
    where: { id: 1 },
    update: patch,
    create: {
      id: 1,
      shopOpen: patch.shopOpen ?? true,
      callsEnabled: patch.callsEnabled ?? true,
      customerDataRetentionDays: patch.customerDataRetentionDays ?? 30,
      bookingRetentionDays: patch.bookingRetentionDays ?? 30,
      chatRetentionDays: patch.chatRetentionDays ?? 10,
      callRecordRetentionDays: patch.callRecordRetentionDays ?? 10,
      systemLogRetentionDays: patch.systemLogRetentionDays ?? 7,
    },
  })

  return readSettings(prisma)
}
