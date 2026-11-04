import type { Request, Response } from 'express'
import { asyncHandler } from '../middleware/asyncHandler'
import * as paymentProofs from '../services/paymentProofService'

const bookingIdOf = (req: Request) => String(req.params.id)
const clientIdOf = (req: Request) => req.clientId as string

export const upload = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: { code: 'FILE_REQUIRED', message: 'กรุณาเลือกไฟล์สลิป' } })
    return
  }
  const proof = await paymentProofs.uploadPaymentProof(bookingIdOf(req), clientIdOf(req), req.file)
  res.setHeader('Cache-Control', 'private, no-store')
  res.status(201).json({ proof })
})

export const list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const proofs = await paymentProofs.getCustomerPaymentProof(bookingIdOf(req), clientIdOf(req))
  res.setHeader('Cache-Control', 'private, no-store')
  res.json({ proofs })
})

export const remove = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const result = await paymentProofs.deleteCustomerPaymentProof(bookingIdOf(req), clientIdOf(req))
  res.json(result)
})

export const image = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const result = await paymentProofs.getCustomerPaymentProofImage(
    bookingIdOf(req),
    clientIdOf(req),
    String(req.params.proofId),
  )

  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Content-Type', result.mimeType)
  res.setHeader('Content-Length', String(result.data.length))
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Content-Disposition', 'inline')
  res.send(result.data)
})
