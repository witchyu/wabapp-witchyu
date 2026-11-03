import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { prisma } from '../src/db'
import { createBooking } from '../src/services/bookingService'
import { updateSlot } from '../src/services/adminService'
import { AppError } from '../src/domain/errors'
import { addDaysISO, dayOfWeek, shopNow } from '../src/domain/time'

test('booking concurrency: one booking per slot and admin slot protection', async () => {
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
        update: {
          endTime: time === '23:00' ? '23:30' : '23:59',
          isLastSlot: false,
          unlimited: false,
          active: true,
        },
        create: {
          time,
          endTime: time === '23:00' ? '23:30' : '23:59',
          isLastSlot: false,
          unlimited: false,
          active: true,
        },
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

    // Test 1: ลูกค้า 8 คนจอง Slot เดียวกันพร้อมกัน ต้องสำเร็จเพียง 1 คน
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

    assert.equal(successful.length, 1, 'หนึ่ง Slot ต้องมี Booking ที่ใช้งานอยู่ได้เพียง 1 รายการ')

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

    assert.equal(rejected.length, 7, 'คำขอที่เหลืออีก 7 รายการต้องถูกปฏิเสธ')

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

    assert.equal(firstSlotBookings.length, 1)
    assert.equal(new Set(firstSlotBookings.map((b) => b.id)).size, 1)

    // Test 2: อีก Slot หนึ่งต้องจองได้ และ Booking ID ต้องไม่ซ้ำ
    const secondBooking = await createBooking(
      clientIds[8],
      makeInput(times[1], 8),
    )

    createdBookingIds.push(secondBooking.id)

    const allIds = [...successful.map((b) => b.id), secondBooking.id]
    assert.equal(new Set(allIds).size, allIds.length, 'Booking ID ต้องไม่ซ้ำกัน')

    // Test 3: Admin ห้ามปิด Slot ที่มี Booking ซึ่งยังใช้งานอยู่
    const slot = await prisma.timeSlot.findUniqueOrThrow({
      where: { time: times[0] },
    })

    await assert.rejects(
      () => updateSlot(slot.id, { active: false }),
      (error: unknown) => {
        assert.ok(error instanceof AppError)
        assert.equal(error.code, 'SLOT_IN_USE')
        return true
      },
    )

    const unchangedSlot = await prisma.timeSlot.findUniqueOrThrow({
      where: { id: slot.id },
    })

    assert.equal(unchangedSlot.active, true)

    console.log('Concurrency test passed:', {
      successfulBookings: successful.length,
      rejectedBookings: rejected.length,
      uniqueBookingIds: allIds.length,
      adminSlotProtection: true,
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
          data: {
            time: old.time,
            endTime: old.endTime,
            isLastSlot: old.isLastSlot,
            unlimited: old.unlimited,
            active: old.active,
          },
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
