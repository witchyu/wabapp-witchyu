import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Booking, CustomerInfo, Draft } from '../types'
import { getService, isMultiGroup, selectedServices } from '../data/services'
import { EMPTY_CUSTOMER } from '../utils/bookingRules'
import { blankDraft, clearLegacyStorage, loadCustomer, loadDraft, saveCustomer, saveDraft } from '../utils/storage'
import { ApiError, errorMessage } from '../services/api'
import { bookingApi, type CreateBookingPayload } from '../services/bookingApi'

export type CreateResult = { ok: true; booking: Booking } | { ok: false; error: string; step: number }
export type LoadStatus = 'loading' | 'ready' | 'error'

interface Ctx {
  draft: Draft
  patchDraft: (p: Partial<Draft>) => void
  setMulti: (on: boolean) => void
  resetDraft: () => void
  profile: CustomerInfo
  setProfile: (c: CustomerInfo) => void
  bookings: Booking[]
  bookingsStatus: LoadStatus
  bookingsError: string
  refreshBookings: () => Promise<void>
  createBooking: () => Promise<CreateResult>
  cancelBooking: (id: string) => Promise<Booking>
  payBooking: (id: string) => Promise<Booking>
}

const BookingCtx = createContext<Ctx | null>(null)
export const useBooking = () => {
  const c = useContext(BookingCtx)
  if (!c) throw new Error('useBooking must be inside BookingProvider')
  return c
}

// รหัสข้อผิดพลาดจากเซิร์ฟเวอร์ → ขั้นตอนในหน้าจองที่ต้องย้อนกลับไปแก้
function stepForCode(code: string): number {
  if (code === 'VALIDATION_CUSTOMER' || code === 'SHOP_CLOSED') return 0
  if (['SERVICE_NOT_FOUND', 'SERVICE_UNAVAILABLE', 'SELECTION_INVALID', 'CALLS_DISABLED', 'VALIDATION_SERVICE'].includes(code)) return 1
  if (['SLOT_FULL', 'SLOT_CLOSED', 'DAY_CLOSED', 'DATE_OUT_OF_RANGE', 'VALIDATION_SCHEDULE'].includes(code)) return 2
  return 4
}

const upsert = (list: Booking[], b: Booking) => [b, ...list.filter((x) => x.id !== b.id)].sort((x, y) => y.createdAt - x.createdAt)

export function BookingProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<CustomerInfo>(() => loadCustomer() ?? EMPTY_CUSTOMER)
  const [draft, setDraft] = useState<Draft>(() => loadDraft(loadCustomer() ?? EMPTY_CUSTOMER))
  const [bookings, setBookings] = useState<Booking[]>([])
  const [bookingsStatus, setStatus] = useState<LoadStatus>('loading')
  const [bookingsError, setError] = useState('')

  useEffect(clearLegacyStorage, [])
  useEffect(() => saveDraft(draft), [draft])

  const refreshBookings = useCallback(async () => {
    try {
      setBookings(await bookingApi.list())
      setStatus('ready')
      setError('')
    } catch (e) {
      // ถ้าเคยโหลดสำเร็จแล้ว ให้คงข้อมูลเดิมไว้ ไม่เด้งเป็นหน้า error
      setStatus((s) => (s === 'ready' ? 'ready' : 'error'))
      setError(errorMessage(e))
    }
  }, [])

  // โหลดตอนเปิดแอป และรีเฟรชเมื่อกลับมาที่แท็บ / ทุก 60 วินาทีขณะเปิดหน้าอยู่ (รับสถานะหมดเวลา/เสร็จสิ้นจากเซิร์ฟเวอร์)
  useEffect(() => {
    refreshBookings()
    const onVisible = () => { if (document.visibilityState === 'visible') refreshBookings() }
    document.addEventListener('visibilitychange', onVisible)
    const t = setInterval(onVisible, 60000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(t)
    }
  }, [refreshBookings])

  const patchDraft = useCallback((p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p })), [])
  const resetDraft = useCallback(() => setDraft(blankDraft(loadCustomer() ?? EMPTY_CUSTOMER)), [])

  // เปิดโหมด: ตัดรายการที่อยู่ในเซ็ตที่เลือกหลายรายการไม่ได้ออก / ยกเลิก: ล้างการเลือกทั้งหมด
  const setMulti = useCallback((on: boolean) => {
    setDraft((d) => on
      ? { ...d, multi: true, time: '', serviceIds: d.serviceIds.filter((id) => isMultiGroup(getService(id)?.group)) }
      : { ...d, multi: false, time: '', serviceIds: [] })
  }, [])

  const setProfile = useCallback((c: CustomerInfo) => {
    setProfileState(c)
    saveCustomer(c)
  }, [])

  const createBooking = useCallback(async (): Promise<CreateResult> => {
    const svcs = selectedServices(draft.serviceIds)
    const payload: CreateBookingPayload = {
      customer: draft.customer,
      serviceIds: draft.serviceIds,
      questionCount: svcs.some((s) => s.perQuestion) ? draft.questionCount : undefined,
      otherQuestion: draft.serviceIds.includes('ch-other') ? draft.otherQuestion.trim() : undefined,
      date: draft.date,
      time: draft.time,
      note: draft.note.trim(),
    }
    try {
      const booking = await bookingApi.create(payload)
      setBookings((l) => upsert(l, booking))
      setStatus('ready')
      if (draft.remember) setProfile(booking.customer)
      return { ok: true, booking }
    } catch (e) {
      const code = e instanceof ApiError ? e.code : ''
      return { ok: false, error: errorMessage(e), step: stepForCode(code) }
    }
  }, [draft, setProfile])

  const cancelBooking = useCallback(async (id: string) => {
    const b = await bookingApi.cancel(id)
    setBookings((l) => upsert(l, b))
    return b
  }, [])

  const payBooking = useCallback(async (id: string) => {
    const b = await bookingApi.mockPay(id)
    setBookings((l) => upsert(l, b))
    return b
  }, [])

  return (
    <BookingCtx.Provider value={{ draft, patchDraft, setMulti, resetDraft, profile, setProfile, bookings, bookingsStatus, bookingsError, refreshBookings, createBooking, cancelBooking, payBooking }}>
      {children}
    </BookingCtx.Provider>
  )
}
