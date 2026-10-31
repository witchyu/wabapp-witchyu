import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { prisma } from '../src/db'
import { createBooking } from '../src/services/bookingService'
import { updateSlot } from '../src/services/adminService'
import { AppError } from '../src/domain/errors'
import { addDaysISO, dayOfWeek, shopNow } from '../src/domain/time'

test('booking concurrency: capacity, unique IDs and admin capacity protection', async () => {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12)
  const date = addDaysISO(shopNow(Date.now()).date, 1)
  const day = dayOfWeek(date)
  const times = ['23:00', '23:30']
  const serviceId = `test-concurrency-${suffix}`

  const clientIds = Array.from({ length: 10 }, (_, i) => `test-concurrency-${suffix}-${i}`)
  const createdBookingIds: string[] = []

  const oldHours = await prisma.businessHours.findUnique({ where: { dayOfWeek: day } })
  const oldHoliday = await prisma.holiday.findUnique({ where: { date } })
  const oldSetting = await prisma.shopSetting.findUnique({ where: { id: 1 } })
  const oldSlots = await Promise.all(
    times.map((time) => prisma.timeSlot.findUnique({ where: { time } })),
  )

  try {
    await prisma.businessHours.upsert({
      where: { dayOfWeek: day },
      update: { openTime: '00:00', closeTime: '23:59', isClosed: false },
      create: { dayOfWeek: day, openTime: '00:00', closeTime: '23:59', isClosed: false },
    })

    await prisma.holiday.deleteMany({ where: { date } })

    await prisma.shopSetting.upsert({
      where: { id: 1 },
      update: { shopOpen: true, callsEnabled: true },
      create: { id: 1, shopOpen: true, callsEnabled: true },
    })

    for (const time of times) {
      await prisma.timeSlot.upsert({
        where: { time },
        update: { capacity: 2, active: true },
        create: { time, capacity: 2, active: true },
      })
    }

    await prisma.service.create({
      data: {
        id: serviceId,
        group: 'question',
        name: 'Concurrency Test Service',
        description: 'Temporary integration test service',
        price: 29,
        durationMin: null,
        unlimited: false,
        perQuestion: false,
        questions: [],
        active: true,
      },
    })

    const makeInput = (time: string, index: number) => ({
      customer: {
        nickname: `Test${index}`,
        fullName: `Concurrency Test ${index}`,
        age: 21,
        relationship: 'single',
      },
      serviceIds: [serviceId],
      date,
      time,
      note: 'Automated concurrency integration test',
    })

    // Test 1: ลูกค้า 8 คนจอง Slot เดียวกันที่มี Capacity 2 พร้อมกัน
    const results = await Promise.allSettled(
      clientIds.slice(0, 8).map((clientId, index) =>
        createBooking(clientId, makeInput(times[0], index)),
      ),
    )

    console.log('ALL BOOKING RESULTS:')
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(index, 'SUCCESS', result.value.id)
      } else {
        const error = result.reason as {
          name?: string
          code?: string
          message?: string
        }
        console.log(index, 'FAILED', {
          name: error?.name,
          code: error?.code,
          message: error?.message,
        })
      }
    })

    const successful = results
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof createBooking>>> => r.status === 'fulfilled')
      .map((r) => r.value)

    createdBookingIds.push(...successful.map((b) => b.id))

    assert.equal(successful.length, 2, 'ต้องสร้าง Booking ได้เท่ากับ Capacity 2')

    const rejected = results.filter((r) => r.status === 'rejected')

    console.log('BOOKING FAILURE DETAILS:')
    for (const result of rejected) {
      if (result.status !== 'rejected') continue
      const error = result.reason as {
        name?: string
        code?: string
        message?: string
        stack?: string
      }
      console.log({
        name: error?.name,
        code: error?.code,
        message: error?.message,
        stack: error?.stack?.split('\\n').slice(0, 5).join('\\n'),
      })
    }

    assert.equal(rejected.length, 6, 'คำขอที่เหลือต้องถูกปฏิเสธ')

    for (const result of rejected) {
      if (result.status !== 'rejected') continue
      assert.ok(result.reason instanceof AppError)
      assert.equal(result.reason.code, 'SLOT_FULL')
    }

    const firstSlotBookings = await prisma.booking.findMany({
      where: {
        date,
        time: times[0],
        id: { in: createdBookingIds },
        status: { in: ['pending_payment', 'confirmed'] },
      },
      select: { id: true },
    })

    assert.equal(firstSlotBookings.length, 2)
    assert.equal(new Set(firstSlotBookings.map((b) => b.id)).size, 2)

    // Test 2: ต่าง Slot แต่วันเดียวกัน ต้องได้ Booking ID ไม่ซ้ำ
    const secondResults = await Promise.all([
      createBooking(clientIds[8], makeInput(times[1], 8)),
      createBooking(clientIds[9], makeInput(times[1], 9)),
    ])

    createdBookingIds.push(...secondResults.map((b) => b.id))

    const allIds = [...successful.map((b) => b.id), ...secondResults.map((b) => b.id)]
    assert.equal(new Set(allIds).size, allIds.length, 'Booking ID ต้องไม่ซ้ำกัน')

    // Test 3: Admin ห้ามลด Capacity ต่ำกว่าจำนวนคิวที่กำลังใช้งาน
    const slot = await prisma.timeSlot.findUniqueOrThrow({
      where: { time: times[0] },
    })

    await assert.rejects(
      () => updateSlot(slot.id, { capacity: 1 }),
      (error: unknown) => {
        assert.ok(error instanceof AppError)
        assert.equal(error.code, 'CAPACITY_BELOW_BOOKINGS')
        return true
      },
    )

    const unchangedSlot = await prisma.timeSlot.findUniqueOrThrow({
      where: { id: slot.id },
    })

    assert.equal(unchangedSlot.capacity, 2)

    console.log('Concurrency test passed:', {
      successfulBookings: successful.length,
      rejectedBookings: rejected.length,
      uniqueBookingIds: allIds.length,
      adminCapacityProtection: true,
    })
  } finally {
    // ลบข้อมูลทดสอบที่สร้างจาก Client IDs นี้เท่านั้น
    await prisma.notification.deleteMany({
      where: { clientId: { in: clientIds } },
    })

    await prisma.notificationPreference.deleteMany({
      where: { clientId: { in: clientIds } },
    })

    const users = await prisma.user.findMany({
      where: { clientId: { in: clientIds } },
      select: { id: true },
    })
    const userIds = users.map((u) => u.id)

    if (createdBookingIds.length) {
      await prisma.message.deleteMany({ where: { bookingId: { in: createdBookingIds } } })
      await prisma.callSession.deleteMany({ where: { bookingId: { in: createdBookingIds } } })
      await prisma.paymentProof.deleteMany({ where: { bookingId: { in: createdBookingIds } } })
      await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } })
    }

    if (userIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    }

    await prisma.service.deleteMany({ where: { id: serviceId } })

    for (let i = 0; i < times.length; i++) {
      const time = times[i]
      const old = oldSlots[i]
      if (old) {
        await prisma.timeSlot.update({
          where: { id: old.id },
          data: { time: old.time, capacity: old.capacity, active: old.active },
        })
      } else {
        await prisma.timeSlot.deleteMany({ where: { time } })
      }
    }

    if (oldHours) {
      await prisma.businessHours.upsert({
        where: { dayOfWeek: day },
        update: {
          openTime: oldHours.openTime,
          closeTime: oldHours.closeTime,
          isClosed: oldHours.isClosed,
        },
        create: oldHours,
      })
    } else {
      await prisma.businessHours.deleteMany({ where: { dayOfWeek: day } })
    }

    if (oldHoliday) {
      await prisma.holiday.upsert({
        where: { date },
        update: { reason: oldHoliday.reason },
        create: oldHoliday,
      })
    } else {
      await prisma.holiday.deleteMany({ where: { date } })
    }

    if (oldSetting) {
      await prisma.shopSetting.update({
        where: { id: 1 },
        data: {
          shopOpen: oldSetting.shopOpen,
          callsEnabled: oldSetting.callsEnabled,
        },
      })
    } else {
      await prisma.shopSetting.deleteMany({ where: { id: 1 } })
    }
  }
})
