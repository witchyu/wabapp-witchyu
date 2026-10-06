import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../services/api'
import type { Booking } from '../types'
import type { ChatMessage, ChatPage, ChatRole } from '../types/chat'
import { markOwnRead, mergeMessages, newClientMsgId } from '../utils/chat'
import { useChatSocket } from './useChatSocket'

interface Opts {
  role: ChatRole
  bookingId: string
  fetchPage: (before?: string) => Promise<ChatPage>
  sendApi: (body: string, clientMsgId: string) => Promise<ChatMessage>
}

const TYPING_IDLE_MS = 2500
const TYPING_STALE_MS = 5000

// ตรรกะของห้องแชตหนึ่งห้อง: โหลดประวัติ, รับ-ส่งแบบเรียลไทม์, อ่านแล้ว, กำลังพิมพ์, เชื่อมต่อใหม่แล้วดึงข้อความที่ตกหล่น
export function useConversation({ role, bookingId, fetchPage, sendApi }: Opts) {
  const { socket, connected, adminsOnline } = useChatSocket()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [booking, setBooking] = useState<Booking | null>(null)
  const [canSend, setCanSend] = useState(false)
  const [cannotSendReason, setReason] = useState('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [peerTyping, setPeerTyping] = useState(false)
  const [customerOnline, setCustomerOnline] = useState(false)
  const [sendError, setSendError] = useState('')
  const [tick, setTick] = useState(0)
  const nextBefore = useRef<string | undefined>(undefined)
  const wasConnected = useRef(false)
  const typingOn = useRef(false)
  const typingIdle = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typingStale = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchRef = useRef(fetchPage)
  fetchRef.current = fetchPage
  const sendRef = useRef(sendApi)
  sendRef.current = sendApi

  const applyMeta = (p: ChatPage) => {
    setBooking(p.booking)
    setCanSend(p.canSend)
    setReason(p.cannotSendReason ?? '')
  }

  // โหลดข้อความล่าสุด (ครั้งแรก / กดลองใหม่)
  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setMessages([])
    fetchRef.current()
      .then((p) => {
        if (cancelled) return
        applyMeta(p)
        setMessages(mergeMessages([], p.messages))
        setHasMore(p.hasMore)
        nextBefore.current = p.nextBefore
        setStatus('ready')
      })
      .catch((e) => { if (!cancelled) { setError(errorMessage(e)); setStatus('error') } })
    return () => { cancelled = true }
  }, [bookingId, tick])

  const markRead = useCallback(() => {
    if (socket?.connected && document.visibilityState === 'visible') socket.emit('chat:read', { bookingId })
  }, [socket, bookingId])

  // เข้าห้อง + ฟัง event (เข้าใหม่ทุกครั้งที่เชื่อมต่อสำเร็จ รวมถึงหลัง reconnect)
  useEffect(() => {
    if (!socket) return
    const onNew = (m: ChatMessage) => {
      if (m.bookingId !== bookingId) return
      setMessages((l) => mergeMessages(l, [m]))
      if (m.senderRole !== role) { setPeerTyping(false); markRead() }
    }
    const onRead = (p: { bookingId: string; readerRole: ChatRole; readAt: number }) => {
      if (p.bookingId === bookingId && p.readerRole !== role) setMessages((l) => markOwnRead(l, role, p.readAt))
    }
    const onTyping = (p: { bookingId: string; role: ChatRole; typing: boolean }) => {
      if (p.bookingId !== bookingId || p.role === role) return
      setPeerTyping(p.typing)
      if (typingStale.current) clearTimeout(typingStale.current)
      if (p.typing) typingStale.current = setTimeout(() => setPeerTyping(false), TYPING_STALE_MS) // เผื่อไม่ได้รับ "หยุดพิมพ์"
    }
    const onPresence = (p: { bookingId: string; online: boolean }) => { if (p.bookingId === bookingId) setCustomerOnline(p.online) }
    const onVisible = () => { if (document.visibilityState === 'visible') markRead() }

    socket.on('message:new', onNew)
    socket.on('message:read', onRead)
    socket.on('chat:typing', onTyping)
    socket.on('presence:customer', onPresence)
    document.addEventListener('visibilitychange', onVisible)

    const join = () => {
      socket.emit('chat:join', { bookingId }, (res: { ok?: boolean; customerOnline?: boolean }) => {
        if (!res?.ok) return
        setCustomerOnline(!!res.customerOnline)
        markRead()
      })
      // เชื่อมต่อใหม่หลังหลุด → ดึงข้อความล่าสุดมารวม กันข้อความที่มาตอนไม่ได้ต่อตกหล่น
      if (wasConnected.current) {
        fetchRef.current().then((p) => { applyMeta(p); setMessages((l) => mergeMessages(l, p.messages)) }).catch(() => { /* ลองใหม่รอบหน้า */ })
      }
      wasConnected.current = true
    }
    if (socket.connected) join()
    socket.on('connect', join)

    return () => {
      socket.off('message:new', onNew)
      socket.off('message:read', onRead)
      socket.off('chat:typing', onTyping)
      socket.off('presence:customer', onPresence)
      socket.off('connect', join)
      document.removeEventListener('visibilitychange', onVisible)
      if (socket.connected) socket.emit('chat:leave', { bookingId })
      wasConnected.current = false
    }
  }, [socket, bookingId, role, markRead])

  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasMore || !nextBefore.current) return
    setLoadingOlder(true)
    try {
      const p = await fetchRef.current(nextBefore.current)
      setMessages((l) => mergeMessages(l, p.messages))
      setHasMore(p.hasMore)
      nextBefore.current = p.nextBefore
    } catch (e) {
      setSendError(errorMessage(e))
    } finally {
      setLoadingOlder(false)
    }
  }, [loadingOlder, hasMore])

  const stopTyping = useCallback(() => {
    if (typingIdle.current) clearTimeout(typingIdle.current)
    if (typingOn.current && socket?.connected) socket.emit('chat:typing', { bookingId, typing: false })
    typingOn.current = false
  }, [socket, bookingId])

  // เรียกทุกครั้งที่พิมพ์ — ส่ง "กำลังพิมพ์" ตอนเริ่ม และ "หยุดพิมพ์" เมื่อเงียบไป 2.5 วินาที
  const notifyTyping = useCallback(() => {
    if (!socket?.connected) return
    if (!typingOn.current) {
      typingOn.current = true
      socket.emit('chat:typing', { bookingId, typing: true })
    }
    if (typingIdle.current) clearTimeout(typingIdle.current)
    typingIdle.current = setTimeout(stopTyping, TYPING_IDLE_MS)
  }, [socket, bookingId, stopTyping])

  const deliver = useCallback(async (msg: ChatMessage) => {
    try {
      const saved = await sendRef.current(msg.body, msg.clientMsgId as string)
      setMessages((l) => mergeMessages(l, [saved]))
      setSendError('')
    } catch (e) {
      setMessages((l) => l.map((x) => (x.clientMsgId === msg.clientMsgId ? { ...x, local: 'failed' as const } : x)))
      setSendError(errorMessage(e))
    }
  }, [])

  const send = useCallback(async (text: string) => {
    const body = text.trim()
    if (!body) return
    stopTyping()
    const clientMsgId = newClientMsgId()
    const optimistic: ChatMessage = { id: `local-${clientMsgId}`, bookingId, senderRole: role, body, createdAt: Date.now(), readAt: null, clientMsgId, local: 'sending' }
    setMessages((l) => mergeMessages(l, [optimistic]))
    await deliver(optimistic)
  }, [bookingId, role, deliver, stopTyping])

  const retry = useCallback(async (msg: ChatMessage) => {
    setMessages((l) => l.map((x) => (x.clientMsgId === msg.clientMsgId ? { ...x, local: 'sending' as const } : x)))
    await deliver(msg) // ใช้ clientMsgId เดิม → ถ้าครั้งก่อนบันทึกสำเร็จไปแล้ว เซิร์ฟเวอร์จะไม่สร้างซ้ำ
  }, [deliver])

  useEffect(() => () => {
    if (typingIdle.current) clearTimeout(typingIdle.current)
    if (typingStale.current) clearTimeout(typingStale.current)
  }, [])

  return {
    messages, booking, canSend, cannotSendReason, status, error, hasMore, loadingOlder, loadOlder,
    reload: () => setTick((t) => t + 1),
    send, retry, notifyTyping, stopTyping, peerTyping, sendError, clearSendError: () => setSendError(''),
    connected,
    peerOnline: role === 'customer' ? adminsOnline : customerOnline,
  }
}
