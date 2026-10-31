import type { NextFunction, Request, Response } from 'express'
import { config } from '../config'
import { prisma } from '../db'
import { AppError } from '../domain/errors'
import { parseClientId } from '../domain/validation'
import { verifyToken } from '../domain/token'
import { asyncHandler } from './asyncHandler'

declare module 'express-serve-static-core' {
  interface Request {
    clientId?: string
    customerUserId?: string
  }
}

export const requireClientId = asyncHandler(async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const header = req.header('authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)

  if (match) {
    const payload = verifyToken(match[1].trim(), config.customerTokenSecret, Date.now())
    if (!payload) throw new AppError(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบใหม่')

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, clientId: true, email: true, passwordHash: true },
    })

    if (!user || !user.email || !user.passwordHash) {
      throw new AppError(401, 'UNAUTHORIZED', 'ไม่พบบัญชีผู้ใช้งาน')
    }

    req.clientId = user.clientId
    req.customerUserId = user.id
    next()
    return
  }

  req.clientId = parseClientId(req.header('x-client-id'))
  next()
})
