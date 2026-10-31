import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server as HttpServer } from 'node:http'
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client'
import { prisma } from '../src/db'
import { hashPassword } from '../src/domain/password'
import { signToken } from '../src/domain/token'
import { config } from '../src/config'
import { initSocket } from '../src/socket'

const sockets: ClientSocket[] = []
const servers: HttpServer[] = []
const createdBookingIds: string[] = []
const createdUserIds: string[] = []
const createdAdminIds: string[] = []

let sequence = 0

const unique = (prefix: string) => `${prefix}-${Date.now()}-${++sequence}`

const waitForEvent = <T = unknown>(
  socket: ClientSocket,
  event: string,
  timeoutMs = 5000,
): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler)
      reject(new Error(`Timeout waiting for ${event}`))
    }, timeoutMs)

    const handler = (payload: T) => {
      clearTimeout(timer)
      socket.off(event, handler)
      resolve(payload)
    }

    socket.once(event, handler)
  })

const waitFor = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

async function startServer() {
  const server = createServer()
  initSocket(server)

  servers.push(server)

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address()
  assert.ok(address && typeof address === 'object')

  return `http://127.0.0.1:${address.port}`
}

async function connectSocket(
  url: string,
  auth: Record<string, string>,
) {
  const socket = connectClient(url, {
    transports: ['websocket'],
    auth,
    reconnection: false,
  })

  sockets.push(socket)

  await waitForEvent(socket, 'connect')

  return socket
}

async function makeUser() {
  const user = await prisma.user.create({
    data: {
      clientId: unique('presence-client'),
      nickname: 'Presence Test',
      fullName: 'Presence Test User',
      age: 21,
      relationship: 'single',
    },
  })

  createdUserIds.push(user.id)
  return user
}

async function makeAdmin() {
  const admin = await prisma.admin.create({
    data: {
      username: unique('presence-admin'),
      passwordHash: await hashPassword('presence-test-password'),
      displayName: 'Presence Test Admin',
    },
  })

  createdAdminIds.push(admin.id)

  return {
    admin,
    token: signToken(
      admin.id,
      config.adminTokenSecret,
      Date.now(),
      config.adminTokenTtlMs,
    ).token,
  }
}

async function makeBooking(userId: string) {
  const booking = await prisma.booking.create({
    data: {
      id: `WY-20991229-${String(sequence + 1).padStart(3, '0')}`,
      userId,
      serviceIds: ['presence-test-service'],
      serviceName: 'Presence Test Service',
      price: 99,
      date: '2099-12-29',
      time: '20:00',
      note: '',
      nickname: 'Presence Test',
      fullName: 'Presence Test User',
      age: 21,
      relationship: 'single',
      isCall: false,
      status: 'confirmed',
      expiresAt: new Date('2099-12-29T23:59:00.000Z'),
    },
  })

  createdBookingIds.push(booking.id)
  return booking
}

async function join(socket: ClientSocket, bookingId: string) {
  return new Promise<{ ok?: boolean; customerOnline?: boolean }>((resolve) => {
    socket.emit(
      'chat:join',
      { bookingId },
      resolve,
    )
  })
}

afterEach(async () => {
  for (const socket of sockets) {
    try {
      socket.disconnect()
    } catch {}
  }

  sockets.length = 0

  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve) => {
          if (!server.listening) return resolve()
          server.close(() => resolve())
        }),
    ),
  )

  servers.length = 0

  await prisma.message.deleteMany({
    where: { bookingId: { in: createdBookingIds } },
  })

  await prisma.callSession.deleteMany({
    where: { bookingId: { in: createdBookingIds } },
  })

  await prisma.booking.deleteMany({
    where: { id: { in: createdBookingIds } },
  })

  await prisma.admin.deleteMany({
    where: { id: { in: createdAdminIds } },
  })

  await prisma.user.deleteMany({
    where: { id: { in: createdUserIds } },
  })

  createdBookingIds.length = 0
  createdAdminIds.length = 0
  createdUserIds.length = 0
})

test('presence: customer sees admin online and offline', async () => {
  const user = await makeUser()
  const { token } = await makeAdmin()
  const url = await startServer()

  const customer = await connectSocket(url, {
    clientId: user.clientId,
  })

  // ไม่มี admin อยู่ตั้งแต่แรก จึงไม่ต้องรอ event initial false
  // เพราะ server อาจส่ง event ทันทีระหว่าง connection handshake
  const onlinePromise = waitForEvent<{ online: boolean }>(
    customer,
    'presence:admins',
  )

  const admin = await connectSocket(url, {
    adminToken: token,
  })

  const online = await onlinePromise

  assert.equal(online.online, true)

  const offlinePromise = waitForEvent<{ online: boolean }>(
    customer,
    'presence:admins',
  )

  admin.disconnect()

  const offline = await offlinePromise

  assert.equal(offline.online, false)
})

test('presence: admin sees customer online and offline in booking room', async () => {
  const user = await makeUser()
  const booking = await makeBooking(user.id)
  const { token } = await makeAdmin()
  const url = await startServer()

  const admin = await connectSocket(url, {
    adminToken: token,
  })

  const joinAdmin = await join(admin, booking.id)

  assert.equal(joinAdmin.ok, true)
  assert.equal(joinAdmin.customerOnline, false)

  const onlinePromise = waitForEvent<{
    bookingId: string
    online: boolean
  }>(admin, 'presence:customer')

  const customer = await connectSocket(url, {
    clientId: user.clientId,
  })

  const joinCustomer = await join(customer, booking.id)

  assert.equal(joinCustomer.ok, true)
  assert.equal(joinCustomer.customerOnline, true)

  const online = await onlinePromise

  assert.equal(online.bookingId, booking.id)
  assert.equal(online.online, true)

  const offlinePromise = waitForEvent<{
    bookingId: string
    online: boolean
  }>(admin, 'presence:customer')

  customer.disconnect()

  const offline = await offlinePromise

  assert.equal(offline.bookingId, booking.id)
  assert.equal(offline.online, false)
})

test('presence: multiple customer sockets stay online until the last socket disconnects', async () => {
  const user = await makeUser()
  const booking = await makeBooking(user.id)
  const { token } = await makeAdmin()
  const url = await startServer()

  const admin = await connectSocket(url, {
    adminToken: token,
  })

  assert.equal((await join(admin, booking.id)).ok, true)

  const customer1 = await connectSocket(url, {
    clientId: user.clientId,
  })

  assert.equal((await join(customer1, booking.id)).ok, true)

  const onlinePromise = waitForEvent<{
    bookingId: string
    online: boolean
  }>(admin, 'presence:customer')

  const customer2 = await connectSocket(url, {
    clientId: user.clientId,
  })

  assert.equal((await join(customer2, booking.id)).ok, true)

  const online = await onlinePromise
  assert.equal(online.online, true)

  customer1.disconnect()

  await waitFor(250)

  assert.equal(customer2.connected, true)

  const offlinePromise = waitForEvent<{
    bookingId: string
    online: boolean
  }>(admin, 'presence:customer')

  customer2.disconnect()

  const offline = await offlinePromise

  assert.equal(offline.bookingId, booking.id)
  assert.equal(offline.online, false)
})
