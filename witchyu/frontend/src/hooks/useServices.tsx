import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Service } from '../types'
import { setServices } from '../data/services'
import { setShop } from '../data/shop'
import { bookingApi } from '../services/bookingApi'
import { errorMessage } from '../services/api'
import { ErrorState, Spinner } from '../components/states'

type Status = 'loading' | 'ready' | 'error'
interface Ctx { status: Status; services: Service[]; error: string; reload: () => void }

const ServicesCtx = createContext<Ctx>({ status: 'loading', services: [], error: '', reload: () => {} })
export const useServices = () => useContext(ServicesCtx)

export function ServicesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ status: Status; services: Service[]; error: string }>({ status: 'loading', services: [], error: '' })

  const load = useCallback(() => {
    setState((s) => ({ ...s, status: 'loading', error: '' }))
    Promise.all([bookingApi.services(), bookingApi.shop()])
      .then(([list, shop]) => {
        setServices(list) // ต้องตั้งค่าก่อนเปลี่ยนสถานะเป็น ready เพื่อให้ฟังก์ชันที่เรียกแบบ synchronous เห็นข้อมูล
        setShop(shop)
        setState({ status: 'ready', services: list, error: '' })
      })
      .catch((e) => setState({ status: 'error', services: [], error: errorMessage(e) }))
  }, [])

  useEffect(load, [load])

  // กลับมาที่แท็บแล้วดึงสถานะร้าน/บริการล่าสุด (กรณี Admin เพิ่งปิดร้านหรือแก้ราคา) โดยไม่เด้งหน้าโหลด
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      Promise.all([bookingApi.services(), bookingApi.shop()])
        .then(([list, shop]) => {
          setServices(list)
          setShop(shop)
          setState({ status: 'ready', services: list, error: '' })
        })
        .catch(() => { /* เงียบไว้ ใช้ข้อมูลเดิมต่อ */ })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  return <ServicesCtx.Provider value={{ ...state, reload: load }}>{children}</ServicesCtx.Provider>
}

// แสดงหน้าแอปเมื่อโหลดบริการจากเซิร์ฟเวอร์สำเร็จเท่านั้น
export function ServicesGate({ children }: { children: ReactNode }) {
  const { status, error, reload } = useServices()
  if (status === 'ready') return <>{children}</>
  return (
    <div className="mx-auto max-w-md pt-24">
      {status === 'loading'
        ? <Spinner label="กำลังเชื่อมต่อเซิร์ฟเวอร์ (ครั้งแรกอาจใช้เวลาสักครู่)" />
        : <ErrorState title="เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" text={error} onRetry={reload} />}
    </div>
  )
}
