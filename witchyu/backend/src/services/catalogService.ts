import { prisma } from '../db'
import { toServiceDto } from '../domain/dto'

export async function listActiveServices() {
  const rows = await prisma.service.findMany({
    where: { active: true },
    include: { category: true },
    orderBy: { sortOrder: 'asc' },
  })
  return rows.map(toServiceDto)
}
