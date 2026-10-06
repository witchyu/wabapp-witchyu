import { Prisma } from '@prisma/client'
import { config } from '../config'
import { prisma } from '../db'
import { toBookingDto } from '../domain/dto'
import { AppError } from '../domain/errors'
import {
  PAYMENT_LIMIT_MS, assertSlotAvailable, bookingEndMs, isEditable, nextBookingId, resolveSelection,
} from '../domain/rules'
import { shopNow } from '../domain/time'
import type { CreateBookingInput, UpdateBookingInput } from '../domain/validation'
import { loadDaySlots } from './dayService'
import { readSettings } from './shopService'

// จองรอบเดียวกันพร้อมกัน: ใช้ Transaction ระดับ Serializable — ถ้าชนกัน Postgres จะยกเลิกฝั่งหนึ่ง (P2034)
// แล้วลองใหม่ ซึ่งรอบถัดไปจะเห็นว่ารอบเต็มแล้วและตอบ SLOT_FULL
async function serializable<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, attempts = 5): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (e) {
      const code = (e as { code?: string }).code
      if ((code === 'P2034' || code === 'P2002') && i < attempts - 1) continue
      if (code === 'P2034') throw new AppError(409, 'BUSY', 'ระบบกำลังยุ่ง กรุณาลองอีกครั้ง')
      throw e
    }
  }
}

const mine = (id: string, clientId: string) => ({ id, user: { clientId } })

async function findOwned(db: Prisma.TransactionClient | typeof prisma, id: string, clientId: string) {
  const b = await db.booking.findFirst({ where: mine(id, clientId) })
  if (!b) throw new AppError(404, 'BOOKING_NOT_FOUND', 'ไม่พบรายการจอง')
  return b
}

export async function createBooking(clientId: string, input: CreateBookingInput) {
  await settleBookings()
  const booking = await serializable(async (tx) => {
    const nowMs = Date.now()
    const settings = await readSettings(tx)
    if (!settings.shopOpen) throw new AppError(409, 'SHOP_CLOSED', 'ขณะนี้ร้านปิดรับจองคิว')
    const all = await tx.service.findMany({ where: { id: { in: input.serviceIds } } })
    const sel = resolveSelection(all, input, settings.callsEnabled)

    const day = await loadDaySlots(tx, input.date, { unlimited: sel.services.some((s) => s.unlimited), nowMs })
    assertSlotAvailable(day, input.time)

    const sameDay = await tx.booking.findMany({ where: { date: input.date }, select: { id: true } })
    const id = nextBookingId(sameDay.map((b) => b.id), input.date)

    const c = input.customer
    const user = await tx.user.upsert({
      where: { clientId },
      update: { nickname: c.nickname, fullName: c.fullName, age: c.age, relationship: c.relationship },
      create: { clientId, nickname: c.nickname, fullName: c.fullName, age: c.age, relationship: c.relationship },
    })

    return tx.booking.create({
      data: {
        id,
        userId: user.id,
        serviceIds: sel.services.map((s) => s.id),
        serviceName: sel.services.map((s) => s.name).join(', '),
        questionCount: sel.questionCount ?? null,
        otherQuestion: sel.otherQuestion ?? null,
        price: sel.price,
        date: input.date,
        time: input.time,
        note: input.note,
        nickname: c.nickname,
        fullName: c.fullName,
        age: c.age,
        relationship: c.relationship,
        isCall: sel.isCall,
        status: 'pending_payment',
        expiresAt: new Date(nowMs + PAYMENT_LIMIT_MS),
      },
    })
  })
  return toBookingDto(booking)
}

