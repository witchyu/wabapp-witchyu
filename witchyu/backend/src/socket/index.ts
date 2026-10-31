import type { Server as HttpServer } from 'node:http'
import { Server, type Socket } from 'socket.io'
import { config } from '../config'
import { prisma } from '../db'
import { verifyToken } from '../domain/token'
import { LoginLimiter as RateLimiter } from '../domain/loginLimiter'
import { parseBookingIdParam } from '../domain/chat'
import { ADMINS_ROOM, bookingRoom, callRoom, setIo, userRoom } from './realtime'
import { loadBookingFor, markRead, type Viewer } from '../services/chatService'

interface SocketData {
  role: 'customer' | 'admin'
  clientId?: string
  adminId?: string
  rooms: Set<string> // ห้องแชตที่ผ่านการตรวจสิทธิ์แล้ว
  callRooms: Set<string> // ห้องโทรที่ผ่านการตรวจสิทธิ์แล้ว
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
    maxHttpBufferSize: 1_000_000, // รองรับข้อความยาว โดยจำกัดขนาดข้อมูลต่อ packet ไว้ 1 MB
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
      const auth = (socket.handshake.auth ?? {}) as {
        clientId?: unknown
        adminToken?: unknown
        customerToken?: unknown
      }
      const data: SocketData = { role: 'customer', rooms: new Set(), callRooms: new Set() }

