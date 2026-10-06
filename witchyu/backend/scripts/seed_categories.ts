import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const categories = [
  {
    id: 'question',
    label: 'คำถามเจาะจง',
    hint: '',
    note: '',
    multi: false,
    sortOrder: 1,
  },
  {
    id: 'call',
    label: 'คำถามแบบโทร',
    hint: '',
    note: '* แพ็กเกจโทรไม่จำกัดชั่วโมง/คำถาม จองได้เฉพาะรอบเวลา 22:30 น. เท่านั้น',
    multi: false,
    sortOrder: 2,
  },
  {
    id: 'topic',
    label: 'คำถามเจาะจงเป็นเรื่องๆ',
    hint: '',
    note: '',
    multi: false,
    sortOrder: 3,
  },
  {
    id: 'choice',
    label: 'คำถาม 2 ทางเลือก',
    hint: '',
    note: '',
    multi: true,
    sortOrder: 4,
  },
  {
    id: 'love59',
    label: 'เซ็ตคำถามความรัก 59 บาท',
    hint: '',
    note: '',
    multi: true,
    sortOrder: 5,
  },
  {
    id: 'love49',
    label: 'เซ็ตคำถามความรัก 49 บาท',
    hint: '',
    note: '',
    multi: true,
    sortOrder: 6,
  },
  {
    id: 'work',
    label: 'เซ็ตคำถามการงาน',
    hint: '',
    note: '',
    multi: true,
    sortOrder: 7,
  },
  {
    id: 'study',
    label: 'เซ็ตคำถามการเรียน',
    hint: '',
    note: '',
    multi: true,
    sortOrder: 8,
  },
]

async function main() {
  for (const category of categories) {
    await prisma.serviceCategory.upsert({
      where: { id: category.id },
      update: {
        label: category.label,
        hint: category.hint,
        note: category.note,
        multi: category.multi,
        sortOrder: category.sortOrder,
      },
      create: category,
    })
  }

  console.log(`Seeded ${categories.length} service categories`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
