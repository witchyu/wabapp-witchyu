import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'

// เข้ารหัสผ่านด้วย scrypt (มีใน Node อยู่แล้ว ไม่ต้องพึ่งไลบรารีเพิ่ม) รูปแบบ: scrypt$<salt hex>$<hash hex>
const KEYLEN = 64
export const MIN_PASSWORD_LENGTH = 10

function derive(password: string, salt: Buffer, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, (err, key) => (err ? reject(err) : resolve(key)))
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await derive(password, salt, KEYLEN)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const salt = Buffer.from(parts[1], 'hex')
  const expected = Buffer.from(parts[2], 'hex')
  if (salt.length === 0 || expected.length === 0) return false
  const actual = await derive(password, salt, expected.length)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

// ใช้ตรวจเมื่อไม่พบชื่อผู้ใช้ เพื่อให้เวลาตอบใกล้เคียงกัน (กันการเดาว่าชื่อผู้ใช้ไหนมีอยู่จริง)
export const DUMMY_HASH = `scrypt$${'00'.repeat(16)}$${'00'.repeat(KEYLEN)}`