export async function listBookings(clientId: string) {
  await settleBookings()
  const rows = await prisma.booking.findMany({
    where: { user: { clientId } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return rows.map(toBookingDto)
}

export async function getBooking(clientId: string, id: string) {
  await settleBookings()
  return toBookingDto(await findOwned(prisma, id, clientId))
}

export async function updateBooking(clientId: string, id: string, patch: UpdateBookingInput) {
  await settleBookings()
  const updated = await serializable(async (tx) => {
    const cur = await findOwned(tx, id, clientId)
    const nowMs = Date.now()
    if (!isEditable({ status: cur.status, expiresAtMs: cur.expiresAt.getTime(), date: cur.date, time: cur.time }, nowMs)) {
      throw new AppError(409, 'NOT_EDITABLE', 'รายการนี้แก้ไขไม่ได้แล้ว')
    }

    const data: Prisma.BookingUpdateInput = {}
    if (patch.note !== undefined) data.note = patch.note
    if (patch.customer) {
      data.nickname = patch.customer.nickname
      data.fullName = patch.customer.fullName
      data.age = patch.customer.age
      data.relationship = patch.customer.relationship
    }
    if (patch.date && patch.time && (patch.date !== cur.date || patch.time !== cur.time)) {
      const services = await tx.service.findMany({ where: { id: { in: cur.serviceIds } } })
      const day = await loadDaySlots(tx, patch.date, {
        unlimited: services.some((s) => s.unlimited),
        nowMs,
        excludeBookingId: cur.id, // ไม่นับคิวของตัวเอง
      })
      assertSlotAvailable(day, patch.time)
      data.date = patch.date
      data.time = patch.time
      // ย้ายวันแล้ว เลขที่การจองยังคงเดิม (ใช้เป็นรหัสอ้างอิงตอนจอง)
    }
    return tx.booking.update({ where: { id: cur.id }, data })
  })
  return toBookingDto(updated)
}

export async function cancelBooking(clientId: string, id: string) {
  await settleBookings()
  const cur = await findOwned(prisma, id, clientId)
  if (cur.status === 'cancelled') return toBookingDto(cur) // ยกเลิกซ้ำได้ ผลเหมือนเดิม
  if (cur.status !== 'pending_payment' && cur.status !== 'confirmed') {
    throw new AppError(409, 'INVALID_STATUS', 'รายการนี้ยกเลิกไม่ได้แล้ว')
  }
  // เงื่อนไข status ใน where กันกรณีสถานะเปลี่ยนระหว่างนี้
  const r = await prisma.booking.updateMany({
    where: { id: cur.id, status: { in: ['pending_payment', 'confirmed'] } },
    data: { status: 'cancelled' },
  })
  if (r.count === 0) throw new AppError(409, 'INVALID_STATUS', 'รายการนี้ยกเลิกไม่ได้แล้ว')
  return toBookingDto(await findOwned(prisma, id, clientId))
}

// ชำระเงินจำลอง (เฉพาะตอนพัฒนา) — Phase 7 ตัดทิ้งและให้ Webhook ของ Payment Provider เป็นผู้ยืนยัน
export async function mockPay(clientId: string, id: string) {
  if (!config.allowMockPayment) throw new AppError(403, 'MOCK_PAYMENT_DISABLED', 'ปิดการชำระเงินจำลองแล้ว')
  await settleBookings()
  const cur = await findOwned(prisma, id, clientId)
  if (cur.status === 'confirmed') return toBookingDto(cur)
  if (cur.status !== 'pending_payment') throw new AppError(409, 'EXPIRED', 'รายการนี้หมดเวลาชำระเงินหรือถูกยกเลิกแล้ว')
  const r = await prisma.booking.updateMany({
    where: { id: cur.id, status: 'pending_payment', expiresAt: { gt: new Date() } },
    data: { status: 'confirmed' },
  })
  if (r.count === 0) throw new AppError(409, 'EXPIRED', 'รายการนี้หมดเวลาชำระเงินหรือถูกยกเลิกแล้ว')
  return toBookingDto(await findOwned(prisma, id, clientId))
}

// รอชำระเกินกำหนด → ยกเลิก (คืนรอบเวลา) / ยืนยันแล้วและเลยเวลานัด → เสร็จแล้ว
export async function settleBookings(): Promise<void> {
  const now = new Date()
  await prisma.booking.updateMany({
    where: { status: 'pending_payment', expiresAt: { lte: now } },
    data: { status: 'cancelled' },
  })
  const today = shopNow(now.getTime()).date
  const due = await prisma.booking.findMany({
    where: { status: 'confirmed', date: { lte: today } },
    select: { id: true, date: true, time: true, serviceIds: true },
  })
  if (due.length === 0) return
  const services = await prisma.service.findMany({ select: { id: true, durationMin: true, unlimited: true } })
  const finished = due
    .filter((b) => bookingEndMs(b.date, b.time, services.filter((s) => b.serviceIds.includes(s.id))) <= now.getTime())
    .map((b) => b.id)
  if (finished.length > 0) {
    await prisma.booking.updateMany({ where: { id: { in: finished }, status: 'confirmed' }, data: { status: 'completed' } })
  }
}
