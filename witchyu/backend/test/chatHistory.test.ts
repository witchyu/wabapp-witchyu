import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../src/db'
import { listMessages, type Viewer } from '../src/services/chatService'
import { encodeCursor } from '../src/domain/chat'

const createdBookingIds: string[] = []
const createdUserIds: string[] = []

let sequence = 0

const unique = (prefix: string) => `${prefix}-${Date.now()}-${++sequence}`

async function makeUser() {
  const user = await prisma.user.create({
    data: {
      clientId: unique('history-client'),
      nickname: 'History Test',
      fullName: 'History Test User',
      age: 21,
      relationship: 'single',
    },
  })

  createdUserIds.push(user.id)
  return user
}

async function makeBooking(userId: string, suffix = '001') {
  const booking = await prisma.booking.create({
    data: {
      id: `WY-20991230-${suffix}`,
      userId,
      serviceIds: ['test-service'],
      serviceName: 'History Test Service',
      price: 99,
      date: '2099-12-30',
      time: '20:00',
      note: '',
      nickname: 'History Test',
      fullName: 'History Test User',
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

async function addMessage(
  bookingId: string,
  senderRole: 'customer' | 'admin',
  body: string,
  createdAt: Date,
) {
  return prisma.message.create({
    data: {
      bookingId,
      senderRole,
      body,
      createdAt,
      userId: senderRole === 'customer'
        ? (await prisma.booking.findUniqueOrThrow({
            where: { id: bookingId },
            select: { userId: true },
          })).userId
        : null,
    },
  })
}

afterEach(async () => {
  await prisma.message.deleteMany({
    where: { bookingId: { in: createdBookingIds } },
  })

  await prisma.booking.deleteMany({
    where: { id: { in: createdBookingIds } },
  })

  await prisma.user.deleteMany({
    where: { id: { in: createdUserIds } },
  })

  createdBookingIds.length = 0
  createdUserIds.length = 0
})

test('chat history: loads latest messages with limit and hasMore', async () => {
  const user = await makeUser()
  const booking = await makeBooking(user.id, '101')

  for (let i = 1; i <= 5; i++) {
    await addMessage(
      booking.id,
      i % 2 ? 'customer' : 'admin',
      `message-${i}`,
      new Date(Date.UTC(2099, 11, 30, 20, i, 0)),
    )
  }

  const viewer: Viewer = {
    role: 'customer',
    clientId: user.clientId,
  }

  const page = await listMessages(viewer, booking.id, { limit: 3 })

  assert.equal(page.messages.length, 3)
  assert.equal(page.hasMore, true)
  assert.ok(page.nextBefore)

  assert.deepEqual(
    page.messages.map((m) => m.body),
    ['message-3', 'message-4', 'message-5'],
  )
})

test('chat history: before cursor loads the previous page without overlap', async () => {
  const user = await makeUser()
  const booking = await makeBooking(user.id, '102')

  for (let i = 1; i <= 6; i++) {
    await addMessage(
      booking.id,
      i % 2 ? 'customer' : 'admin',
      `message-${i}`,
      new Date(Date.UTC(2099, 11, 30, 20, i, 0)),
    )
  }

  const viewer: Viewer = {
    role: 'customer',
    clientId: user.clientId,
  }

  const first = await listMessages(viewer, booking.id, { limit: 3 })

  assert.deepEqual(
    first.messages.map((m) => m.body),
    ['message-4', 'message-5', 'message-6'],
  )

  assert.ok(first.nextBefore)

  const second = await listMessages(viewer, booking.id, {
    limit: 3,
    before: {
      ms: first.messages[0].createdAt,
      id: first.messages[0].id,
    },
  })

  assert.deepEqual(
    second.messages.map((m) => m.body),
    ['message-1', 'message-2', 'message-3'],
  )

  assert.equal(second.hasMore, false)
  assert.equal(second.nextBefore, undefined)

  const firstIds = new Set(first.messages.map((m) => m.id))
  assert.equal(
    second.messages.some((m) => firstIds.has(m.id)),
    false,
  )
})

test('chat history: empty booking returns empty messages and no cursor', async () => {
  const user = await makeUser()
  const booking = await makeBooking(user.id, '103')

  const viewer: Viewer = {
    role: 'customer',
    clientId: user.clientId,
  }

  const page = await listMessages(viewer, booking.id, { limit: 30 })

  assert.deepEqual(page.messages, [])
  assert.equal(page.hasMore, false)
  assert.equal(page.nextBefore, undefined)
})

test('chat history: customer cannot read another customer booking', async () => {
  const userA = await makeUser()
  const userB = await makeUser()

  const booking = await makeBooking(userB.id, '104')

  const viewer: Viewer = {
    role: 'customer',
    clientId: userA.clientId,
  }

  await assert.rejects(
    () => listMessages(viewer, booking.id, { limit: 30 }),
    (error: unknown) => {
      return (error as { code?: string }).code === 'BOOKING_NOT_FOUND'
    },
  )
})

test('chat history: pagination cursor is based on the first message of the returned page', async () => {
  const user = await makeUser()
  const booking = await makeBooking(user.id, '105')

  for (let i = 1; i <= 4; i++) {
    await addMessage(
      booking.id,
      'customer',
      `message-${i}`,
      new Date(Date.UTC(2099, 11, 30, 21, i, 0)),
    )
  }

  const viewer: Viewer = {
    role: 'customer',
    clientId: user.clientId,
  }

  const page = await listMessages(viewer, booking.id, { limit: 2 })

  assert.equal(page.messages.length, 2)
  assert.equal(page.hasMore, true)

  const expected = encodeCursor(
    page.messages[0].createdAt,
    page.messages[0].id,
  )

  assert.equal(page.nextBefore, expected)
})
