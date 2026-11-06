import { prisma } from '../db'
import { AppError } from '../domain/errors'
import { loadDaySlots } from './dayService'

export async function getTimeSlots(date: string, serviceIds: string[]) {
  let services: { id: string; scheduleMode: 'shop' | 'custom' }[] = []

  if (serviceIds.length > 0) {
    const found = await prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: {
        id: true,
        scheduleMode: true,
      },
    })
    if (found.length !== new Set(serviceIds).size) {
      throw new AppError(422, 'SERVICE_NOT_FOUND', 'ไม่พบบริการที่เลือก')
    }
    services = found.map(({ id, scheduleMode }) => ({
      id,
      scheduleMode: scheduleMode as 'shop' | 'custom',
    }))
  }

  const day = await loadDaySlots(prisma, date, { services, nowMs: Date.now() })
  return { date: day.date, closed: day.closed, reason: day.reason, slots: day.slots }
}
