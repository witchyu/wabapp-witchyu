import type { Request } from 'express'
import { asyncHandler } from '../middleware/asyncHandler'
import { parseBookingIdParam, parseClientMsgId, parseHistoryQuery, parseMessageBody } from '../domain/chat'
import { AppError } from '../domain/errors'
import * as chat from '../services/chatService'
import type { Viewer } from '../services/chatService'

const customer = (req: Request): Viewer => ({ role: 'customer', clientId: req.clientId as string })
const admin = (req: Request): Viewer => ({ role: 'admin', adminId: req.adminId as string })
const bid = (req: Request) => parseBookingIdParam(req.params.id)

function make(viewerOf: (req: Request) => Viewer) {
  return {
    history: asyncHandler(async (req, res) => {
      res.json(await chat.listMessages(viewerOf(req), bid(req), parseHistoryQuery(req.query as Record<string, unknown>)))
    }),
    send: asyncHandler(async (req, res) => {
      const b = (req.body ?? {}) as Record<string, unknown>
      if (typeof b !== 'object') throw new AppError(400, 'VALIDATION', 'ข้อมูลไม่ถูกต้อง')
      const message = await chat.sendMessage(viewerOf(req), bid(req), parseMessageBody(b.body), parseClientMsgId(b.clientMsgId))
      res.status(201).json({ message })
    }),
  }
}

export const customerChat = {
  ...make(customer),
  threads: asyncHandler(async (req, res) => { res.json({ threads: await chat.customerThreads(req.clientId as string) }) }),
  unread: asyncHandler(async (req, res) => { res.json({ unread: await chat.customerUnread(req.clientId as string) }) }),
}

export const adminChat = {
  ...make(admin),
  threads: asyncHandler(async (_req, res) => { res.json({ threads: await chat.adminThreads() }) }),
  unread: asyncHandler(async (_req, res) => { res.json({ unread: await chat.adminUnread() }) }),
}
