import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server as HttpServer } from 'node:http'
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client'
import { prisma } from '../src/db'
import { hashPassword } from '../src/domain/password'
import { signToken } from '../src/domain/token'
import { config } from '../src/config'
import { initSocket } from '../src/socket'
import { markRead, sendMessage, type Viewer } from '../src/services/chatService'

const createdBookingIds: string[] = []
const createdUserIds: string[] = []
const createdAdminIds: string[] = []
const sockets: ClientSocket[] = []
const servers: HttpServer[] = []

const unique = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const waitForEvent = <T>(
  socket: ClientSocket,
  event: string,
  timeoutMs = 5000,
): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent)
      reject(new Error(`Timeout waiting for ${event}`))
    }, timeoutMs)

    const onEvent = (payload: T) => {
      clearTimeout(timer)
      socket.off(event, onEvent)
      resolve(payload)
    }

    socket.once(event, onEvent)
  })

const waitForConnect = (socket: ClientSocket) =>
  waitForEvent<void>(socket, 'connect')

const makeUser = async () => {
  const user = await prisma.user.create({
    data: {
      clientId: unique('read-client'),
      nickname: 'Read Test',
      fullName: 'Read Status Integration Test',
      age: 21,
      relationship: 'single',
    },
  })

  createdUserIds.push(user.id)
  return user
}

const makeAdmin = async () => {
  const admin = await prisma.admin.create({
    data: {
      username: unique('read-admin'),
      passwordHash: await hashPassword('read-test-password'),
      displayName: 'Read Test Admin',
    },
  })

  createdAdminIds.push(admin.id)
  return admin
}

let bookingSequence = 0

const makeBooking = async (userId: string) => {
  bookingSequence += 1

  const booking = await prisma.booking.create({
    data: {
      id: `WY-20991231-${String(bookingSequence).padStart(3, '0')}`,
      userId,
      serviceIds: ['read-test-service'],
      serviceName: 'Read Status Test',
      price: 99,
      date: '2099-12-31',
      time: '22:30',
      note: 'read status test',
      nickname: 'Read Test',
      fullName: 'Read Status Integration Test',
      age: 21,
      relationship: 'single',
      isCall: false,
      status: 'confirmed',
      expiresAt: new Date('2099-12-31T23:59:00.000Z'),
    },
  })

  createdBookingIds.push(booking.id)
  return booking
}

const startServer = async () => {
  const server = createServer()
  initSocket(server)
  servers.push(server)

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address()
  assert.ok(address && typeof address === 'object')

  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
  }
}

const connect = async (
  url: string,
  auth: Record<string, string>,
) => {
  const socket = connectClient(url, {
    transports: ['websocket'],
    auth,
    reconnection: false,
  })

  sockets.push(socket)

  await waitForConnect(socket)

  return socket
}

afterEach(async () => {
  for (const socket of sockets) {
    if (socket.connected) socket.disconnect()
  }
  sockets.length = 0

  for (const server of servers) {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
  servers.length = 0

  if (createdBookingIds.length) {
    await prisma.message.deleteMany({
      where: { bookingId: { in: createdBookingIds } },
    })

    await prisma.callSession.deleteMany({
      where: { bookingId: { in: createdBookingIds } },
    })

    await prisma.booking.deleteMany({
      where: { id: { in: createdBookingIds } },
    })

    createdBookingIds.length = 0
  }

  if (createdUserIds.length) {
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    })

    createdUserIds.length = 0
  }

  if (createdAdminIds.length) {
    await prisma.admin.deleteMany({
      where: { id: { in: createdAdminIds } },
    })

    createdAdminIds.length = 0
  }
})

