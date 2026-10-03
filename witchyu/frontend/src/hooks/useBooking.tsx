import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Booking, BookingStatus, CustomerInfo, Draft } from '../types'
import { getService, isMultiGroup } from '../data/services'
import { EMPTY_CUSTOMER, buildBooking, settleBookings, validateDraft } from '../utils/bookingRules'
import { BOOKINGS_KEY, blankDraft, loadBookings, loadCustomer, loadDraft, saveBookings, saveCustomer, saveDraft } from '../utils/storage'

export type CreateResult = { ok: true; booking: Booking } | { ok: false; error: string; step: number }

interface Ctx {
  draft: Draft
  patchDraft: (p: Partial<Draft>) => void
  setMulti: (on: boolean) => void
  resetDraft: () => void
  profile: CustomerInfo
  setProfile: (c: CustomerInfo) => void
  bookings: Booking[]
  createBooking: () => CreateResult
  setStatus: (id: string, status: BookingStatus) => void
}

const BookingCtx = createContext<Ctx | null>(null)
export const useBooking = () => {
  const c = useContext(BookingCtx)
  if (!c) throw new Error('useBooking must be inside BookingProvider')
  return c
}

export function BookingProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<CustomerInfo>(() => loadCustomer() ?? EMPTY_CUSTOMER)
  const [draft, setDraft] = useState<Draft>(() => loadDraft(loadCustomer() ?? EMPTY_CUSTOMER))
  const [bookings, setBookings] = useState<Booking[]>(() => settleBookings(loadBookings(), Date.now()))

  // บันทึกลง LocalStorage ทุกครั้งที่ข้อมูลเปลี่ยน
  useEffect(() => saveBookings(bookings), [bookings])
  useEffect(() => saveDraft(draft), [draft])

  // อัปเดตสถานะตามเวลา (หมดเวลาชำระ / เลยเวลานัด)
  useEffect(() => {
    const t = setInterval(() => setBookings((b) => settleBookings(b, Date.now())), 15000)
    return () => clearInterval(t)
  }, [])

  // เปิดหลายแท็บ: รับข้อมูลที่แท็บอื่นเพิ่งบันทึก
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === BOOKINGS_KEY) setBookings(settleBookings(loadBookings(), Date.now()))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

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

  const createBooking = useCallback((): CreateResult => {
    const now = Date.now()
    // อ่านข้อมูลล่าสุดจากที่เก็บก่อนตรวจ กันกรณีแท็บอื่นเพิ่งจองรอบเดียวกัน
    const current = settleBookings(loadBookings(), now)
    const err = validateDraft(draft, current, now)
    if (err) {
      setBookings(current)
      return { ok: false, error: err.message, step: err.step }
    }
    const booking = buildBooking(draft, current, now)
    const next = [booking, ...current]
    saveBookings(next)
    setBookings(next)
    if (draft.remember) setProfile(booking.customer)
    return { ok: true, booking }
  }, [draft, setProfile])

  const setStatus = useCallback((id: string, status: BookingStatus) => {
    setBookings((list) => list.map((x) => (x.id === id ? { ...x, status } : x)))
  }, [])

  return (
    <BookingCtx.Provider value={{ draft, patchDraft, setMulti, resetDraft, profile, setProfile, bookings, createBooking, setStatus }}>
      {children}
    </BookingCtx.Provider>
  )
}
