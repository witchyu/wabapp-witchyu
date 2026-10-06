import type { ChatMessage, ChatPage, ChatThread } from '../types/chat'
import { api } from './api'

const hist = (id: string, before?: string) =>
  `/bookings/${encodeURIComponent(id)}/messages?limit=30${before ? `&before=${encodeURIComponent(before)}` : ''}`

export const customerChatApi = {
  threads: () => api.get<{ threads: ChatThread[] }>('/chats').then((r) => r.threads),
  unread: () => api.get<{ unread: number }>('/chats/unread').then((r) => r.unread),
  history: (id: string, before?: string) => api.get<ChatPage>(hist(id, before)),
  send: (id: string, body: string, clientMsgId: string) =>
    api.post<{ message: ChatMessage }>(`/bookings/${encodeURIComponent(id)}/messages`, { body, clientMsgId }).then((r) => r.message),
}
