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
import Profile from './pages/Profile'
import NotFound from './pages/NotFound'
import { ToastProvider } from './hooks/useToast'
import { BookingProvider } from './hooks/useBooking'

export default function App() {
  return (
    <ToastProvider>
      <BookingProvider>
        <BrowserRouter>
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
              <Route path="/profile" element={<Profile />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </BookingProvider>
    </ToastProvider>
  )
}
