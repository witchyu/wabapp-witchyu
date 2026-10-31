import { Router } from 'express'
import multer from 'multer'
import { AppError } from '../domain/errors'
import * as paymentProof from '../controllers/paymentProofController'
import { prisma } from '../db'
import { asyncHandler } from '../middleware/asyncHandler'
import { requireClientId } from '../middleware/clientId'
import { getServices, getSlots } from '../controllers/catalogController'
import * as booking from '../controllers/bookingController'
import { adminRoutes } from './admin'
import { customerChat } from '../controllers/chatController'
import { getPublicShop } from '../services/shopService'
import { customerAuthRoutes } from './customerAuth'
import { notificationRoutes } from './notifications'


const paymentSlipUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.mimetype)) {
      return callback(new AppError(415, 'UNSUPPORTED_FILE', 'รองรับเฉพาะ JPG, PNG และ WebP'))
    }
    callback(null, true)
  },
}).single('slip')

export const api = Router()
api.use('/auth', customerAuthRoutes)
api.use('/notifications', notificationRoutes)

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
bookings.post('/:id/payment-slip', paymentSlipUpload, paymentProof.upload)
bookings.get('/:id/payment-slip', paymentProof.list)
bookings.delete('/:id/payment-slip', paymentProof.remove)
bookings.get('/:id/messages', customerChat.history)
bookings.post('/:id/messages', customerChat.send)
api.use('/bookings', bookings)

const chats = Router()
chats.use(requireClientId)
chats.get('/', customerChat.threads)
chats.get('/unread', customerChat.unread)
api.use('/chats', chats)

api.use('/admin', adminRoutes)
