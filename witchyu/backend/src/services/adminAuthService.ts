import { config } from '../config'
import { prisma } from '../db'
import { AppError } from '../domain/errors'
import { LoginLimiter } from '../domain/loginLimiter'
import { DUMMY_HASH, verifyPassword } from '../domain/password'
import { signToken } from '../domain/token'

// ล็อกอินผิด: ต่อชื่อผู้ใช้ 5 ครั้ง / ต่อ IP 15 ครั้ง ภายใน 15 นาที
const WINDOW = 15 * 60 * 1000
const byUser = new LoginLimiter(5, WINDOW)
const byIp = new LoginLimiter(15, WINDOW)

export async function login(username: string, password: string, ip: string) {
  const now = Date.now()
  const wait = Math.max(byUser.retryAfterSec(`u:${username}`, now), byIp.retryAfterSec(`ip:${ip}`, now))
  if (wait > 0) {
    throw new AppError(429, 'TOO_MANY_ATTEMPTS', `พยายามเข้าสู่ระบบมากเกินไป กรุณาลองใหม่ในอีก ${Math.ceil(wait / 60)} นาที`)
  }

  const admin = await prisma.admin.findUnique({ where: { username } })
  // ไม่พบผู้ใช้ก็ตรวจกับค่าหลอก เพื่อไม่ให้เวลาตอบบอกใบ้ได้ว่าชื่อผู้ใช้นี้มีอยู่หรือไม่
  const ok = await verifyPassword(password, admin?.passwordHash ?? DUMMY_HASH)
  if (!admin || !ok) {
    byUser.fail(`u:${username}`, now)
    byIp.fail(`ip:${ip}`, now)
    throw new AppError(401, 'INVALID_CREDENTIALS', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
  }

  byUser.reset(`u:${username}`)
  const { token, expiresAt } = signToken(admin.id, config.adminTokenSecret, now, config.adminTokenTtlMs)
  return { token, expiresAt, admin: { username: admin.username, displayName: admin.displayName } }
}
