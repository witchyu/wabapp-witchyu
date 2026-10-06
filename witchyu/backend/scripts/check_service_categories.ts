import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const rows = await prisma.service.findMany({
    orderBy: [
      { sortOrder: 'asc' },
      { id: 'asc' },
    ],
    select: {
      id: true,
      group: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          label: true,
        },
      },
    },
  })

  console.log(JSON.stringify(rows, null, 2))

  const withoutCategory = rows.filter(
    (item) => item.categoryId === null,
  )

  console.log('')
  console.log('===== SUMMARY =====')
  console.log('Total services:', rows.length)
  console.log(
    'With category:',
    rows.length - withoutCategory.length,
  )
  console.log('Without category:', withoutCategory.length)

  if (withoutCategory.length > 0) {
    console.log('')
    console.log('===== SERVICES WITHOUT CATEGORY =====')

    for (const item of withoutCategory) {
      console.log(
        item.id,
        '| group:',
        item.group,
        '| categoryId:',
        item.categoryId,
      )
    }
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
