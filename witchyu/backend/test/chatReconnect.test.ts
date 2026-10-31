import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server as HttpServer } from 'node:http'
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client'
import { prisma } from '../src/db'
import { hashPassword } from '../src/domain/password'
import { signToken } from '../src/domain/token'
import { config } from '../src/config'
import { initSocket } from '../src/socket'
import { createApp } from '../src/app'

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
  timeoutMs = 7000,
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
  const app = createApp()
  const server = createServer(app)
  initSocket(server)
  servers.push(server)

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address()
  assert.ok(address && typeof address === 'object')

  return `http://127.0.0.1:${address.port}`
}

const makeUser = async () => {
  const user = await prisma.user.create({
    data: {
      clientId: unique('reconnect-client'),
      nickname: 'Reconnect Test',
      fullName: 'Reconnect Integration Test',
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
      username: unique('reconnect-admin'),
      passwordHash: await hashPassword('reconnect-test-password'),
      displayName: 'Reconnect Test Admin',
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
      id: `WY-20991229-${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`,
      userId,
      serviceIds: ['test-service'],
      serviceName: 'Reconnect Test Service',
      price: 99,
      date: '2099-12-29',
      time: '22:30',
      note: 'reconnect integration test',
      nickname: 'Reconnect Test',
      fullName: 'Reconnect Integration Test',
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

const connect = async (
  url: string,
  auth: Record<string, string>,
  reconnection = false,
) => {
  const socket = connectClient(url, {
    transports: ['websocket'],
    auth: (cb: (data: Record<string, string>) => void) => cb(auth),
    reconnection,
    reconnectionAttempts: 10,
    reconnectionDelay: 200,
    reconnectionDelayMax: 1000,
  })

  sockets.push(socket)

  await waitForEvent(socket, 'connect')

  return socket
}

const joinBooking = async (
  socket: ClientSocket,
  bookingId: string,
) => {
  const result = await new Promise<{ ok?: boolean; code?: string; message?: string }>((resolve) => {
    socket.emit(
      'chat:join',
      { bookingId },
      resolve,
    )
  })

  assert.equal(
    result.ok,
    true,
    `chat:join failed: ${JSON.stringify(result)}`,
  )
}

const sendCustomerMessage = async (
  url: string,
  bookingId: string,
  clientId: string,
  body: string,
  clientMsgId: string,
) => {
  const response = await fetch(
    `${url}/api/bookings/${encodeURIComponent(bookingId)}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': clientId,
      },
      body: JSON.stringify({
        body,
        clientMsgId,
      }),
    },
  )

  const payload = await response.json() as {
    message?: {
      bookingId: string
      body: string
      clientMsgId?: string | null
    }
    error?: unknown
  }

  assert.ok(
    response.status === 200 || response.status === 201,
    `unexpected status: ${response.status}`,
  )
  assert.ok(payload.message)

  return payload.message
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

test('Reconnect: socket reconnects after transport disconnect', async () => {
  const user = await makeUser()

  const url = await startSocketServer()

  const socket = await connect(
    url,
    { clientId: user.clientId },
    true,
  )

  socket.disconnect()

  assert.equal(socket.connected, false)

  const reconnectPromise = waitForEvent(socket, 'connect', 10000)

  socket.connect()

  await reconnectPromise

  assert.equal(socket.connected, true)
})

test('Reconnect: customer can rejoin the same booking after reconnect', async () => {
  const user = await makeUser()
  await makeAdmin()
  const booking = await makeBooking(user.id)

  const url = await startSocketServer()

  const socket = await connect(
    url,
    { clientId: user.clientId },
    true,
  )

  await joinBooking(socket, booking.id)

  socket.disconnect()

  const reconnectPromise = waitForEvent(socket, 'connect', 10000)

  socket.connect()

  await reconnectPromise

  await joinBooking(socket, booking.id)

  assert.equal(socket.connected, true)
})

test('Reconnect: messages still work after reconnect', async () => {
  const user = await makeUser()
  const admin = await makeAdmin()
  const booking = await makeBooking(user.id)

  const url = await startSocketServer()

  const customer = await connect(
    url,
    { clientId: user.clientId },
    true,
  )

  const adminToken = signToken(
    admin.id,
    config.adminTokenSecret,
    Date.now(),
    config.adminTokenTtlMs,
  ).token

  const adminSocket = await connect(
    url,
    { adminToken },
    false,
  )

  await joinBooking(customer, booking.id)
  await joinBooking(adminSocket, booking.id)

  customer.disconnect()

  const reconnectPromise = waitForEvent(customer, 'connect', 10000)

  customer.connect()

  await reconnectPromise

  await joinBooking(customer, booking.id)

  const messagePromise = waitForEvent<{
    bookingId: string
    body: string
  }>(adminSocket, 'message:new')

  await sendCustomerMessage(
    url,
    booking.id,
    user.clientId,
    'message after reconnect',
    unique('reconnect-message'),
  )

  const message = await messagePromise

  assert.equal(message.bookingId, booking.id)
  assert.equal(message.body, 'message after reconnect')
})

test('Reconnect: repeated client message id does not create duplicates after reconnect', async () => {
  const user = await makeUser()
  const admin = await makeAdmin()
  const booking = await makeBooking(user.id)

  const url = await startSocketServer()

  const customer = await connect(
    url,
    { clientId: user.clientId },
    true,
  )

  const adminToken = signToken(
    admin.id,
    config.adminTokenSecret,
    Date.now(),
    config.adminTokenTtlMs,
  ).token

  const adminSocket = await connect(
    url,
    { adminToken },
    false,
  )

  await joinBooking(customer, booking.id)
  await joinBooking(adminSocket, booking.id)

  const clientMsgId = unique('reconnect-dedupe')

  customer.disconnect()

  const reconnectPromise = waitForEvent(customer, 'connect', 10000)

  customer.connect()

  await reconnectPromise

  await joinBooking(customer, booking.id)

  let received = 0

  adminSocket.on('message:new', (message: { clientMsgId?: string }) => {
    if (message.clientMsgId === clientMsgId) {
      received += 1
    }
  })

  await sendCustomerMessage(
    url,
    booking.id,
    user.clientId,
    'dedupe after reconnect',
    clientMsgId,
  )

  await new Promise((resolve) => setTimeout(resolve, 300))

  await sendCustomerMessage(
    url,
    booking.id,
    user.clientId,
    'dedupe after reconnect',
    clientMsgId,
  )

  await new Promise((resolve) => setTimeout(resolve, 300))

  const count = await prisma.message.count({
    where: {
      bookingId: booking.id,
      clientMsgId,
    },
  })

  assert.equal(count, 1)
  assert.equal(received, 1)
})
