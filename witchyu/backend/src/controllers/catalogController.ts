import { asyncHandler } from '../middleware/asyncHandler'
import { listActiveServices } from '../services/catalogService'
import { getTimeSlots } from '../services/slotService'
import { parseSlotsQuery } from '../domain/validation'

export const getServices = asyncHandler(async (_req, res) => {
  res.json({ services: await listActiveServices() })
})

export const getSlots = asyncHandler(async (req, res) => {
  const { date, serviceIds } = parseSlotsQuery(req.query as Record<string, unknown>)
  res.json(await getTimeSlots(date, serviceIds))
})
