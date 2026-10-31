import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server as HttpServer } from 'node:http'
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client'
import { prisma } from '../src/db'
import { hashPassword } from '../src/domain/password'
import { signToken } from '../src/domain/token'
import { config } from '../src/config'
import { initSocket } from '../src/socket'
import { sendMessage, type Viewer } from '../src/services/chatService'

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
  const io = initSocket(server)

  servers.push(server)

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address()
  assert.ok(address && typeof address === 'object')

  return {
    io,
    url: `http://127.0.0.1:${address.port}`,
    server,
  }
}

const connectToServer = async (
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

const connect = async (auth: Record<string, string>) => {
  const server = createServer()
  const io = initSocket(server)

  servers.push(server)

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address()
  assert.ok(address && typeof address === 'object')

  const socket = connectClient(`http://127.0.0.1:${address.port}`, {
    transports: ['websocket'],
    auth,
    reconnection: false,
  })

  sockets.push(socket)

  await waitForEvent(socket, 'connect')

  return { socket, io, server }
}

const makeUser = async () => {
  const user = await prisma.user.create({
    data: {
      clientId: unique('test-socket-client'),
      nickname: 'Socket Test',
      fullName: 'Socket Integration Test',
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
      username: unique('socket-admin'),
      passwordHash: await hashPassword('socket-test-password'),
      displayName: 'Socket Test Admin',
    },
  })

  createdAdminIds.push(admin.id)
  return admin
}

let bookingSequence = 0

const makeBooking = async (userId: string) => {
  bookingSequence += 1

  const bookingId = `WY-20991231-${String(bookingSequence).padStart(3, '0')}`

  const booking = await prisma.booking.create({
    data: {
      id: bookingId,
      userId,
      serviceIds: ['test-service'],
      serviceName: 'Socket Test Service',
      price: 99,
      date: '2099-12-31',
      time: '22:30',
      note: 'socket integration test',
      nickname: 'Socket Test',
      fullName: 'Socket Integration Test',
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

test('Socket.IO: customer and admin authenticate and join the same booking room', async () => {
  const user = await makeUser()
  const admin = await makeAdmin()
  const booking = await makeBooking(user.id)

  const adminToken = signToken(
    admin.id,
    config.adminTokenSecret,
    Date.now(),
    config.adminTokenTtlMs,
  ).token

  const customer = await connect({ clientId: user.clientId })
  const adminSocket = await connect({ adminToken })

  const customerJoin = await new Promise<{ ok?: boolean }>((resolve) => {
    customer.socket.emit(
      'chat:join',
      { bookingId: booking.id },
      resolve,
    )
  })

  const adminJoin = await new Promise<{ ok?: boolean }>((resolve) => {
    adminSocket.socket.emit(
      'chat:join',
      { bookingId: booking.id },
      resolve,
    )
  })

  assert.equal(customerJoin.ok, true)
  assert.equal(adminJoin.ok, true)
})

test('Socket.IO: customer and admin receive message:new in real time', async () => {
  const user = await makeUser()
  const admin = await makeAdmin()
  const booking = await makeBooking(user.id)

  const adminToken = signToken(
    admin.id,
    config.adminTokenSecret,
    Date.now(),
    config.adminTokenTtlMs,
  ).token

  const socketServer = await startSocketServer()

  const customerSocket = await connectToServer(
    socketServer.url,
    { clientId: user.clientId },
  )

  const adminSocket = await connectToServer(
    socketServer.url,
    { adminToken },
  )

  const join = async (socket: ClientSocket) =>
    new Promise<{ ok?: boolean }>((resolve) => {
      socket.emit('chat:join', { bookingId: booking.id }, resolve)
    })

  assert.equal((await join(customerSocket)).ok, true)
  assert.equal((await join(adminSocket)).ok, true)

  const customerMessageEvent = waitForEvent<{
    id: string
    bookingId: string
    senderRole: string
    body: string
    clientMsgId?: string
  }>(customerSocket, 'message:new')

  const adminMessageEvent = waitForEvent<{
    id: string
    bookingId: string
    senderRole: string
    body: string
    clientMsgId?: string
  }>(adminSocket, 'message:new')

  const customerViewer: Viewer = {
    role: 'customer',
    clientId: user.clientId,
  }

  const customerMessage = await sendMessage(
    customerViewer,
    booking.id,
    'สวัสดีจาก Customer',
    'socket-customer-msg-001',
  )

  const customerReceived = await customerMessageEvent
  const adminReceived = await adminMessageEvent

  assert.equal(customerReceived.id, customerMessage.id)
  assert.equal(customerReceived.bookingId, booking.id)
  assert.equal(customerReceived.senderRole, 'customer')
  assert.equal(customerReceived.body, 'สวัสดีจาก Customer')
  assert.equal(customerReceived.clientMsgId, 'socket-customer-msg-001')

  assert.deepEqual(adminReceived, customerReceived)

  const adminMessageEventOnCustomer = waitForEvent<{
    id: string
    bookingId: string
    senderRole: string
    body: string
    clientMsgId?: string
  }>(customerSocket, 'message:new')

  const adminMessageEventOnAdmin = waitForEvent<{
    id: string
    bookingId: string
    senderRole: string
    body: string
    clientMsgId?: string
  }>(adminSocket, 'message:new')

  const adminViewer: Viewer = {
    role: 'admin',
    adminId: admin.id,
  }

  const adminMessage = await sendMessage(
    adminViewer,
    booking.id,
    'สวัสดีจาก Admin',
    'socket-admin-msg-001',
  )

  const customerReceivedAdmin = await adminMessageEventOnCustomer
  const adminReceivedOwn = await adminMessageEventOnAdmin

  assert.equal(customerReceivedAdmin.id, adminMessage.id)
  assert.equal(customerReceivedAdmin.senderRole, 'admin')
  assert.equal(customerReceivedAdmin.body, 'สวัสดีจาก Admin')

  assert.deepEqual(adminReceivedOwn, customerReceivedAdmin)
})

test('Socket.IO: unauthorized customer cannot join another customer booking', async () => {
  const owner = await makeUser()
  const stranger = await makeUser()
  const booking = await makeBooking(owner.id)

  const customer = await connect({ clientId: stranger.clientId })

  const result = await new Promise<{
    ok?: boolean
    code?: string
  }>((resolve) => {
    customer.socket.emit(
      'chat:join',
      { bookingId: booking.id },
      resolve,
    )
  })

  assert.equal(result.ok, false)
  assert.equal(result.code, 'FORBIDDEN')
})

test('Socket.IO: same clientMsgId does not create a duplicate message', async () => {
  const user = await makeUser()
  const booking = await makeBooking(user.id)

  const viewer: Viewer = {
    role: 'customer',
    clientId: user.clientId,
  }

  const first = await sendMessage(
    viewer,
    booking.id,
    'ข้อความเดียวกัน',
    'duplicate-client-msg-001',
  )

  const second = await sendMessage(
    viewer,
    booking.id,
    'ข้อความเดียวกัน',
    'duplicate-client-msg-001',
  )

  assert.equal(second.id, first.id)

  const count = await prisma.message.count({
    where: {
      bookingId: booking.id,
      clientMsgId: 'duplicate-client-msg-001',
    },
  })

  assert.equal(count, 1)
})


test('Socket.IO call signaling: customer and admin exchange WebRTC signals', async () => {
  const user = await makeUser()
  const admin = await makeAdmin()
  const booking = await makeBooking(user.id)

  const adminToken = signToken(
    admin.id,
    config.adminTokenSecret,
    Date.now(),
    config.adminTokenTtlMs,
  ).token

  const server = await startSocketServer()
  const customer = await connectToServer(server.url, { clientId: user.clientId })
  const adminSocket = await connectToServer(server.url, { adminToken })

  const emitAck = (socket: ClientSocket, event: string, payload: unknown) =>
    new Promise<{ ok?: boolean; code?: string }>((resolve) => {
      socket.emit(event, payload, resolve)
    })

  assert.equal(
    (await emitAck(customer, 'call:join', { bookingId: booking.id })).ok,
    true,
  )
  assert.equal(
    (await emitAck(adminSocket, 'call:join', { bookingId: booking.id })).ok,
    true,
  )

  const offerEvent = waitForEvent<{
    bookingId: string
    fromRole: string
    description: { type: string; sdp: string }
  }>(adminSocket, 'call:offer')

  assert.equal(
    (await emitAck(customer, 'call:offer', {
      bookingId: booking.id,
      description: { type: 'offer', sdp: 'test-offer-sdp' },
    })).ok,
    true,
  )

  const offer = await offerEvent
  assert.equal(offer.bookingId, booking.id)
  assert.equal(offer.fromRole, 'customer')
  assert.deepEqual(offer.description, {
    type: 'offer',
    sdp: 'test-offer-sdp',
  })

  const answerEvent = waitForEvent<{
    bookingId: string
    fromRole: string
    description: { type: string; sdp: string }
  }>(customer, 'call:answer')

  assert.equal(
    (await emitAck(adminSocket, 'call:answer', {
      bookingId: booking.id,
      description: { type: 'answer', sdp: 'test-answer-sdp' },
    })).ok,
    true,
  )

  const answer = await answerEvent
  assert.equal(answer.bookingId, booking.id)
  assert.equal(answer.fromRole, 'admin')
  assert.deepEqual(answer.description, {
    type: 'answer',
    sdp: 'test-answer-sdp',
  })

  const candidateEvent = waitForEvent<{
    bookingId: string
    fromRole: string
    candidate: {
      candidate: string
      sdpMid: string
      sdpMLineIndex: number
    }
  }>(adminSocket, 'call:ice-candidate')

  assert.equal(
    (await emitAck(customer, 'call:ice-candidate', {
      bookingId: booking.id,
      candidate: {
        candidate: 'candidate:test',
        sdpMid: '0',
        sdpMLineIndex: 0,
      },
    })).ok,
    true,
  )

  const candidate = await candidateEvent
  assert.equal(candidate.bookingId, booking.id)
  assert.equal(candidate.fromRole, 'customer')
  assert.deepEqual(candidate.candidate, {
    candidate: 'candidate:test',
    sdpMid: '0',
    sdpMLineIndex: 0,
  })

  const hangupEvent = waitForEvent<{
    bookingId: string
    fromRole: string
    reason: string
  }>(adminSocket, 'call:hangup')

  assert.equal(
    (await emitAck(customer, 'call:hangup', {
      bookingId: booking.id,
      reason: 'hangup',
    })).ok,
    true,
  )

  const hangup = await hangupEvent
  assert.equal(hangup.bookingId, booking.id)
  assert.equal(hangup.fromRole, 'customer')
  assert.equal(hangup.reason, 'hangup')
})

test('Socket.IO call signaling: unauthorized customer and unjoined socket are rejected', async () => {
  const owner = await makeUser()
  const otherUser = await makeUser()
  const booking = await makeBooking(owner.id)

  const server = await startSocketServer()
  const otherCustomer = await connectToServer(
    server.url,
    { clientId: otherUser.clientId },
  )

  const emitAck = (event: string, payload: unknown) =>
    new Promise<{ ok?: boolean; code?: string }>((resolve) => {
      otherCustomer.emit(event, payload, resolve)
    })

  const joinResult = await emitAck('call:join', {
    bookingId: booking.id,
  })
  assert.equal(joinResult.ok, false)
  assert.equal(joinResult.code, 'FORBIDDEN')

  const offerResult = await emitAck('call:offer', {
    bookingId: booking.id,
    description: { type: 'offer', sdp: 'test-offer-sdp' },
  })
  assert.equal(offerResult.ok, false)
  assert.equal(offerResult.code, 'NOT_JOINED')

  const candidateResult = await emitAck('call:ice-candidate', {
    bookingId: booking.id,
    candidate: {
      candidate: 'candidate:test',
      sdpMid: '0',
      sdpMLineIndex: 0,
    },
  })
  assert.equal(candidateResult.ok, false)
  assert.equal(candidateResult.code, 'NOT_JOINED')
})
