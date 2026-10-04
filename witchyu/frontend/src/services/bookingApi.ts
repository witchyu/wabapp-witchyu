import type { Booking, CustomerInfo, DaySlots, Service } from '../types'
import type { ShopStatus } from '../data/shop'
import { api } from './api'

export interface CreateBookingPayload {
  customer: CustomerInfo
  serviceIds: string[]
  questionCount?: number
  otherQuestion?: string
  date: string
  time: string
  note: string
}

export interface UpdateBookingPayload {
  note?: string
  customer?: CustomerInfo
  date?: string
  time?: string
}

export const bookingApi = {
  services: () => api.get<{ services: Service[] }>('/services').then((r) => r.services),
  shop: () => api.get<ShopStatus>('/shop'),
  slots: (date: string, serviceIds: string[]) =>
    api.get<DaySlots>(`/time-slots?date=${encodeURIComponent(date)}&serviceIds=${serviceIds.map(encodeURIComponent).join(',')}`),
  list: () => api.get<{ bookings: Booking[] }>('/bookings').then((r) => r.bookings),
  get: (id: string) => api.get<{ booking: Booking }>(`/bookings/${encodeURIComponent(id)}`).then((r) => r.booking),
  create: (p: CreateBookingPayload) => api.post<{ booking: Booking }>('/bookings', p).then((r) => r.booking),
  update: (id: string, p: UpdateBookingPayload) => api.patch<{ booking: Booking }>(`/bookings/${encodeURIComponent(id)}`, p).then((r) => r.booking),
  cancel: (id: string) => api.post<{ booking: Booking }>(`/bookings/${encodeURIComponent(id)}/cancel`).then((r) => r.booking),
  mockPay: (id: string) => api.post<{ booking: Booking }>(`/bookings/${encodeURIComponent(id)}/mock-pay`).then((r) => r.booking),
}
