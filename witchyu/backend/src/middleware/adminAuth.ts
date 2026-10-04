import type { NextFunction, Request, Response } from 'express'
import { config } from '../config'
import { prisma } from '../db'
import { AppError } from '../domain/errors'
import { verifyToken } from '../domain/token'
import { asyncHandler } from './asyncHandler'

declare module 'express-serve-static-core' {
  interface Request {
    adminId?: string
    adminName?: string
  }
}

// ทุกเส้นทาง /api/admin/* (ยกเว้น login) ต้องแนบ Authorization: Bearer <token>
export const requireAdmin = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.header('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  const payload = token ? verifyToken(token, config.adminTokenSecret, Date.now()) : null
  if (!payload) throw new AppError(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบแอดมิน')
  // ตรวจว่าบัญชียังมีอยู่ (ลบบัญชี = เพิกถอนสิทธิ์ทันที)
  const admin = await prisma.admin.findUnique({ where: { id: payload.sub }, select: { id: true, displayName: true } })
  if (!admin) throw new AppError(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบแอดมิน')
  req.adminId = admin.id
  req.adminName = admin.displayName
  next()
})
