import { Prisma } from '@prisma/client'
import { config } from '../config'
import { prisma } from '../db'
import { AppError } from '../domain/errors'
import { LoginLimiter } from '../domain/loginLimiter'
import { DUMMY_HASH, hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from '../domain/password'
import { signToken, verifyToken } from '../domain/token'
import type { CustomerInput } from '../domain/validation'

const WINDOW = 15 * 60 * 1000
const byEmail = new LoginLimiter(5, WINDOW)
const byIp = new LoginLimiter(15, WINDOW)

function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') throw new AppError(400, 'INVALID_EMAIL', 'กรุณากรอกอีเมล')
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, 'INVALID_EMAIL', 'รูปแบบอีเมลไม่ถูกต้อง')
  }
  return email
}

function validatePassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD_LENGTH || value.length > 128) {
    throw new AppError(400, 'INVALID_PASSWORD', `รหัสผ่านต้องมี ${MIN_PASSWORD_LENGTH}-128 ตัวอักษร`)
  }
  return value
}

function publicUser(user: {
  id: string
  clientId: string
  email: string | null
  nickname: string
  fullName: string
  age: number
  relationship: string
}) {
  return {
    id: user.id,
    clientId: user.clientId,
    email: user.email,
    nickname: user.nickname,
    fullName: user.fullName,
    age: user.age,
    relationship: user.relationship,
  }
}

export async function register(
  clientId: string,
  emailInput: unknown,
  passwordInput: unknown,
  profile?: CustomerInput,
) {
  const email = normalizeEmail(emailInput)
  const password = validatePassword(passwordInput)

  const existingEmail = await prisma.user.findUnique({ where: { email } })
  if (existingEmail) {
    throw new AppError(409, 'EMAIL_EXISTS', 'อีเมลนี้มีบัญชีอยู่แล้ว')
  }

  const existingDevice = await prisma.user.findUnique({ where: { clientId } })
  if (existingDevice?.email || existingDevice?.passwordHash) {
    throw new AppError(409, 'ACCOUNT_EXISTS', 'อุปกรณ์นี้ผูกกับบัญชีแล้ว กรุณาเข้าสู่ระบบ')
  }

  if (!existingDevice && !profile) {
    throw new AppError(400, 'PROFILE_REQUIRED', 'กรุณากรอกข้อมูลส่วนตัวเพื่อสมัครสมาชิก')
  }

  try {
    const passwordHash = await hashPassword(password)
    const user = existingDevice
      ? await prisma.user.update({
          where: { id: existingDevice.id },
          data: { email, passwordHash },
        })
      : await prisma.user.create({
          data: {
            clientId,
            email,
            passwordHash,
            nickname: profile!.nickname,
            fullName: profile!.fullName,
            age: profile!.age,
            relationship: profile!.relationship,
          },
        })

    const now = Date.now()
    const { token, expiresAt } = signToken(user.id, config.customerTokenSecret, now, config.customerTokenTtlMs)
    return { token, expiresAt, user: publicUser(user) }
  } catch (error) {
    if (error instanceof AppError) throw error
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(409, 'EMAIL_EXISTS', 'อีเมลนี้มีบัญชีอยู่แล้ว')
    }
    throw error
  }
}

export async function login(emailInput: unknown, passwordInput: unknown, ip: string) {
  const email = normalizeEmail(emailInput)
  const password = validatePassword(passwordInput)
  const now = Date.now()

  const wait = Math.max(
    byEmail.retryAfterSec(`e:${email}`, now),
    byIp.retryAfterSec(`ip:${ip}`, now),
  )
  if (wait > 0) {
    throw new AppError(429, 'TOO_MANY_ATTEMPTS', `พยายามเข้าสู่ระบบมากเกินไป กรุณาลองใหม่ในอีก ${Math.ceil(wait / 60)} นาที`)
  }

  const user = await prisma.user.findUnique({ where: { email } })
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH)

  if (!user || !user.passwordHash || !ok) {
    byEmail.fail(`e:${email}`, now)
    byIp.fail(`ip:${ip}`, now)
    throw new AppError(401, 'INVALID_CREDENTIALS', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง')
  }

  byEmail.reset(`e:${email}`)
  byIp.reset(`ip:${ip}`)
  const { token, expiresAt } = signToken(user.id, config.customerTokenSecret, now, config.customerTokenTtlMs)
  return { token, expiresAt, user: publicUser(user) }
}

export async function getMe(token: string) {
  const payload = verifyToken(token, config.customerTokenSecret, Date.now())
  if (!payload) throw new AppError(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบใหม่')

  const user = await prisma.user.findUnique({ where: { id: payload.sub } })
  if (!user || !user.email || !user.passwordHash) {
    throw new AppError(401, 'UNAUTHORIZED', 'ไม่พบบัญชีผู้ใช้งาน')
  }

  return publicUser(user)
}
