import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ChatView from '../components/chat/ChatView'
import { DoctorAvatar } from './Chat'
import { useConversation } from '../hooks/useConversation'
import { customerChatApi } from '../services/chatApi'
import { dateShort } from '../utils/format'

export default function ChatRoom() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const fetchPage = useCallback((before?: string) => customerChatApi.history(id, before), [id])
  const sendApi = useCallback((body: string, clientMsgId: string) => customerChatApi.send(id, body, clientMsgId), [id])
  const conv = useConversation({ role: 'customer', bookingId: id, fetchPage, sendApi })
  const b = conv.booking

  return (
    <ChatView
      role="customer"
      conv={conv}
      title="Witchyu · หมอดู"
      subtitle={b ? `${b.serviceName} · ${dateShort(b.date)} ${b.time}` : undefined}
      avatar={<DoctorAvatar />}
      onBack={() => nav('/chat')}
    />
  )
}
