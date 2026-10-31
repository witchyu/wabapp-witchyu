import 'dotenv/config'
import { randomBytes } from 'node:crypto'

const list = (v: string | undefined, fallback: string) =>
  (v ?? fallback).split(',').map((s) => s.trim()).filter(Boolean)

const isProd = process.env.NODE_ENV === 'production'

function positiveDays(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback)
  if (!Number.isInteger(value) || value < 1 || value > 3650) {
    throw new Error(`${name} must be an integer between 1 and 3650`)
  }
  return value
}


function adminSecret(): string {
  const s = process.env.ADMIN_TOKEN_SECRET
  if (s && s.length >= 32) return s
  if (isProd) throw new Error('ต้องตั้ง ADMIN_TOKEN_SECRET (ข้อความสุ่มยาวอย่างน้อย 32 ตัวอักษร) ใน Production')
  console.warn('[config] ไม่ได้ตั้ง ADMIN_TOKEN_SECRET (หรือสั้นเกินไป) — ใช้ค่าสุ่มชั่วคราว ต้องล็อกอินแอดมินใหม่ทุกครั้งที่รีสตาร์ท')
  return randomBytes(32).toString('hex')
}

function customerSecret() {
  const s = process.env.CUSTOMER_TOKEN_SECRET
  if (s && s.length >= 32) return s
  if (isProd) throw new Error('CUSTOMER_TOKEN_SECRET must be configured in production')
  console.warn('[security] CUSTOMER_TOKEN_SECRET is not configured; using an ephemeral development secret')
  return randomBytes(32).toString('hex')
}

const port = Number(process.env.PORT ?? 4000)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a valid TCP port')
}

const corsOrigins = list(process.env.FRONTEND_ORIGIN, 'http://localhost:5173')
if (isProd) {
  if (!process.env.FRONTEND_ORIGIN?.trim()) {
    throw new Error('FRONTEND_ORIGIN must be configured in production')
  }
  for (const origin of corsOrigins) {
    let parsed: URL
    try {
      parsed = new URL(origin)
    } catch {
      throw new Error('FRONTEND_ORIGIN contains an invalid URL')
    }
    if (parsed.protocol !== 'https:' || parsed.origin !== origin) {
      throw new Error('Production FRONTEND_ORIGIN must contain HTTPS origins only')
    }
  }
}

export const config = {
  port,
  corsOrigins,
  // ชำระเงินจำลอง — ใช้เฉพาะตอนพัฒนา (Phase 7 เปลี่ยนเป็น Payment Provider + Webhook)
  allowMockPayment: !isProd && process.env.ALLOW_MOCK_PAYMENT === 'true',
  adminTokenSecret: adminSecret(),
  adminTokenTtlMs: 8 * 3600 * 1000, // ล็อกอินแอดมินอยู่ได้ 8 ชั่วโมง
  customerTokenSecret: customerSecret(),
  customerTokenTtlMs: 30 * 24 * 3600000,

  // Data retention — ค่าเริ่มต้นเพื่อควบคุมขนาดฐานข้อมูลและ Free Tier
  customerDataRetentionDays: positiveDays('CUSTOMER_DATA_RETENTION_DAYS', 30),
  bookingRetentionDays: positiveDays('BOOKING_RETENTION_DAYS', 30),
  chatRetentionDays: positiveDays('CHAT_RETENTION_DAYS', 10),
  callRecordRetentionDays: positiveDays('CALL_RECORD_RETENTION_DAYS', 10),
  systemLogRetentionDays: positiveDays('SYSTEM_LOG_RETENTION_DAYS', 7),
}
