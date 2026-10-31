import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server as HttpServer } from 'node:http'
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client'
import { prisma } from '../src/db'
import { hashPassword } from '../src/domain/password'
import { config } from '../src/config'
import { initSocket } from '../src/socket'
import { signToken } from '../src/domain/token'

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

const startSocketServer = async () => {
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

  await waitForEvent(socket, 'connect')

  return socket
}

const makeUser = async () => {
  const user = await prisma.user.create({
    data: {
      clientId: unique('typing-client'),
      nickname: 'Typing Test',
      fullName: 'Typing Integration Test',
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
      username: unique('typing-admin'),
      passwordHash: await hashPassword('typing-test-password'),
      displayName: 'Typing Test Admin',
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
      id: `WY-20991230-${String(bookingSequence).padStart(3, '0')}`,
      userId,
      serviceIds: ['test-service'],
      serviceName: 'Typing Test Service',
      price: 99,
      date: '2099-12-30',
      time: '22:30',
      note: 'typing integration test',
      nickname: 'Typing Test',
      fullName: 'Typing Integration Test',
      age: 21,
      relationship: 'single',
      isCall: false,
      status: 'confirmed',
      expiresAt: new Date('2099-12-30T23:59:00.000Z'),
    },
  })

  createdBookingIds.push(booking.id)
  return booking
}

const joinBooking = async (
  socket: ClientSocket,
  bookingId: string,
) => {
  const result = await new Promise<{ ok?: boolean }>((resolve) => {
    socket.emit(
      'chat:join',
      { bookingId },
      resolve,
    )
  })

  assert.equal(result.ok, true)

  return result
}

afterEach(async () => {
  for (const socket of sockets) {
    socket.disconnect()
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

test('Typing: customer typing reaches admin in the same booking room', async () => {
  const user = await makeUser()
  const admin = await makeAdmin()
  const booking = await makeBooking(user.id)

  const url = await startSocketServer()

  const customer = await connect(url, {
    clientId: user.clientId,
  })

  const adminToken = signToken(
    admin.id,
    config.adminTokenSecret,
    Date.now(),
    config.adminTokenTtlMs,
  ).token

  const adminSocket = await connect(url, {
    adminToken,
  })

  await joinBooking(customer, booking.id)
  await joinBooking(adminSocket, booking.id)

  const typingPromise = waitForEvent<{
    bookingId: string
    role: string
    typing: boolean
  }>(adminSocket, 'chat:typing')

  customer.emit('chat:typing', {
    bookingId: booking.id,
    typing: true,
  })

  const payload = await typingPromise

  assert.equal(payload.bookingId, booking.id)
  assert.equal(payload.role, 'customer')
  assert.equal(payload.typing, true)

  void admin
})

test('Typing: admin typing reaches customer in the same booking room', async () => {
  const user = await makeUser()
  const admin = await makeAdmin()
  const booking = await makeBooking(user.id)

  const url = await startSocketServer()

  const customer = await connect(url, {
    clientId: user.clientId,
  })

  const adminSocket = await connect(url, {
    adminToken: signToken(
    admin.id,
    config.adminTokenSecret,
    Date.now(),
    config.adminTokenTtlMs,
  ).token,
  })

  await joinBooking(customer, booking.id)
  await joinBooking(adminSocket, booking.id)

  const typingPromise = waitForEvent<{
    bookingId: string
    role: string
    typing: boolean
  }>(customer, 'chat:typing')

  adminSocket.emit('chat:typing', {
    bookingId: booking.id,
    typing: true,
  })

  const payload = await typingPromise

  assert.equal(payload.bookingId, booking.id)
  assert.equal(payload.role, 'admin')
  assert.equal(payload.typing, true)
})

test('Typing: typing false reaches the peer', async () => {
  const user = await makeUser()
  const admin = await makeAdmin()
  const booking = await makeBooking(user.id)

  const url = await startSocketServer()

  const customer = await connect(url, {
    clientId: user.clientId,
  })

  const adminSocket = await connect(url, {
    adminToken: signToken(
    admin.id,
    config.adminTokenSecret,
    Date.now(),
    config.adminTokenTtlMs,
  ).token,
  })

  await joinBooking(customer, booking.id)
  await joinBooking(adminSocket, booking.id)

  const typingPromise = waitForEvent<{
    bookingId: string
    role: string
    typing: boolean
  }>(adminSocket, 'chat:typing')

  customer.emit('chat:typing', {
    bookingId: booking.id,
    typing: false,
  })

  const payload = await typingPromise

  assert.equal(payload.bookingId, booking.id)
  assert.equal(payload.role, 'customer')
  assert.equal(payload.typing, false)
})

test('Typing: customer cannot send typing to another customer booking', async () => {
  const userA = await makeUser()
  const userB = await makeUser()
  await makeAdmin()

  const bookingA = await makeBooking(userA.id)
  const bookingB = await makeBooking(userB.id)

  const url = await startSocketServer()

  const customerA = await connect(url, {
    clientId: userA.clientId,
  })

  const customerB = await connect(url, {
    clientId: userB.clientId,
  })

  await joinBooking(customerA, bookingA.id)
  await joinBooking(customerB, bookingB.id)

  let received = false

  customerB.on('chat:typing', () => {
    received = true
  })

  customerA.emit('chat:typing', {
    bookingId: bookingB.id,
    typing: true,
  })

  await new Promise((resolve) => setTimeout(resolve, 700))

  assert.equal(received, false)
})
