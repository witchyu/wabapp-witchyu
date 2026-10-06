import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import Home from './pages/Home'
import Services from './pages/Services'
import Booking from './pages/Booking'
import Payment from './pages/Payment'
import Success from './pages/Success'
import Bookings from './pages/Bookings'
import BookingDetail from './pages/BookingDetail'
import Chat from './pages/Chat'
import ChatRoom from './pages/ChatRoom'
import Profile from './pages/Profile'
import NotFound from './pages/NotFound'
import AdminApp from './pages/admin/AdminApp'
import { ToastProvider } from './hooks/useToast'
import { BookingProvider } from './hooks/useBooking'
import { ServicesGate, ServicesProvider } from './hooks/useServices'
import { ChatSocketProvider } from './hooks/useChatSocket'
import { customerChatApi } from './services/chatApi'

// แอปลูกค้า (ต้องโหลดบริการ/สถานะร้านจากเซิร์ฟเวอร์ก่อนแสดงหน้า)
function CustomerApp() {
  return (
    <ServicesProvider>
      <ServicesGate>
        <BookingProvider>
          <ChatSocketProvider role="customer" fetchUnread={customerChatApi.unread}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/services" element={<Services />} />
              <Route path="/booking" element={<Booking />} />
              <Route path="/payment/:id" element={<Payment />} />
              <Route path="/success/:id" element={<Success />} />
              <Route path="/bookings" element={<Bookings />} />
              <Route path="/bookings/:id" element={<BookingDetail />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/chat/:id" element={<ChatRoom />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
          </ChatSocketProvider>
        </BookingProvider>
      </ServicesGate>
    </ServicesProvider>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Admin แยกจากแอปลูกค้า: เส้นทาง /admin และไม่ผูกกับ BookingProvider */}
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="/*" element={<CustomerApp />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}
