import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Booking, CustomerInfo } from '../types'
import { EMPTY_CUSTOMER, seedBookings } from '../services/mockBookings'
import { toISO } from '../utils/format'
import { getService, isMultiGroup } from '../data/services'

const SAVED_KEY = 'witchyu.customer'

export interface Draft {
  customer: CustomerInfo
  remember: boolean
  serviceIds: string[]
  multi: boolean            // โหมดเลือกหลายรายการ
  questionCount: number
  date: string
  time: string
  note: string
}

interface Ctx {
  draft: Draft
  patchDraft: (p: Partial<Draft>) => void
  setMulti: (on: boolean) => void
  resetDraft: () => void
  profile: CustomerInfo
  setProfile: (c: CustomerInfo) => void
  bookings: Booking[]
  addBooking: (b: Omit<Booking, 'id' | 'status'>) => Booking
  setStatus: (id: string, status: Booking['status']) => void
}

const BookingCtx = createContext<Ctx | null>(null)
export const useBooking = () => {
  const c = useContext(BookingCtx)
  if (!c) throw new Error('useBooking must be inside BookingProvider')
  return c
}

function loadSaved(): CustomerInfo | null {
  try {
    const raw = localStorage.getItem(SAVED_KEY)
    return raw ? { ...EMPTY_CUSTOMER, ...JSON.parse(raw) } : null
  } catch {
    return null
  }
}

const blankDraft = (customer: CustomerInfo): Draft => ({
  customer, remember: true, serviceIds: [], multi: false, questionCount: 1, date: toISO(new Date()), time: '', note: '',
})

export function BookingProvider({ children }: { children: ReactNode }) {
  const saved = useMemo(loadSaved, [])
  const [profile, setProfileState] = useState<CustomerInfo>(saved ?? seedBookings()[0].customer)
  const [draft, setDraft] = useState<Draft>(() => blankDraft(saved ?? EMPTY_CUSTOMER))
  const [bookings, setBookings] = useState<Booking[]>(seedBookings)

  const persist = (c: CustomerInfo) => {
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(c)) } catch { /* ignore */ }
  }

  const patchDraft = useCallback((p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p })), [])
  // เปิดโหมด: ตัดรายการที่เลือกไว้ในเซ็ตที่เลือกหลายรายการไม่ได้ออก / ยกเลิก: ล้างการเลือกทั้งหมด
  const setMulti = useCallback((on: boolean) => {
    setDraft((d) => on
      ? { ...d, multi: true, time: '', serviceIds: d.serviceIds.filter((id) => isMultiGroup(getService(id)?.group)) }
      : { ...d, multi: false, time: '', serviceIds: [] })
  }, [])
  const resetDraft = useCallback(() => setDraft(blankDraft(loadSaved() ?? EMPTY_CUSTOMER)), [])

  const setProfile = useCallback((c: CustomerInfo) => {
    setProfileState(c)
    persist(c)
  }, [])

  const addBooking: Ctx['addBooking'] = useCallback((b) => {
    const ymd = b.date.split('-').join('')
    const seq = bookings.filter((x) => x.id.startsWith(`WY-${ymd}`)).length + 1
    const created: Booking = { ...b, id: `WY-${ymd}-${String(seq).padStart(3, '0')}`, status: 'pending_payment' }
    setBookings((list) => [created, ...list])
    return created
  }, [bookings])

  const setStatus = useCallback((id: string, status: Booking['status']) => {
    setBookings((list) => list.map((x) => (x.id === id ? { ...x, status } : x)))
  }, [])

  return (
    <BookingCtx.Provider value={{ draft, patchDraft, setMulti, resetDraft, profile, setProfile, bookings, addBooking, setStatus }}>
      {children}
    </BookingCtx.Provider>
  )
}
