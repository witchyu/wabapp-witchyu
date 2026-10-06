import type { Booking, ServiceGroup } from './index'

export interface AdminService {
  id: string
  group: ServiceGroup
  name: string
  desc: string
  price: number
  durationMin: number | null
  unlimited: boolean
  perQuestion: boolean
  questions: string[]
  active: boolean
  recommended: boolean
  sortOrder: number
}
export type AdminServiceInput = Omit<AdminService, 'id' | 'sortOrder'>

export interface AdminSlot { id: number; time: string; capacity: number; active: boolean }
export interface AdminHours { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }
export interface AdminHoliday { id: number; date: string; reason: string }
export interface AdminSettings { shopOpen: boolean; callsEnabled: boolean }

export type AdminBookingFilter = 'active' | 'all' | 'pending_payment' | 'confirmed' | 'completed' | 'cancelled'

export interface AdminDashboard {
  today: string
  stats: { todayCount: number; pendingCount: number; upcomingCount: number }
  next: Booking[]
  settings: AdminSettings
}
export interface AdminBookingList { bookings: Booking[]; total: number; page: number; pageSize: number }
