import { Router } from 'express'
import { prisma } from '../db'
import { asyncHandler } from '../middleware/asyncHandler'
import { requireClientId } from '../middleware/clientId'
import { getServices, getSlots } from '../controllers/catalogController'
import * as booking from '../controllers/bookingController'
import { adminRoutes } from './admin'
import { getPublicShop } from '../services/shopService'

export const api = Router()

// ไม่แตะฐานข้อมูล: ตัว monitor ที่ยิงถี่ ๆ จะไม่ทำให้ Neon ตื่นค้างจนโควตาชั่วโมงคอมพิวต์หมด
api.get('/health', (_req, res) => {
  res.json({ ok: true })
})
// ตรวจการเชื่อมต่อฐานข้อมูลด้วยตัวเอง (ใช้ตอนตั้งค่า)
api.get('/health/db', asyncHandler(async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`
  res.json({ ok: true, db: true })
}))

api.get('/services', getServices)
api.get('/shop', asyncHandler(async (_req, res) => { res.json(await getPublicShop()) }))
api.get('/time-slots', getSlots)

const bookings = Router()
bookings.use(requireClientId)
bookings.post('/', booking.create)
bookings.get('/', booking.list)
bookings.get('/:id', booking.get)
bookings.patch('/:id', booking.update)
bookings.post('/:id/cancel', booking.cancel)
bookings.post('/:id/mock-pay', booking.mockPay)
api.use('/bookings', bookings)

api.use('/admin', adminRoutes)
