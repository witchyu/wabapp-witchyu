import { prisma } from '../db'
import { getIo, userRoom } from '../socket/realtime'

export type NotificationType =
  | 'booking'
  | 'payment'
  | 'reminder'
  | 'chat'
  | 'system'

export interface CreateNotificationInput {
  clientId: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, unknown>
}

const preferenceField: Record<NotificationType, string> = {
  booking: 'bookingEnabled',
  payment: 'paymentEnabled',
  reminder: 'reminderEnabled',
  chat: 'chatEnabled',
  system: 'systemEnabled',
}


// Notification เป็นงานเสริม: หากบันทึก/ส่ง realtime ไม่สำเร็จ
// ต้องไม่ทำให้การจอง การชำระเงิน หรือการส่งข้อความหลักล้มเหลว
export async function safeCreateNotification(input: CreateNotificationInput) {
  try {
    return await createNotification(input)
  } catch (error) {
    console.error('[notification] create failed:', error)
    return null
  }
}

export async function createNotification(input: CreateNotificationInput) {
  const preferences = await prisma.notificationPreference.findUnique({
    where: { clientId: input.clientId },
  })

  const enabled = preferences
    ? preferences[preferenceField[input.type] as keyof typeof preferences]
    : true

  if (!enabled) return null

  const notification = await prisma.notification.create({
    data: {
      clientId: input.clientId,
      type: input.type,
      title: input.title.trim(),
      message: input.message.trim(),
      ...(input.data ? { data: JSON.parse(JSON.stringify(input.data)) } : {}),
    },
  })

  getIo()?.to(userRoom(input.clientId)).emit('notification:new', notification)

  return notification
}

export async function listNotifications(clientId: string, limit = 30, cursor?: string) {
  const notifications = await prisma.notification.findMany({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  })

  return { notifications }
}

export async function countUnread(clientId: string) {
  const unread = await prisma.notification.count({
    where: { clientId, readAt: null },
  })
  return { unread }
}

export async function markNotificationRead(clientId: string, id: string) {
  const result = await prisma.notification.updateMany({
    where: { id, clientId, readAt: null },
    data: { readAt: new Date() },
  })
  return { updated: result.count > 0 }
}

export async function markAllNotificationsRead(clientId: string) {
  const result = await prisma.notification.updateMany({
    where: { clientId, readAt: null },
    data: { readAt: new Date() },
  })
  return { updated: result.count }
}

export async function deleteNotification(clientId: string, id: string) {
  const result = await prisma.notification.deleteMany({
    where: { id, clientId },
  })
  return { deleted: result.count > 0 }
}

export async function getPreferences(clientId: string) {
  return prisma.notificationPreference.upsert({
    where: { clientId },
    create: { clientId },
    update: {},
  })
}

export async function updatePreferences(
  clientId: string,
  input: Partial<{
    bookingEnabled: boolean
    paymentEnabled: boolean
    reminderEnabled: boolean
    chatEnabled: boolean
    systemEnabled: boolean
  }>,
) {
  return prisma.notificationPreference.upsert({
    where: { clientId },
    create: { clientId, ...input },
    update: input,
  })
}
