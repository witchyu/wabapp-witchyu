import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ChatView from '../../components/chat/ChatView'
import { CustomerAvatar } from './AdminChats'
import { useConversation } from '../../hooks/useConversation'
import { adminApi } from '../../services/adminApi'
import { dateShort } from '../../utils/format'

export default function AdminChatRoom() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const fetchPage = useCallback((before?: string) => adminApi.chatHistory(id, before), [id])
  const sendApi = useCallback((body: string, clientMsgId: string) => adminApi.chatSend(id, body, clientMsgId), [id])
  const conv = useConversation({ role: 'admin', bookingId: id, fetchPage, sendApi })
  const b = conv.booking

  return (
    <ChatView
      role="admin"
      conv={conv}
      title={b ? `${b.customer.nickname} (${b.customer.fullName})` : 'แชต'}
      subtitle={b ? `${b.serviceName} · ${dateShort(b.date)} ${b.time}` : undefined}
      avatar={<CustomerAvatar name={b?.customer.nickname ?? ''} />}
      onBack={() => nav('/admin/chat')}
    />
  )
}