test('Read Status: customer reads admin message and admin receives message:read', async () => {
  const user = await makeUser()
  const admin = await makeAdmin()
  const booking = await makeBooking(user.id)

  const adminToken = signToken(
    admin.id,
    config.adminTokenSecret,
    Date.now(),
    config.adminTokenTtlMs,
  ).token

  const { url } = await startServer()

  const customer = await connect(url, {
    clientId: user.clientId,
  })

  const adminSocket = await connect(url, {
    adminToken,
  })

  const customerJoin = await new Promise<{ ok?: boolean }>((resolve) => {
    customer.emit('chat:join', { bookingId: booking.id }, resolve)
  })

  const adminJoin = await new Promise<{ ok?: boolean }>((resolve) => {
    adminSocket.emit('chat:join', { bookingId: booking.id }, resolve)
  })

  assert.equal(customerJoin.ok, true)
  assert.equal(adminJoin.ok, true)

  const message = await sendMessage(
    {
      role: 'admin',
      adminId: admin.id,
    } satisfies Viewer,
    booking.id,
    'อ่านข้อความนี้',
    unique('read-admin-message'),
  )

  assert.equal(message.readAt, null)

  const readPromise = waitForEvent<{
    bookingId: string
    readerRole: string
    readAt: number
  }>(adminSocket, 'message:read')

  customer.emit('chat:read', {
    bookingId: booking.id,
  })

  const event = await readPromise

  assert.equal(event.bookingId, booking.id)
  assert.equal(event.readerRole, 'customer')
  assert.ok(event.readAt > 0)

  const stored = await prisma.message.findUnique({
    where: { id: message.id },
  })

  assert.ok(stored?.readAt)
})

test('Read Status: admin reads customer message and customer receives message:read', async () => {
  const user = await makeUser()
  const admin = await makeAdmin()
  const booking = await makeBooking(user.id)

  const adminToken = signToken(
    admin.id,
    config.adminTokenSecret,
    Date.now(),
    config.adminTokenTtlMs,
  ).token

  const { url } = await startServer()

  const customer = await connect(url, {
    clientId: user.clientId,
  })

  const adminSocket = await connect(url, {
    adminToken,
  })

  await new Promise<{ ok?: boolean }>((resolve) => {
    customer.emit('chat:join', { bookingId: booking.id }, resolve)
  })

  await new Promise<{ ok?: boolean }>((resolve) => {
    adminSocket.emit('chat:join', { bookingId: booking.id }, resolve)
  })

  const message = await sendMessage(
    {
      role: 'customer',
      clientId: user.clientId,
    } satisfies Viewer,
    booking.id,
    'ข้อความจากลูกค้า',
    unique('read-customer-message'),
  )

  const readPromise = waitForEvent<{
    bookingId: string
    readerRole: string
    readAt: number
  }>(customer, 'message:read')

  adminSocket.emit('chat:read', {
    bookingId: booking.id,
  })

  const event = await readPromise

  assert.equal(event.bookingId, booking.id)
  assert.equal(event.readerRole, 'admin')
  assert.ok(event.readAt > 0)

  const stored = await prisma.message.findUnique({
    where: { id: message.id },
  })

  assert.ok(stored?.readAt)
})

test('Read Status: own messages are never marked as read', async () => {
  const user = await makeUser()
  const booking = await makeBooking(user.id)

  const viewer: Viewer = {
    role: 'customer',
    clientId: user.clientId,
  }

  const message = await sendMessage(
    viewer,
    booking.id,
    'ข้อความของตัวเอง',
    unique('read-own-message'),
  )

  const count = await markRead(viewer, booking.id)

  assert.equal(count, 0)

  const stored = await prisma.message.findUnique({
    where: { id: message.id },
  })

  assert.equal(stored?.readAt, null)
})

test('Read Status: repeated read is idempotent', async () => {
  const user = await makeUser()
  const admin = await makeAdmin()
  const booking = await makeBooking(user.id)

  const adminViewer: Viewer = {
    role: 'admin',
    adminId: admin.id,
  }

  const customerViewer: Viewer = {
    role: 'customer',
    clientId: user.clientId,
  }

  await sendMessage(
    adminViewer,
    booking.id,
    'อ่านข้อความซ้ำ',
    unique('read-repeat-message'),
  )

  const first = await markRead(customerViewer, booking.id)
  const second = await markRead(customerViewer, booking.id)

  assert.equal(first, 1)
  assert.equal(second, 0)
})