      if (typeof auth.adminToken === 'string' && auth.adminToken) {
        const payload = verifyToken(auth.adminToken, config.adminTokenSecret, Date.now())
        const admin = payload ? await prisma.admin.findUnique({ where: { id: payload.sub }, select: { id: true } }) : null
        if (!admin) return next(new Error('UNAUTHORIZED'))
        data.role = 'admin'
        data.adminId = admin.id
      } else if (typeof auth.customerToken === 'string' && auth.customerToken) {
        const payload = verifyToken(auth.customerToken, config.customerTokenSecret, Date.now())
        const user = payload ? await prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, clientId: true, email: true, passwordHash: true },
        }) : null

        if (!user || !user.email || !user.passwordHash) {
          return next(new Error('UNAUTHORIZED'))
        }

        data.clientId = user.clientId
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
      } catch (error) {

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


    // Voice signaling: ตรวจสิทธิ์ Booking ก่อนเข้าห้องโทรทุกครั้ง
    socket.on('call:join', async (payload: { bookingId?: unknown } | undefined, cb?: unknown) => {
      try {
        const bookingId = parseBookingIdParam(payload?.bookingId)
        await loadBookingFor(viewerOf(socket), bookingId)
        await socket.join(callRoom(bookingId))
        socket.data.callRooms.add(bookingId)
        ack(cb, { ok: true, bookingId })
      } catch {
        fail(cb, 'FORBIDDEN', 'เข้าห้องโทรนี้ไม่ได้')
      }
    })

    // Phase 6: Admin announces readiness after the client listeners are mounted.
    socket.on('call:ready', (
      payload: { bookingId?: unknown } | undefined,
      cb?: unknown,
    ) => {
      try {
        if (socket.data.role !== 'admin') {
          return fail(cb, 'FORBIDDEN', 'เฉพาะแอดมินส่งสัญญาณพร้อมรับสายได้')
        }
        const bookingId = parseBookingIdParam(payload?.bookingId)
        if (!socket.data.callRooms.has(bookingId)) {
          return fail(cb, 'NOT_JOINED', 'ต้องเข้าห้องโทรก่อน')
        }
        socket.to(callRoom(bookingId)).emit('call:ready', {
          bookingId,
          fromRole: 'admin',
        })
        ack(cb, { ok: true, bookingId })
      } catch {
        fail(cb, 'ERROR', 'ส่งสัญญาณพร้อมรับสายไม่สำเร็จ')
      }
    })
    // Phase 6C: ลูกค้าเริ่มโทรและแจ้งสายเรียกเข้าให้แอดมิน
    socket.on('call:start', async (
      payload: { bookingId?: unknown } | undefined,
      cb?: unknown,
    ) => {
      try {
        if (socket.data.role !== 'customer') {
          return fail(cb, 'FORBIDDEN', 'เฉพาะลูกค้าที่เริ่มโทรได้')
        }

        const bookingId = parseBookingIdParam(payload?.bookingId)
        const booking = await loadBookingFor(viewerOf(socket), bookingId)

        if (booking.status !== 'confirmed') {
          return fail(cb, 'BOOKING_NOT_CONFIRMED', 'รายการจองยังไม่พร้อมสำหรับการโทร')
        }
        if (!socket.data.callRooms.has(bookingId)) {
          return fail(cb, 'NOT_JOINED', 'กรุณาเข้าห้องโทรก่อนเริ่มโทร')
        }

        io.to(ADMINS_ROOM).emit('call:incoming', {
          bookingId,
          fromRole: 'customer',
          status: 'ringing',
          createdAt: new Date().toISOString(),
        })

        ack(cb, { ok: true, bookingId, status: 'ringing' })
      } catch {
        fail(cb, 'FORBIDDEN', 'ไม่สามารถเริ่มโทรด้วยรายการจองนี้ได้')
      }
    })

    // Phase 6C: แอดมินรับสายและเข้าห้องโทร
    socket.on('call:accept', async (
      payload: { bookingId?: unknown } | undefined,
      cb?: unknown,
    ) => {
      try {
        if (socket.data.role !== 'admin') {
          return fail(cb, 'FORBIDDEN', 'เฉพาะแอดมินรับสายได้')
        }

        const bookingId = parseBookingIdParam(payload?.bookingId)
        const booking = await loadBookingFor(viewerOf(socket), bookingId)
        if (booking.status !== 'confirmed') {
          return fail(cb, 'BOOKING_NOT_CONFIRMED', 'รายการจองยังไม่พร้อมสำหรับการโทร')
        }

        await socket.join(callRoom(bookingId))
        socket.data.callRooms.add(bookingId)
        io.to(callRoom(bookingId)).emit('call:accepted', {
          bookingId,
          fromRole: 'admin',
          status: 'accepted',
          createdAt: new Date().toISOString(),
        })
        ack(cb, { ok: true, bookingId, status: 'accepted' })
      } catch {
        fail(cb, 'FORBIDDEN', 'ไม่สามารถรับสายของรายการจองนี้ได้')
      }
    })

    // Phase 6C: แอดมินปฏิเสธสาย
    socket.on('call:reject', async (
      payload: { bookingId?: unknown } | undefined,
      cb?: unknown,
    ) => {
      try {
        if (socket.data.role !== 'admin') {
          return fail(cb, 'FORBIDDEN', 'เฉพาะแอดมินปฏิเสธสายได้')
        }

        const bookingId = parseBookingIdParam(payload?.bookingId)
        const booking = await loadBookingFor(viewerOf(socket), bookingId)
        if (booking.status !== 'confirmed') {
          return fail(cb, 'BOOKING_NOT_CONFIRMED', 'รายการจองนี้ไม่พร้อมสำหรับการโทร')
        }

        io.to(callRoom(bookingId)).emit('call:rejected', {
          bookingId,
          fromRole: 'admin',
          reason: 'rejected',
          createdAt: new Date().toISOString(),
        })
        ack(cb, { ok: true, bookingId, status: 'rejected' })
      } catch {
        fail(cb, 'FORBIDDEN', 'ไม่สามารถปฏิเสธสายของรายการจองนี้ได้')
      }
    })

    socket.on('call:leave', async (payload: { bookingId?: unknown } | undefined, cb?: unknown) => {
      try {
        const bookingId = parseBookingIdParam(payload?.bookingId)
        if (!socket.data.callRooms.has(bookingId)) {
          return fail(cb, 'NOT_JOINED', 'ยังไม่ได้เข้าห้องโทร')
        }
        await socket.leave(callRoom(bookingId))
        socket.data.callRooms.delete(bookingId)
        ack(cb, { ok: true })
      } catch {
        fail(cb, 'ERROR', 'ออกจากห้องโทรไม่สำเร็จ')
      }
    })

    const relayDescription = (
      eventName: 'call:offer' | 'call:answer',
      expectedType: 'offer' | 'answer',
    ) => {
      socket.on(eventName, (
        payload: { bookingId?: unknown; description?: unknown } | undefined,
        cb?: unknown,
      ) => {
        try {
          const bookingId = parseBookingIdParam(payload?.bookingId)
          const description = payload?.description as { type?: unknown; sdp?: unknown } | undefined

          if (!socket.data.callRooms.has(bookingId)) {
            return fail(cb, 'NOT_JOINED', 'ยังไม่ได้เข้าห้องโทร')
          }
          if (
            !description ||
            description.type !== expectedType ||
            typeof description.sdp !== 'string' ||
            description.sdp.length === 0 ||
            description.sdp.length > 10_000
          ) {
            return fail(cb, 'INVALID_DESCRIPTION', 'ข้อมูลสัญญาณโทรไม่ถูกต้อง')
          }

          socket.to(callRoom(bookingId)).emit(eventName, {
            bookingId,
            fromRole: socket.data.role,
            description: { type: expectedType, sdp: description.sdp },
          })
          ack(cb, { ok: true })
        } catch {
          fail(cb, 'ERROR', 'ส่งสัญญาณโทรไม่สำเร็จ')
        }
      })
    }

    relayDescription('call:offer', 'offer')
    relayDescription('call:answer', 'answer')

    socket.on('call:ice-candidate', (
      payload: { bookingId?: unknown; candidate?: unknown } | undefined,
      cb?: unknown,
    ) => {
      try {
        const bookingId = parseBookingIdParam(payload?.bookingId)
        const candidate = payload?.candidate as {
          candidate?: unknown
          sdpMid?: unknown
          sdpMLineIndex?: unknown
          usernameFragment?: unknown
        } | undefined

        if (!socket.data.callRooms.has(bookingId)) {
          return fail(cb, 'NOT_JOINED', 'ยังไม่ได้เข้าห้องโทร')
        }
        if (
          !candidate ||
          typeof candidate.candidate !== 'string' ||
          candidate.candidate.length === 0 ||
          candidate.candidate.length > 4096 ||
          !(candidate.sdpMid === null || typeof candidate.sdpMid === 'string') ||
          (typeof candidate.sdpMid === 'string' && candidate.sdpMid.length > 256) ||
          !(candidate.sdpMLineIndex === null ||
            (Number.isInteger(candidate.sdpMLineIndex) &&
              (candidate.sdpMLineIndex as number) >= 0 &&
              (candidate.sdpMLineIndex as number) <= 65535)) ||
          (candidate.usernameFragment !== undefined &&
            candidate.usernameFragment !== null &&
            (typeof candidate.usernameFragment !== 'string' ||
              candidate.usernameFragment.length > 256))
        ) {
          return fail(cb, 'INVALID_CANDIDATE', 'ICE Candidate ไม่ถูกต้อง')
        }

        socket.to(callRoom(bookingId)).emit('call:ice-candidate', {
          bookingId,
          fromRole: socket.data.role,
          candidate: {
            candidate: candidate.candidate,
            sdpMid: candidate.sdpMid,
            sdpMLineIndex: candidate.sdpMLineIndex,
            ...(typeof candidate.usernameFragment === 'string'
              ? { usernameFragment: candidate.usernameFragment }
              : {}),
          },
        })
        ack(cb, { ok: true })
      } catch {
        fail(cb, 'ERROR', 'ส่ง ICE Candidate ไม่สำเร็จ')
      }
    })

    socket.on('call:hangup', async (
      payload: { bookingId?: unknown; reason?: unknown } | undefined,
      cb?: unknown,
    ) => {
      try {
        const bookingId = parseBookingIdParam(payload?.bookingId)
        if (!socket.data.callRooms.has(bookingId)) {
          return fail(cb, 'NOT_JOINED', 'ยังไม่ได้เข้าห้องโทร')
        }

        const allowedReasons = ['hangup', 'rejected', 'failed', 'cancelled']
        const reason = typeof payload?.reason === 'string' &&
          allowedReasons.includes(payload.reason)
          ? payload.reason
          : 'hangup'

        socket.to(callRoom(bookingId)).emit('call:hangup', {
          bookingId,
          fromRole: socket.data.role,
          reason,
        })
        await socket.leave(callRoom(bookingId))
        socket.data.callRooms.delete(bookingId)
        ack(cb, { ok: true })
      } catch {
        fail(cb, 'ERROR', 'แจ้งวางสายไม่สำเร็จ')
      }
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
