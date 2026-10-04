import { prisma } from '../db'
import { AppError } from '../domain/errors'
import { loadDaySlots } from './dayService'

export async function getTimeSlots(date: string, serviceIds: string[]) {
  let unlimited = false
  if (serviceIds.length > 0) {
    const found = await prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, unlimited: true } })
    if (found.length !== new Set(serviceIds).size) throw new AppError(422, 'SERVICE_NOT_FOUND', 'ไม่พบบริการที่เลือก')
    unlimited = found.some((s) => s.unlimited)
  }
  const day = await loadDaySlots(prisma, date, { unlimited, nowMs: Date.now() })
  return { date: day.date, closed: day.closed, reason: day.reason, slots: day.slots }
}
