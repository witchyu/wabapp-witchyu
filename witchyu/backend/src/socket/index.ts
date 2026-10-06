import type { Server as HttpServer } from 'node:http'
import { Server, type Socket } from 'socket.io'
import { config } from '../config'
import { prisma } from '../db'
import { verifyToken } from '../domain/token'
import { LoginLimiter as RateLimiter } from '../domain/loginLimiter'
import { parseBookingIdParam } from '../domain/chat'
import { ADMINS_ROOM, bookingRoom, setIo, userRoom } from './realtime'
import { loadBookingFor, markRead, type Viewer } from '../services/chatService'

interface SocketData {
  role: 'customer' | 'admin'
  clientId?: string
  adminId?: string
  rooms: Set<string> // การจองที่ socket นี้เข้าร่วม (ผ่าน chat:join ที่ตรวจสิทธิ์แล้ว)
}
type S = Socket & { data: SocketData }

const viewerOf = (s: S): Viewer =>
  s.data.role === 'admin' ? { role: 'admin', adminId: s.data.adminId as string } : { role: 'customer', clientId: s.data.clientId as string }

// "กำลังพิมพ์" ส่งได้ไม่เกิน 30 ครั้งต่อ 10 วินาทีต่อ socket
const typingLimiter = new RateLimiter(30, 10_000)

type Ack = (res: unknown) => void
const ack = (cb: unknown, res: unknown) => { if (typeof cb === 'function') (cb as Ack)(res) }
const fail = (cb: unknown, code: string, message: string) => ack(cb, { ok: false, code, message })

export function initSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin(origin, cb) {
        if (!origin || config.corsOrigins.includes(origin)) return cb(null, true)
        return cb(null, false)
      },
    },
    maxHttpBufferSize: 10_000, // ข้อความ 1,000 ตัวอักษรพอ — กันส่งก้อนใหญ่
    pingInterval: 20_000,
    pingTimeout: 20_000,
  })
  setIo(io)

  const adminsOnline = async () => (await io.in(ADMINS_ROOM).fetchSockets()).length > 0
  // excludeId: ตอนตัดการเชื่อมต่อ ไม่นับ socket ที่กำลังหลุดอยู่ (กันสถานะ "ออนไลน์" ค้าง)
  const customerOnline = async (bookingId: string, excludeId?: string) =>
    (await io.in(bookingRoom(bookingId)).fetchSockets()).some((s) => s.id !== excludeId && (s.data as SocketData).role === 'customer')
  const broadcastCustomerPresence = async (bookingId: string, excludeId?: string) => {
    io.to(bookingRoom(bookingId)).emit('presence:customer', { bookingId, online: await customerOnline(bookingId, excludeId) })
  }

  // ยืนยันตัวตนตอนเชื่อมต่อ: แอดมินส่งโทเคน / ลูกค้าส่งรหัสอุปกรณ์
  io.use(async (socket, next) => {
    try {
      const auth = (socket.handshake.auth ?? {}) as { clientId?: unknown; adminToken?: unknown }
      const data: SocketData = { role: 'customer', rooms: new Set() }
      if (typeof auth.adminToken === 'string' && auth.adminToken) {
        const payload = verifyToken(auth.adminToken, config.adminTokenSecret, Date.now())
        const admin = payload ? await prisma.admin.findUnique({ where: { id: payload.sub }, select: { id: true } }) : null
        if (!admin) return next(new Error('UNAUTHORIZED'))
        data.role = 'admin'
        data.adminId = admin.id
      } else if (typeof auth.clientId === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(auth.clientId)) {
        data.clientId = auth.clientId
      } else {
        return next(new Error('UNAUTHORIZED'))
      }
      Object.assign(socket.data, data)
      next()
    } catch {
      next(new Error('UNAUTHORIZED'))
    }
  })

  io.on('connection', async (raw) => {
    const socket = raw as S

    if (socket.data.role === 'admin') {
      await socket.join(ADMINS_ROOM)
      io.emit('presence:admins', { online: true })
    } else {
      await socket.join(userRoom(socket.data.clientId as string))
      socket.emit('presence:admins', { online: await adminsOnline() })
    }

    // เข้าห้องสนทนาของการจอง (ตรวจสิทธิ์ทุกครั้ง)
    socket.on('chat:join', async (payload: { bookingId?: unknown } | undefined, cb?: unknown) => {
      try {
        const bookingId = parseBookingIdParam(payload?.bookingId)
        await loadBookingFor(viewerOf(socket), bookingId)
        await socket.join(bookingRoom(bookingId))
        socket.data.rooms.add(bookingId)
        if (socket.data.role === 'customer') await broadcastCustomerPresence(bookingId)
        ack(cb, { ok: true, adminsOnline: await adminsOnline(), customerOnline: await customerOnline(bookingId) })
      } catch {
        fail(cb, 'FORBIDDEN', 'เข้าห้องแชตนี้ไม่ได้')
      }
    })

    socket.on('chat:leave', async (payload: { bookingId?: unknown } | undefined) => {
      try {
        const bookingId = parseBookingIdParam(payload?.bookingId)
        await socket.leave(bookingRoom(bookingId))
        socket.data.rooms.delete(bookingId)
        if (socket.data.role === 'customer') await broadcastCustomerPresence(bookingId)
      } catch { /* ไม่ต้องทำอะไร */ }
    })

    socket.on('chat:read', async (payload: { bookingId?: unknown } | undefined, cb?: unknown) => {
      try {
        const bookingId = parseBookingIdParam(payload?.bookingId)
        if (!socket.data.rooms.has(bookingId)) return fail(cb, 'NOT_JOINED', 'ยังไม่ได้เข้าห้องแชต')
        ack(cb, { ok: true, count: await markRead(viewerOf(socket), bookingId) })
      } catch {
        fail(cb, 'ERROR', 'ทำเครื่องหมายอ่านแล้วไม่สำเร็จ')
      }
    })

    socket.on('chat:typing', (payload: { bookingId?: unknown; typing?: unknown } | undefined) => {
      try {
        const bookingId = parseBookingIdParam(payload?.bookingId)
        if (!socket.data.rooms.has(bookingId) || typeof payload?.typing !== 'boolean') return
        const now = Date.now()
        if (typingLimiter.retryAfterSec(socket.id, now) > 0) return
        typingLimiter.fail(socket.id, now)
        socket.to(bookingRoom(bookingId)).emit('chat:typing', { bookingId, role: socket.data.role, typing: payload.typing })
      } catch { /* เมินข้อมูลผิดรูปแบบ */ }
    })

    socket.on('disconnect', async () => {
      typingLimiter.reset(socket.id)
      try {
        if (socket.data.role === 'admin') {
          io.emit('presence:admins', { online: await adminsOnline() })
        } else {
          for (const bookingId of socket.data.rooms) await broadcastCustomerPresence(bookingId, socket.id)
        }
      } catch { /* ไม่ให้ error ตอนตัดการเชื่อมต่อทำให้เซิร์ฟเวอร์ล้ม */ }
    })
  })

  return io
}
