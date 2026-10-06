import type { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { toBookingDto } from '../domain/dto'
import { AppError } from '../domain/errors'
import { LoginLimiter as RateLimiter } from '../domain/loginLimiter'
import {
  type ChatRole, canSend, cannotSendReason, encodeCursor, peerOf, toMessageDto,
} from '../domain/chat'
import { emitMessageNew, emitMessageRead } from '../socket/realtime'

export type Viewer = { role: 'customer'; clientId: string; userId?: string } | { role: 'admin'; adminId: string }

// ส่งข้อความได้สูงสุด 20 ข้อความต่อนาทีต่อห้องต่อฝั่ง (กันสแปม)
const sendLimiter = new RateLimiter(20, 60_000)

// โหลดการจองพร้อมตรวจสิทธิ์: ลูกค้าเข้าได้เฉพาะของตัวเอง แอดมินเข้าได้ทุกรายการ
export async function loadBookingFor(viewer: Viewer, bookingId: string) {
  const booking = await prisma.booking.findFirst({
    where: viewer.role === 'customer' ? { id: bookingId, user: { clientId: viewer.clientId } } : { id: bookingId },
    include: { user: { select: { clientId: true } } },
  })
  if (!booking) throw new AppError(404, 'BOOKING_NOT_FOUND', 'ไม่พบรายการจอง')
  return booking
}

export async function listMessages(viewer: Viewer, bookingId: string, q: { limit: number; before?: { ms: number; id: string } }) {
  const booking = await loadBookingFor(viewer, bookingId)
  const where: Prisma.MessageWhereInput = { bookingId }
  if (q.before) {
    const at = new Date(q.before.ms)
    where.OR = [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: q.before.id } }]
  }
  const rows = await prisma.message.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: q.limit + 1,
  })
  const hasMore = rows.length > q.limit
  const messages = rows.slice(0, q.limit).reverse().map(toMessageDto)
  const first = messages[0]
  return {
    booking: toBookingDto(booking),
    messages,
    hasMore,
    nextBefore: hasMore && first ? encodeCursor(first.createdAt, first.id) : undefined,
    canSend: canSend(viewer.role, booking.status),
    cannotSendReason: canSend(viewer.role, booking.status) ? undefined : cannotSendReason(viewer.role, booking.status),
  }
}

export async function sendMessage(viewer: Viewer, bookingId: string, body: string, clientMsgId?: string) {
  const booking = await loadBookingFor(viewer, bookingId)
  if (!canSend(viewer.role, booking.status)) {
    throw new AppError(403, 'CHAT_DISABLED', cannotSendReason(viewer.role, booking.status))
  }

  // ส่งซ้ำด้วยรหัสเดิม (เช่น เน็ตหลุดแล้วกดส่งใหม่) → ได้ข้อความเดิม ไม่สร้างซ้ำ
  if (clientMsgId) {
    const existing = await prisma.message.findUnique({ where: { bookingId_clientMsgId: { bookingId, clientMsgId } } })
    if (existing) return toMessageDto(existing)
  }

  const key = `${bookingId}:${viewer.role}`
  const now = Date.now()
  const wait = sendLimiter.retryAfterSec(key, now)
  if (wait > 0) throw new AppError(429, 'RATE_LIMITED', 'ส่งข้อความถี่เกินไป กรุณารอสักครู่')
  sendLimiter.fail(key, now) // ในที่นี้ "fail" = บันทึกการส่ง 1 ครั้งลงในหน้าต่างเวลา

  let row
  try {
    row = await prisma.message.create({
      data: {
        bookingId,
        senderRole: viewer.role,
        userId: viewer.role === 'customer' ? booking.userId : null,
        adminId: viewer.role === 'admin' ? viewer.adminId : null,
        body,
        clientMsgId: clientMsgId ?? null,
      },
    })
  } catch (e) {
    // ส่งซ้ำพร้อมกันสองครั้ง → อีกครั้งสร้างสำเร็จไปก่อนแล้ว
    if ((e as { code?: string })?.code === 'P2002' && clientMsgId) {
      const existing = await prisma.message.findUnique({ where: { bookingId_clientMsgId: { bookingId, clientMsgId } } })
      if (existing) return toMessageDto(existing)
    }
    throw e
  }
  const dto = toMessageDto(row)
  emitMessageNew(bookingId, booking.user.clientId, dto)
  return dto
}

// ทำเครื่องหมาย "อ่านแล้ว" ข้อความของอีกฝ่ายทั้งหมดในห้องนี้
export async function markRead(viewer: Viewer, bookingId: string): Promise<number> {
  const booking = await loadBookingFor(viewer, bookingId)
  const readAt = new Date()
  const r = await prisma.message.updateMany({
    where: { bookingId, senderRole: peerOf(viewer.role), readAt: null },
    data: { readAt },
  })
  if (r.count > 0) {
    emitMessageRead(bookingId, booking.user.clientId, { bookingId, readerRole: viewer.role, readAt: readAt.getTime() })
  }
  return r.count
}

async function unreadByBooking(ids: string[], fromRole: ChatRole): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map()
  const rows = await prisma.message.groupBy({
    by: ['bookingId'],
    where: { bookingId: { in: ids }, senderRole: fromRole, readAt: null },
    _count: { _all: true },
  })
  return new Map(rows.map((r) => [r.bookingId, r._count._all]))
}

type ThreadBooking = Prisma.BookingGetPayload<{ include: { messages: true } }>

function toThreads(role: ChatRole, bookings: ThreadBooking[], unread: Map<string, number>) {
  const threads = bookings.map((b) => ({
    booking: toBookingDto(b),
    lastMessage: b.messages[0] ? toMessageDto(b.messages[0]) : null,
    unread: unread.get(b.id) ?? 0,
    canSend: canSend(role, b.status),
  }))
  // ล่าสุดอยู่บน (ถ้ายังไม่มีข้อความ ใช้วันนัด)
  const stamp = (t: (typeof threads)[number]) => t.lastMessage?.createdAt ?? 0
  return threads.sort((a, b) => stamp(b) - stamp(a) || b.booking.date.localeCompare(a.booking.date))
}

const lastMessage = { messages: { orderBy: { createdAt: 'desc' as const }, take: 1 } }

// ลูกค้า: รายการที่ชำระแล้ว (แชตได้) พร้อมข้อความล่าสุดและจำนวนที่ยังไม่อ่าน
export async function customerThreads(clientId: string) {
  const bookings = await prisma.booking.findMany({
    where: { user: { clientId }, status: { in: ['confirmed', 'completed'] } },
    include: lastMessage,
    orderBy: [{ date: 'desc' }, { time: 'desc' }],
    take: 100,
  })
  return toThreads('customer', bookings, await unreadByBooking(bookings.map((b) => b.id), 'admin'))
}

// แอดมิน: เฉพาะการจองที่เคยมีการคุยกันแล้ว
export async function adminThreads() {
  const bookings = await prisma.booking.findMany({
    where: { messages: { some: {} } },
    include: lastMessage,
    take: 500, // ร้านขนาดเล็กพอ — ถ้าบทสนทนาเกินนี้ค่อยทำแบ่งหน้า
  })
  return toThreads('admin', bookings, await unreadByBooking(bookings.map((b) => b.id), 'customer'))
}

export async function customerUnread(clientId: string): Promise<number> {
  return prisma.message.count({ where: { senderRole: 'admin', readAt: null, booking: { user: { clientId } } } })
}
export async function adminUnread(): Promise<number> {
  return prisma.message.count({ where: { senderRole: 'customer', readAt: null } })
}
