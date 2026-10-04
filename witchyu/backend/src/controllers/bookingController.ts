import type { Request } from 'express'
import { asyncHandler } from '../middleware/asyncHandler'
import { parseCreateBooking, parseUpdateBooking } from '../domain/validation'
import * as bookings from '../services/bookingService'

const cid = (req: Request) => req.clientId as string
const idOf = (req: Request) => String(req.params.id)

export const create = asyncHandler(async (req, res) => {
  const booking = await bookings.createBooking(cid(req), parseCreateBooking(req.body))
  res.status(201).json({ booking })
})

export const list = asyncHandler(async (req, res) => {
  res.json({ bookings: await bookings.listBookings(cid(req)) })
})

export const get = asyncHandler(async (req, res) => {
  res.json({ booking: await bookings.getBooking(cid(req), idOf(req)) })
})

export const update = asyncHandler(async (req, res) => {
  res.json({ booking: await bookings.updateBooking(cid(req), idOf(req), parseUpdateBooking(req.body)) })
})

export const cancel = asyncHandler(async (req, res) => {
  res.json({ booking: await bookings.cancelBooking(cid(req), idOf(req)) })
})

export const mockPay = asyncHandler(async (req, res) => {
  res.json({ booking: await bookings.mockPay(cid(req), idOf(req)) })
})
