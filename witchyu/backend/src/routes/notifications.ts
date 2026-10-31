import { Router } from 'express'
import * as notification from '../controllers/notificationController'
import { requireClientId } from '../middleware/clientId'

export const notificationRoutes = Router()

notificationRoutes.use(requireClientId)

notificationRoutes.get('/', notification.list)
notificationRoutes.get('/unread', notification.unread)
notificationRoutes.get('/preferences', notification.getPreferences)
notificationRoutes.patch('/preferences', notification.savePreferences)
notificationRoutes.patch('/read-all', notification.markAllRead)
notificationRoutes.patch('/:id/read', notification.markRead)
notificationRoutes.delete('/:id', notification.remove)
