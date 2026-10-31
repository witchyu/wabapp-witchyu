import { api } from './api'

export type NotificationType = 'booking' | 'payment' | 'reminder' | 'chat' | 'system'

export interface NotificationItem {
  id: string
  clientId: string
  type: NotificationType
  title: string
  message: string
  data: Record<string, unknown> | null
  readAt: string | null
  createdAt: string
}

export interface NotificationPreferences {
  bookingEnabled: boolean
  paymentEnabled: boolean
  reminderEnabled: boolean
  chatEnabled: boolean
  systemEnabled: boolean
}

export const notificationApi = {
  list: (limit = 40) =>
    api.get<{ notifications: NotificationItem[] }>(`/notifications?limit=${limit}`)
      .then((r) => r.notifications),

  unread: () =>
    api.get<{ unread: number }>('/notifications/unread').then((r) => r.unread),

  preferences: () =>
    api.get<{ preferences: NotificationPreferences }>('/notifications/preferences')
      .then((r) => r.preferences),

  markRead: (id: string) =>
    api.patch<{ updated: boolean }>(`/notifications/${encodeURIComponent(id)}/read`, {}),

  markAllRead: () =>
    api.patch<{ updated: number }>('/notifications/read-all', {}),

  remove: (id: string) =>
    api.del<{ deleted: boolean }>(`/notifications/${encodeURIComponent(id)}`),

  savePreferences: (preferences: Partial<NotificationPreferences>) =>
    api.patch<{ preferences: NotificationPreferences }>('/notifications/preferences', preferences)
      .then((r) => r.preferences),
}
