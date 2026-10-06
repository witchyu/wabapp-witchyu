import type { Server } from 'socket.io'

// ตัวกลางให้ service อื่นส่ง event ได้โดยไม่ต้องรู้จัก socket.io โดยตรง (และไม่เกิด import วนกัน)
let io: Server | null = null
export const setIo = (server: Server | null) => { io = server }
export const getIo = () => io

export const bookingRoom = (bookingId: string) => `booking:${bookingId}`
export const userRoom = (clientId: string) => `user:${clientId}`
export const ADMINS_ROOM = 'admins'

// ส่งครั้งเดียวต่อ socket แม้อยู่หลายห้อง: ห้องของการจอง + เจ้าของ (ทุกอุปกรณ์ของลูกค้า) + แอดมินทั้งหมด
function targets(bookingId: string, ownerClientId: string) {
  return io?.to(bookingRoom(bookingId)).to(userRoom(ownerClientId)).to(ADMINS_ROOM)
}

export function emitMessageNew(bookingId: string, ownerClientId: string, message: unknown) {
  targets(bookingId, ownerClientId)?.emit('message:new', message)
}

export function emitMessageRead(bookingId: string, ownerClientId: string, payload: { bookingId: string; readerRole: string; readAt: number }) {
  targets(bookingId, ownerClientId)?.emit('message:read', payload)
}
