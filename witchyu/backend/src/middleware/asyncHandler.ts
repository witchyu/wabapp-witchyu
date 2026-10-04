import type { NextFunction, Request, RequestHandler, Response } from 'express'

// Neon ปิดเครื่องอัตโนมัติเมื่อไม่มีคนใช้ ครั้งแรกที่ตื่นอาจต่อฐานข้อมูลไม่ติดทันที → ลองใหม่ 1 ครั้ง
// (เกิดก่อนเริ่มคำสั่ง จึงปลอดภัย และถ้าซ้ำกับรายการที่เพิ่งสร้าง รอบเวลาจะเต็มและถูกปฏิเสธเอง)
export const TRANSIENT_DB_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017'])
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>

export const asyncHandler = (fn: Handler): RequestHandler => async (req, res, next) => {
  try {
    await fn(req, res, next)
  } catch (e) {
    const code = (e as { code?: string })?.code ?? ''
    if (!TRANSIENT_DB_CODES.has(code) || res.headersSent) return next(e)
    await sleep(800)
    try {
      await fn(req, res, next)
    } catch (e2) {
      next(e2)
    }
  }
}
