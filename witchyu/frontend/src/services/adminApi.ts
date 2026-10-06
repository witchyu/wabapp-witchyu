import type { Booking } from '../types'
import type { ChatMessage, ChatPage, ChatThread } from '../types/chat'
import type {
  AdminBookingFilter, AdminBookingList, AdminDashboard, AdminHoliday, AdminHours, AdminService, AdminServiceInput,
  AdminSettings, AdminSlot,
} from '../types/admin'
import { ApiError, api } from './api'

const KEY = 'witchyu.adminToken'

export const adminToken = {
  get(): string {
    try { return localStorage.getItem(KEY) ?? '' } catch { return '' }
  },
  set(t: string) {
    try { localStorage.setItem(KEY, t) } catch { /* ignore */ }
  },
  clear() {
    try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  },
}

// ถูกเรียกเมื่อเซิร์ฟเวอร์ตอบ 401 (โทเคนหมดอายุ/ไม่ถูกต้อง) เพื่อพากลับหน้าล็อกอิน
let onUnauthorized: (() => void) | null = null
export const setUnauthorizedHandler = (fn: (() => void) | null) => { onUnauthorized = fn }

const auth = () => ({ Authorization: `Bearer ${adminToken.get()}` })

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) onUnauthorized?.()
    throw e
  }
}

const A = '/admin'

export const adminApi = {
  login: (username: string, password: string) =>
    api.post<{ token: string; expiresAt: number; admin: { username: string; displayName: string } }>(`${A}/login`, { username, password }),
  me: () => guard(() => api.get<{ admin: { displayName: string } }>(`${A}/me`, auth())),
  dashboard: () => guard(() => api.get<AdminDashboard>(`${A}/dashboard`, auth())),

  bookings: (q: { status: AdminBookingFilter; date: string; search: string; page: number }) => {
    const p = new URLSearchParams({ status: q.status, page: String(q.page) })
    if (q.date) p.set('date', q.date)
    if (q.search) p.set('search', q.search)
    return guard(() => api.get<AdminBookingList>(`${A}/bookings?${p.toString()}`, auth()))
  },
  confirmBooking: (id: string) => guard(() => api.post<{ booking: Booking }>(`${A}/bookings/${encodeURIComponent(id)}/confirm`, {}, auth())),
  cancelBooking: (id: string) => guard(() => api.post<{ booking: Booking }>(`${A}/bookings/${encodeURIComponent(id)}/cancel`, {}, auth())),

  services: () => guard(() => api.get<{ services: AdminService[] }>(`${A}/services`, auth())).then((r) => r.services),
  createService: (s: AdminServiceInput) => guard(() => api.post<{ service: AdminService }>(`${A}/services`, s, auth())).then((r) => r.service),
  updateService: (id: string, s: Partial<AdminServiceInput>) =>
    guard(() => api.patch<{ service: AdminService }>(`${A}/services/${encodeURIComponent(id)}`, s, auth())).then((r) => r.service),
  deleteService: (id: string) => guard(() => api.del<{ ok: true }>(`${A}/services/${encodeURIComponent(id)}`, auth())),

  slots: () => guard(() => api.get<{ slots: AdminSlot[] }>(`${A}/time-slots`, auth())).then((r) => r.slots),
  createSlot: (s: { time: string; capacity: number }) => guard(() => api.post<{ slot: AdminSlot }>(`${A}/time-slots`, s, auth())).then((r) => r.slot),
  updateSlot: (id: number, s: { capacity?: number; active?: boolean }) =>
    guard(() => api.patch<{ slot: AdminSlot }>(`${A}/time-slots/${id}`, s, auth())).then((r) => r.slot),
  deleteSlot: (id: number) => guard(() => api.del<{ ok: true }>(`${A}/time-slots/${id}`, auth())),

  hours: () => guard(() => api.get<{ hours: AdminHours[] }>(`${A}/business-hours`, auth())).then((r) => r.hours),
  saveHours: (hours: AdminHours[]) => guard(() => api.put<{ hours: AdminHours[] }>(`${A}/business-hours`, { hours }, auth())).then((r) => r.hours),

  holidays: () => guard(() => api.get<{ holidays: AdminHoliday[] }>(`${A}/holidays`, auth())).then((r) => r.holidays),
  addHoliday: (h: { date: string; reason: string }) =>
    guard(() => api.post<{ holiday: AdminHoliday; affectedBookings: number }>(`${A}/holidays`, h, auth())),
  deleteHoliday: (id: number) => guard(() => api.del<{ ok: true }>(`${A}/holidays/${id}`, auth())),

  chats: () => guard(() => api.get<{ threads: ChatThread[] }>(`${A}/chats`, auth())).then((r) => r.threads),
  chatUnread: () => guard(() => api.get<{ unread: number }>(`${A}/chats/unread`, auth())).then((r) => r.unread),
  chatHistory: (id: string, before?: string) =>
    guard(() => api.get<ChatPage>(`${A}/bookings/${encodeURIComponent(id)}/messages?limit=30${before ? `&before=${encodeURIComponent(before)}` : ''}`, auth())),
  chatSend: (id: string, body: string, clientMsgId: string) =>
    guard(() => api.post<{ message: ChatMessage }>(`${A}/bookings/${encodeURIComponent(id)}/messages`, { body, clientMsgId }, auth())).then((r) => r.message),

  settings: () => guard(() => api.get<{ settings: AdminSettings }>(`${A}/settings`, auth())).then((r) => r.settings),
  updateSettings: (s: Partial<AdminSettings>) =>
    guard(() => api.patch<{ settings: AdminSettings }>(`${A}/settings`, s, auth())).then((r) => r.settings),
}
