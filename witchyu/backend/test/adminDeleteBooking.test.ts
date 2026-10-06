import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../src/db'
import { deleteBooking } from '../src/services/adminService'
import { AppError } from '../src/domain/errors'

const createdBookingIds: string[] = []
const createdUserIds: string[] = []

const makeUser = async () => {
  const user = await prisma.user.create({
    data: {
      clientId: `test-delete-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      nickname: 'Test',
      fullName: 'Test Delete Booking',
      age: 21,
      relationship: 'single',
    },
  })

  createdUserIds.push(user.id)
  return user
}

const makeBooking = async (
  status: 'pending_payment' | 'confirmed' | 'completed' | 'cancelled',
) => {
  const user = await makeUser()

  const booking = await prisma.booking.create({
    data: {
      id: `TEST-DELETE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
      status,
      expiresAt: new Date('2099-12-31T23:59:00.000Z'),
    },
  })

  createdBookingIds.push(booking.id)
  return booking
}

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

test('deleteBooking: completed booking is permanently deleted with messages and calls', async () => {
  const booking = await makeBooking('completed')

  await prisma.message.create({
    data: {
      bookingId: booking.id,
      senderRole: 'customer',
      userId: booking.userId,
      body: 'test message',
    },
  })

  await prisma.callSession.create({
    data: {
      bookingId: booking.id,
      status: 'ended',
      startedAt: new Date(),
      endedAt: new Date(),
      endReason: 'test',
    },
  })

  await deleteBooking(booking.id)

  const [deletedBooking, messages, calls] = await Promise.all([
    prisma.booking.findUnique({ where: { id: booking.id } }),
    prisma.message.count({ where: { bookingId: booking.id } }),
    prisma.callSession.count({ where: { bookingId: booking.id } }),
  ])

  assert.equal(deletedBooking, null)
  assert.equal(messages, 0)
  assert.equal(calls, 0)

  createdBookingIds.splice(createdBookingIds.indexOf(booking.id), 1)
})

test('deleteBooking: cancelled booking is permanently deleted', async () => {
  const booking = await makeBooking('cancelled')

  await deleteBooking(booking.id)

  const deletedBooking = await prisma.booking.findUnique({
    where: { id: booking.id },
  })

  assert.equal(deletedBooking, null)

  createdBookingIds.splice(createdBookingIds.indexOf(booking.id), 1)
})

test('deleteBooking: pending payment booking cannot be deleted', async () => {
  const booking = await makeBooking('pending_payment')

  await assert.rejects(
    () => deleteBooking(booking.id),
    (error: unknown) => {
      assert.ok(error instanceof AppError)
      assert.equal(error.code, 'INVALID_STATUS')
      return true
    },
  )

  const stillExists = await prisma.booking.findUnique({
    where: { id: booking.id },
  })

  assert.notEqual(stillExists, null)
})

test('deleteBooking: confirmed booking cannot be deleted', async () => {
  const booking = await makeBooking('confirmed')

  await assert.rejects(
    () => deleteBooking(booking.id),
    (error: unknown) => {
      assert.ok(error instanceof AppError)
      assert.equal(error.code, 'INVALID_STATUS')
      return true
    },
  )

  const stillExists = await prisma.booking.findUnique({
    where: { id: booking.id },
  })

  assert.notEqual(stillExists, null)
})

test('deleteBooking: missing booking returns not found', async () => {
  await assert.rejects(
    () => deleteBooking('TEST-DELETE-NOT-FOUND'),
    (error: unknown) => {
      assert.ok(error instanceof AppError)
      assert.equal(error.code, 'NOT_FOUND')
      return true
    },
  )
})
