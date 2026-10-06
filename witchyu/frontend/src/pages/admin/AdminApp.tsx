import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminAuthProvider } from '../../hooks/useAdminAuth'
import AdminShell from '../../components/admin/AdminShell'
import AdminLogin from './AdminLogin'
import Dashboard from './Dashboard'
import AdminBookings from './AdminBookings'
import AdminServices from './AdminServices'
import AdminSlots from './AdminSlots'
import AdminHours from './AdminHours'
import AdminHolidays from './AdminHolidays'
import AdminChats from './AdminChats'
import AdminChatRoom from './AdminChatRoom'

// ส่วน Admin แยกจากแอปลูกค้าโดยสิ้นเชิง (เส้นทาง /admin)
export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="login" element={<AdminLogin />} />
        <Route element={<AdminShell />}>
          <Route index element={<Dashboard />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="services" element={<AdminServices />} />
          <Route path="slots" element={<AdminSlots />} />
          <Route path="hours" element={<AdminHours />} />
          <Route path="holidays" element={<AdminHolidays />} />
          <Route path="chat" element={<AdminChats />} />
          <Route path="chat/:id" element={<AdminChatRoom />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminAuthProvider>
  )
}
