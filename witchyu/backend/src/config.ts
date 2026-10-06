import 'dotenv/config'
import { randomBytes } from 'node:crypto'

const list = (v: string | undefined, fallback: string) =>
  (v ?? fallback).split(',').map((s) => s.trim()).filter(Boolean)

const isProd = process.env.NODE_ENV === 'production'

function adminSecret(): string {
  const s = process.env.ADMIN_TOKEN_SECRET
  if (s && s.length >= 32) return s
  if (isProd) throw new Error('ต้องตั้ง ADMIN_TOKEN_SECRET (ข้อความสุ่มยาวอย่างน้อย 32 ตัวอักษร) ใน Production')
  console.warn('[config] ไม่ได้ตั้ง ADMIN_TOKEN_SECRET (หรือสั้นเกินไป) — ใช้ค่าสุ่มชั่วคราว ต้องล็อกอินแอดมินใหม่ทุกครั้งที่รีสตาร์ท')
  return randomBytes(32).toString('hex')
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigins: list(process.env.FRONTEND_ORIGIN, 'http://localhost:5173'),
  // ชำระเงินจำลอง — ใช้เฉพาะตอนพัฒนา (Phase 7 เปลี่ยนเป็น Payment Provider + Webhook)
  allowMockPayment: process.env.ALLOW_MOCK_PAYMENT === 'true',
  adminTokenSecret: adminSecret(),
  adminTokenTtlMs: 8 * 3600 * 1000, // ล็อกอินแอดมินอยู่ได้ 8 ชั่วโมง

  // Data retention — ค่าเริ่มต้นเพื่อควบคุมขนาดฐานข้อมูลและ Free Tier
  customerDataRetentionDays: Number(process.env.CUSTOMER_DATA_RETENTION_DAYS ?? 30),
  bookingRetentionDays: Number(process.env.BOOKING_RETENTION_DAYS ?? 30),
  chatRetentionDays: Number(process.env.CHAT_RETENTION_DAYS ?? 10),
  callRecordRetentionDays: Number(process.env.CALL_RECORD_RETENTION_DAYS ?? 10),
  systemLogRetentionDays: Number(process.env.SYSTEM_LOG_RETENTION_DAYS ?? 7),
}
