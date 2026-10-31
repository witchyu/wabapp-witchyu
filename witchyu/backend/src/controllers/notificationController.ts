import type { Request } from 'express'
import { AppError } from '../domain/errors'
import { asyncHandler } from '../middleware/asyncHandler'
import * as notifications from '../services/notificationService'

const clientId = (req: Request) => req.clientId as string

const notificationId = (value: unknown) => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(value)) {
    throw new AppError(400, 'INVALID_NOTIFICATION_ID', 'รหัสแจ้งเตือนไม่ถูกต้อง')
  }
  return value
}

const preferenceKeys = [
  'bookingEnabled',
  'paymentEnabled',
  'reminderEnabled',
  'chatEnabled',
  'systemEnabled',
] as const

export const list = asyncHandler(async (req, res) => {
  const rawLimit = Number(req.query.limit ?? 30)
  const limit = Number.isFinite(rawLimit)
    ? Math.min(50, Math.max(1, Math.floor(rawLimit)))
    : 30

  const cursor = req.query.cursor
    ? notificationId(req.query.cursor)
    : undefined

  res.json(await notifications.listNotifications(clientId(req), limit, cursor))
})

export const unread = asyncHandler(async (req, res) => {
  res.json(await notifications.countUnread(clientId(req)))
})

export const markRead = asyncHandler(async (req, res) => {
  res.json(await notifications.markNotificationRead(
    clientId(req),
    notificationId(req.params.id),
  ))
})

export const markAllRead = asyncHandler(async (req, res) => {
  res.json(await notifications.markAllNotificationsRead(clientId(req)))
})

export const remove = asyncHandler(async (req, res) => {
  res.json(await notifications.deleteNotification(
    clientId(req),
    notificationId(req.params.id),
  ))
})

export const getPreferences = asyncHandler(async (req, res) => {
  res.json({ preferences: await notifications.getPreferences(clientId(req)) })
})

export const savePreferences = asyncHandler(async (req, res) => {
  const body = req.body ?? {}
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(400, 'VALIDATION', 'ข้อมูลไม่ถูกต้อง')
  }

  const input: Record<string, boolean> = {}

  for (const key of preferenceKeys) {
    if (key in body) {
      if (typeof body[key] !== 'boolean') {
        throw new AppError(400, 'VALIDATION', 'ค่าการตั้งค่าต้องเป็น true หรือ false')
      }
      input[key] = body[key]
    }
  }

  if (Object.keys(input).length === 0) {
    throw new AppError(400, 'VALIDATION', 'กรุณาระบุการตั้งค่าที่ต้องการเปลี่ยน')
  }

  res.json({
    preferences: await notifications.updatePreferences(
      clientId(req),
      input,
    ),
  })
})
