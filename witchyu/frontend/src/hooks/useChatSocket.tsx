import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Socket } from 'socket.io-client'
import { createSocket } from '../services/socket'
import type { ChatMessage, ChatRole } from '../types/chat'

interface Ctx {
  socket: Socket | null
  connected: boolean
  adminsOnline: boolean // มีแอดมินออนไลน์อยู่หรือไม่ (ใช้แสดงสถานะ "หมอดูออนไลน์")
  unread: number        // ข้อความที่ยังไม่อ่าน (ของฝั่งตัวเอง)
  refreshUnread: () => void
}

const ChatSocketCtx = createContext<Ctx>({ socket: null, connected: false, adminsOnline: false, unread: 0, refreshUnread: () => {} })
export const useChatSocket = () => useContext(ChatSocketCtx)

// เชื่อมต่อ Socket.IO หนึ่งการเชื่อมต่อต่อหนึ่งฝั่ง (ลูกค้า / แอดมิน) ตลอดที่เปิดแอป — เชื่อมใหม่เองเมื่อเน็ตหลุด
export function ChatSocketProvider({ role, fetchUnread, children }: { role: ChatRole; fetchUnread: () => Promise<number>; children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [adminsOnline, setAdminsOnline] = useState(false)
  const [unread, setUnread] = useState(0)
  const fetchRef = useRef(fetchUnread)
  fetchRef.current = fetchUnread
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshUnread = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      fetchRef.current().then(setUnread).catch(() => { /* ใช้ค่าเดิมต่อ */ })
    }, 400) // รวมหลาย event ที่มาติดกันให้เหลือการดึงครั้งเดียว
  }, [])

  useEffect(() => {
    const s = createSocket(role)
    setSocket(s)
    s.on('connect', () => { setConnected(true); refreshUnread() })
    s.on('disconnect', () => setConnected(false))
    s.on('connect_error', () => setConnected(false))
    s.on('presence:admins', (p: { online: boolean }) => setAdminsOnline(!!p?.online))
    s.on('message:new', (m: ChatMessage) => { if (m?.senderRole !== role) refreshUnread() })
    s.on('message:read', (p: { readerRole: ChatRole }) => { if (p?.readerRole === role) refreshUnread() })
    refreshUnread()
    return () => {
      if (timer.current) clearTimeout(timer.current)
      s.removeAllListeners()
      s.disconnect()
      setSocket(null)
      setConnected(false)
    }
  }, [role, refreshUnread])

  return <ChatSocketCtx.Provider value={{ socket, connected, adminsOnline, unread, refreshUnread }}>{children}</ChatSocketCtx.Provider>
}
