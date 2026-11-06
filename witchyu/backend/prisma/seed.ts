import { PrismaClient } from '@prisma/client'
import { SERVICES } from './seed-data'

const prisma = new PrismaClient()

// รันซ้ำได้: สร้างเฉพาะรายการที่ยังไม่มี ไม่เขียนทับข้อมูลที่แก้ไว้แล้ว
async function main() {
  for (const [i, s] of SERVICES.entries()) {
    await prisma.service.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        group: s.group,
        name: s.name,
        description: s.desc,
        price: s.price,
        durationMin: s.durationMin ?? null,
        perQuestion: s.perQuestion ?? false,
        questions: s.questions ?? [],
        active: s.active,
        sortOrder: i,
      },
    })
  }

  const timeSlots = [
    { time: '18:00', endTime: '19:00' },
    { time: '19:00', endTime: '20:00' },
    { time: '20:00', endTime: '21:00' },
    { time: '21:00', endTime: '22:00' },
    { time: '22:30', endTime: '23:00', isLastSlot: true },
  ]

  for (const slot of timeSlots) {
    await prisma.timeSlot.upsert({
      where: { time: slot.time },
      update: {},
      create: slot,
    })
  }

  for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
    await prisma.businessHours.upsert({
      where: { dayOfWeek },
      update: {},
      create: { dayOfWeek, openTime: '18:00', closeTime: '23:00', isClosed: false },
    })
  }

  await prisma.shopSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1, shopOpen: true, callsEnabled: true } })

  console.log(`seed ok: ${SERVICES.length} services, 5 time slots, 7 business-hour rows`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
