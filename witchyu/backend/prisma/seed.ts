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
        unlimited: s.unlimited ?? false,
        perQuestion: s.perQuestion ?? false,
        questions: s.questions ?? [],
        active: s.active,
        sortOrder: i,
      },
    })
  }

  for (const time of ['18:00', '19:00', '20:00', '21:00', '22:30']) {
    await prisma.timeSlot.upsert({ where: { time }, update: {}, create: { time, capacity: 1 } })
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
