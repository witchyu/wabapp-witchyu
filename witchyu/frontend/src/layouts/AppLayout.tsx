import { Outlet, useLocation } from 'react-router-dom'
import BottomNav from '../components/BottomNav'

// หน้าที่เป็น flow เฉพาะ (จอง/ชำระเงิน/สำเร็จ) ซ่อนแถบเมนูล่างเพื่อให้โฟกัส
const HIDE_NAV = [/^\/booking$/, /^\/payment\//, /^\/success\//]
// หน้ารายการ/ฟอร์มเลือกบริการใช้เต็มจอ ส่วนหน้าที่เนื้อหาเป็นคอลัมน์เดียวจำกัดความกว้างให้อ่านง่ายบน iPad
const WIDE = ['/', '/services', '/bookings', '/booking']

export default function AppLayout() {
  const { pathname } = useLocation()
  const showNav = !HIDE_NAV.some((r) => r.test(pathname))
  const wide = WIDE.includes(pathname)
  return (
    <div className="min-h-full w-full bg-night">
      <main className={`mx-auto w-full ${wide ? '' : 'max-w-2xl'} ${showNav ? 'pb-24' : 'pb-6'}`}>
        <Outlet />
      </main>
      {showNav && <BottomNav />}
    </div>
  )
}
