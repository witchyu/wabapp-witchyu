import { io, type Socket } from 'socket.io-client'
import { getClientId } from './clientId'
import { adminToken } from './adminApi'
import type { ChatRole } from '../types/chat'

const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '')

// auth เป็นฟังก์ชัน: ทุกครั้งที่เชื่อมต่อใหม่ (reconnect) จะอ่านค่าล่าสุดเสมอ
export function createSocket(role: ChatRole): Socket {
  const opts = {
    path: '/socket.io',
    auth: (cb: (data: Record<string, string>) => void) => cb(role === 'admin' ? { adminToken: adminToken.get() } : { clientId: getClientId() }),
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  }
  return BASE ? io(BASE, opts) : io(opts)
}
