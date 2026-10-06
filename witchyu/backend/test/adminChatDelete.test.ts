import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../src/db'
import { deleteMessage, type Viewer } from '../src/services/chatService'
import { AppError } from '../src/domain/errors'

const createdBookingIds: string[] = []
const createdUserIds: string[] = []

const makeUser = async () => {
  const user = await prisma.user.create({
    data: {
      clientId: `test-chat-delete-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      nickname: 'Test',
      fullName: 'Test Chat Delete',
      age: 21,
      relationship: 'single',
    },
  })

  createdUserIds.push(user.id)
  return user
}

const makeBooking = async () => {
  const user = await makeUser()

  const booking = await prisma.booking.create({
    data: {
      id: `TEST-CHAT-DELETE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: user.id,
      serviceIds: ['test-service'],
      serviceName: 'Test Service',
      price: 99,
      date: '2099-12-31',
      time: '22:30',
      note: 'integration test',
      nickname: user.nickname,
      fullName: user.fullName,
      age: user.age,
      relationship: user.relationship,
      isCall: false,
      status: 'confirmed',
      expiresAt: new Date('2099-12-31T23:59:00.000Z'),
    },
  })

  createdBookingIds.push(booking.id)
  return booking
}

const adminViewer: Viewer = {
  role: 'admin',
  adminId: 'test-admin-delete-message',
}

const customerViewer = (clientId: string): Viewer => ({
  role: 'customer',
  clientId,
})

afterEach(async () => {
  if (createdBookingIds.length > 0) {
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

  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    })

    createdUserIds.length = 0
  }
})

test('deleteMessage: admin permanently deletes an existing message', async () => {
  const booking = await makeBooking()

  const message = await prisma.message.create({
    data: {
      bookingId: booking.id,
      senderRole: 'customer',
      userId: booking.userId,
      body: 'ข้อความที่ต้องลบถาวร',
    },
  })

  const result = await deleteMessage(adminViewer, booking.id, message.id)

  assert.deepEqual(result, {
    ok: true,
    id: message.id,
  })

  const deleted = await prisma.message.findUnique({
    where: { id: message.id },
  })

  assert.equal(deleted, null)
})

test('deleteMessage: admin can delete both customer and admin messages', async () => {
  const booking = await makeBooking()

  const customerMessage = await prisma.message.create({
    data: {
      bookingId: booking.id,
      senderRole: 'customer',
      userId: booking.userId,
      body: 'customer message',
    },
  })

  const adminMessage = await prisma.message.create({
    data: {
      bookingId: booking.id,
      senderRole: 'admin',
      body: 'admin message',
    },
  })

  await deleteMessage(adminViewer, booking.id, customerMessage.id)
  await deleteMessage(adminViewer, booking.id, adminMessage.id)

  const remaining = await prisma.message.count({
    where: { bookingId: booking.id },
  })

  assert.equal(remaining, 0)
})

test('deleteMessage: customer cannot delete messages', async () => {
  const booking = await makeBooking()

  const message = await prisma.message.create({
    data: {
      bookingId: booking.id,
      senderRole: 'customer',
      userId: booking.userId,
      body: 'must remain',
    },
  })

  await assert.rejects(
    () => deleteMessage(customerViewer('wrong-client-id'), booking.id, message.id),
    (error: unknown) => {
      assert.ok(error instanceof AppError)
      assert.equal(error.code, 'FORBIDDEN')
      return true
    },
  )

  const stillExists = await prisma.message.findUnique({
    where: { id: message.id },
  })

  assert.notEqual(stillExists, null)
})

test('deleteMessage: missing message returns not found', async () => {
  const booking = await makeBooking()

  await assert.rejects(
    () => deleteMessage(adminViewer, booking.id, 'ckxxxxxxxxxxxxxxxxxxxxxxxx'),
    (error: unknown) => {
      assert.ok(error instanceof AppError)
      assert.equal(error.code, 'MESSAGE_NOT_FOUND')
      return true
    },
  )
})

test('deleteMessage: admin cannot delete a message from another booking', async () => {
  const bookingA = await makeBooking()
  const bookingB = await makeBooking()

  const message = await prisma.message.create({
    data: {
      bookingId: bookingB.id,
      senderRole: 'customer',
      userId: bookingB.userId,
      body: 'belongs to booking B',
    },
  })

  await assert.rejects(
    () => deleteMessage(adminViewer, bookingA.id, message.id),
    (error: unknown) => {
      assert.ok(error instanceof AppError)
      assert.equal(error.code, 'MESSAGE_NOT_FOUND')
      return true
    },
  )

  const stillExists = await prisma.message.findUnique({
    where: { id: message.id },
  })

  assert.notEqual(stillExists, null)
})
