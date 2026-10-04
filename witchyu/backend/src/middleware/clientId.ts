import type { NextFunction, Request, Response } from 'express'
import { parseClientId } from '../domain/validation'

declare module 'express-serve-static-core' {
  interface Request {
    clientId?: string
  }
}

// Phase 3: ระบุเจ้าของการจองด้วยรหัสอุปกรณ์ (UUID สุ่ม 128 บิตที่หน้าเว็บสร้างเอง)
// Phase 8 จะแทนด้วยการล็อกอิน/Session จริง
export function requireClientId(req: Request, _res: Response, next: NextFunction) {
  try {
    req.clientId = parseClientId(req.header('x-client-id'))
    next()
  } catch (e) {
    next(e)
  }
}
