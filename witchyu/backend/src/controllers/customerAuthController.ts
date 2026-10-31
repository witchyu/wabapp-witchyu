import { AppError } from '../domain/errors'
import { asyncHandler } from '../middleware/asyncHandler'
import { parseClientId, parseCustomer } from '../domain/validation'
import * as auth from '../services/customerAuthService'

function bearer(req: import('express').Request): string {
  const header = req.header('authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) throw new AppError(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบก่อน')
  return match[1]
}

export const register = asyncHandler(async (req, res) => {
  const clientId = parseClientId(req.header('x-client-id'))
  const profile = req.body?.customer ? parseCustomer(req.body.customer) : undefined
  res.status(201).json(await auth.register(clientId, req.body?.email, req.body?.password, profile))
})

export const login = asyncHandler(async (req, res) => {
  res.json(await auth.login(req.body?.email, req.body?.password, req.ip ?? 'unknown'))
})

export const me = asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store')
  res.json({ user: await auth.getMe(bearer(req)) })
})
