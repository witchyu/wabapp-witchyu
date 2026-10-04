import { createHmac, timingSafeEqual } from 'node:crypto'

// โทเคนล็อกอินแอดมิน: base64url(payload).base64url(HMAC-SHA256) มีวันหมดอายุ
export interface TokenPayload { sub: string; iat: number; exp: number }

const b64 = (v: Buffer | string) => Buffer.from(v).toString('base64url')
const mac = (data: string, secret: string) => createHmac('sha256', secret).update(data).digest()

export function signToken(sub: string, secret: string, nowMs: number, ttlMs: number): { token: string; expiresAt: number } {
  const payload: TokenPayload = { sub, iat: Math.floor(nowMs / 1000), exp: Math.floor((nowMs + ttlMs) / 1000) }
  const body = b64(JSON.stringify(payload))
  return { token: `${body}.${b64(mac(body, secret))}`, expiresAt: payload.exp * 1000 }
}

export function verifyToken(token: string, secret: string, nowMs: number): TokenPayload | null {
  if (typeof token !== 'string' || token.length > 2000) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts
  const expected = mac(body, secret)
  let given: Buffer
  try { given = Buffer.from(sig, 'base64url') } catch { return null }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<TokenPayload>
    if (typeof p.sub !== 'string' || typeof p.exp !== 'number' || typeof p.iat !== 'number') return null
    if (p.exp * 1000 <= nowMs) return null
    return p as TokenPayload
  } catch {
    return null
  }
}
