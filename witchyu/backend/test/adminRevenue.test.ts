import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../src/db'
import { dashboard } from '../src/services/adminService'

const createdBookingIds: string[] = []
const createdUserIds: string[] = []

const makeUser = async () => {
  const user = await prisma.user.create({
    data: {
      clientId: `test-revenue-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      nickname: 'Revenue Test',
      fullName: 'Revenue Integration Test',
      age: 21,
      relationship: 'single',
    },
  })

  createdUserIds.push(user.id)
  return user
}

const makeBooking = async (
  status: 'pending_payment' | 'confirmed' | 'completed' | 'cancelled',
  price: number,
  date: string,
) => {
  const user = await makeUser()

  const booking = await prisma.booking.create({
    data: {
      id: `TEST-REVENUE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: user.id,
      serviceIds: ['test-revenue-service'],
      serviceName: 'Revenue Test Service',
      price,
      date,
      time: '22:30',
      note: 'revenue integration test',
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

test('dashboard revenue: confirmed and completed are counted, pending and cancelled are excluded', async () => {
  const dashboardBefore = await dashboard()

  const today = dashboardBefore.today
  const otherDate = '2099-12-31'

  await makeBooking('confirmed', 129, today)
  await makeBooking('completed', 239, today)

  await makeBooking('confirmed', 399, otherDate)
  await makeBooking('completed', 499, otherDate)

  await makeBooking('pending_payment', 999, today)
  await makeBooking('cancelled', 888, today)

  const result = await dashboard()

  assert.equal(
    result.stats.todayRevenue - dashboardBefore.stats.todayRevenue,
    368,
  )

  assert.equal(
    result.stats.paidCount - dashboardBefore.stats.paidCount,
    4,
  )

  assert.equal(
    result.stats.totalRevenue - dashboardBefore.stats.totalRevenue,
    1266,
  )
})
