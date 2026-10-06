import { Router } from 'express'
import { requireAdmin } from '../middleware/adminAuth'
import * as c from '../controllers/adminController'
import { adminChat } from '../controllers/chatController'

export const adminRoutes = Router()

adminRoutes.post('/login', c.login)

// ต่อจากนี้ต้องล็อกอินแอดมินแล้วเท่านั้น
adminRoutes.use(requireAdmin)
adminRoutes.get('/me', c.me)
adminRoutes.get('/dashboard', c.dashboard)

adminRoutes.get('/bookings', c.listBookings)
adminRoutes.get('/bookings/:id', c.getBooking)
adminRoutes.post('/bookings/:id/confirm', c.confirmBooking)
adminRoutes.post('/bookings/:id/cancel', c.cancelBooking)

adminRoutes.get('/services', c.listServices)
adminRoutes.post('/services', c.createService)
adminRoutes.patch('/services/:id', c.updateService)
adminRoutes.delete('/services/:id', c.deleteService)

adminRoutes.get('/time-slots', c.listSlots)
adminRoutes.post('/time-slots', c.createSlot)
adminRoutes.patch('/time-slots/:id', c.updateSlot)
adminRoutes.delete('/time-slots/:id', c.deleteSlot)

adminRoutes.get('/business-hours', c.getHours)
adminRoutes.put('/business-hours', c.saveHours)

adminRoutes.get('/holidays', c.listHolidays)
adminRoutes.post('/holidays', c.addHoliday)
adminRoutes.delete('/holidays/:id', c.deleteHoliday)

adminRoutes.get('/settings', c.getSettings)
adminRoutes.patch('/settings', c.updateSettings)

adminRoutes.get('/chats', adminChat.threads)
adminRoutes.get('/chats/unread', adminChat.unread)
adminRoutes.get('/bookings/:id/messages', adminChat.history)
adminRoutes.post('/bookings/:id/messages', adminChat.send)
