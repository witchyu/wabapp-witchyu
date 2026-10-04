import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../domain/errors'
import { TRANSIENT_DB_CODES } from './asyncHandler'

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, 'NOT_FOUND', 'ไม่พบเส้นทางนี้'))
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } })
  }
  const e = err as { type?: string; status?: number; code?: string }
  if (e?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'รูปแบบข้อมูลไม่ถูกต้อง' } })
  }
  if (e?.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'TOO_LARGE', message: 'ข้อมูลใหญ่เกินไป' } })
  }
  if (TRANSIENT_DB_CODES.has(e?.code ?? '')) {
    return res.status(503).json({ error: { code: 'DB_UNAVAILABLE', message: 'ฐานข้อมูลกำลังเริ่มทำงาน กรุณาลองอีกครั้งในอีกสักครู่' } })
  }
  // อย่าส่งรายละเอียดภายในออกไปให้ client
  console.error('[unhandled]', err)
  return res.status(500).json({ error: { code: 'INTERNAL', message: 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง' } })
}
