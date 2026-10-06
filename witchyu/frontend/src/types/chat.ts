import type { Booking } from './index'

export type ChatRole = 'customer' | 'admin'

export interface ChatMessage {
  id: string
  bookingId: string
  senderRole: ChatRole
  body: string
  createdAt: number
  readAt: number | null
  clientMsgId?: string
  local?: 'sending' | 'failed' // สถานะฝั่งเครื่องเท่านั้น (ยังไม่ถูกบันทึกที่เซิร์ฟเวอร์)
}

export interface ChatThread {
  booking: Booking
  lastMessage: ChatMessage | null
  unread: number
  canSend: boolean
}

export interface ChatPage {
  booking: Booking
  messages: ChatMessage[]
  hasMore: boolean
  nextBefore?: string
  canSend: boolean
  cannotSendReason?: string
}
