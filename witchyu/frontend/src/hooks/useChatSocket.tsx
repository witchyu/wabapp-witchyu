import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Socket } from 'socket.io-client'
import { createSocket } from '../services/socket'
import type { ChatMessage, ChatRole } from '../types/chat'

interface Ctx {
  socket: Socket | null
  connected: boolean
  adminsOnline: boolean // มีแอดมินออนไลน์อยู่หรือไม่ (ใช้แสดงสถานะ "หมอดูออนไลน์")
  unread: number        // ข้อความแชตที่ยังไม่อ่าน
  refreshUnread: () => void
  notificationUnread: number
  refreshNotificationUnread: () => void
}

const ChatSocketCtx = createContext<Ctx>({
  socket: null,
  connected: false,
  adminsOnline: false,
  unread: 0,
  refreshUnread: () => {},
  notificationUnread: 0,
  refreshNotificationUnread: () => {},
})
export const useChatSocket = () => useContext(ChatSocketCtx)

// เชื่อมต่อ Socket.IO หนึ่งการเชื่อมต่อต่อหนึ่งฝั่ง (ลูกค้า / แอดมิน) ตลอดที่เปิดแอป — เชื่อมใหม่เองเมื่อเน็ตหลุด
export function ChatSocketProvider({
  role,
  fetchUnread,
  fetchNotificationUnread,
  children,
}: {
  role: ChatRole
  fetchUnread: () => Promise<number>
  fetchNotificationUnread?: () => Promise<number>
  children: ReactNode
}) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [adminsOnline, setAdminsOnline] = useState(false)
  const [unread, setUnread] = useState(0)
  const [notificationUnread, setNotificationUnread] = useState(0)
  const fetchRef = useRef(fetchUnread)
  fetchRef.current = fetchUnread
  const notificationFetchRef = useRef(fetchNotificationUnread)
  notificationFetchRef.current = fetchNotificationUnread
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notificationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshUnread = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      fetchRef.current().then(setUnread).catch(() => { /* ใช้ค่าเดิมต่อ */ })
    }, 400) // รวมหลาย event ที่มาติดกันให้เหลือการดึงครั้งเดียว
  }, [])

  const refreshNotificationUnread = useCallback(() => {
    if (notificationTimer.current) clearTimeout(notificationTimer.current)
    notificationTimer.current = setTimeout(() => {
      notificationFetchRef.current?.()
        .then(setNotificationUnread)
        .catch(() => { /* ใช้ค่าเดิมต่อ */ })
    }, 350)
  }, [])

  useEffect(() => {
    const s = createSocket(role)
    setSocket(s)
    s.on('connect', () => {
      setConnected(true)
      refreshUnread()
      refreshNotificationUnread()
    })
    s.on('disconnect', () => setConnected(false))
    s.on('connect_error', () => setConnected(false))
    s.on('presence:admins', (p: { online: boolean }) => setAdminsOnline(!!p?.online))
    s.on('message:new', (m: ChatMessage) => { if (m?.senderRole !== role) refreshUnread() })
    s.on('message:read', (p: { readerRole: ChatRole }) => { if (p?.readerRole === role) refreshUnread() })
    s.on('notification:new', () => refreshNotificationUnread())
    refreshUnread()
    refreshNotificationUnread()

    const reconnectWithLatestAuth = () => {
      s.disconnect()
      s.connect()
    }
    if (role === 'customer') {
      window.addEventListener('witchyu:auth-changed', reconnectWithLatestAuth)
    }

    return () => {
      window.removeEventListener('witchyu:auth-changed', reconnectWithLatestAuth)
      if (timer.current) clearTimeout(timer.current)
      if (notificationTimer.current) clearTimeout(notificationTimer.current)
      s.removeAllListeners()
      s.disconnect()
      setSocket(null)
      setConnected(false)
    }
  }, [role, refreshUnread])

  return (
    <ChatSocketCtx.Provider value={{
      socket,
      connected,
      adminsOnline,
      unread,
      refreshUnread,
      notificationUnread,
      refreshNotificationUnread,
    }}>
      {children}
    </ChatSocketCtx.Provider>
  )
}
