import { asyncHandler } from '../middleware/asyncHandler'
import {
  parseAdminBookingsQuery, parseHoursAll, parseHolidayCreate, parseIntParam, parseLogin, parseServiceCreate,
  parseServicePatch, parseSettingsPatch, parseSlotCreate, parseSlotPatch,
} from '../domain/adminValidation'
import * as auth from '../services/adminAuthService'
import * as admin from '../services/adminService'

const strParam = (v: unknown) => String(v)

export const login = asyncHandler(async (req, res) => {
  const { username, password } = parseLogin(req.body)
  res.json(await auth.login(username, password, req.ip ?? 'unknown'))
})
export const me = asyncHandler(async (req, res) => {
  res.json({ admin: { displayName: req.adminName } })
})

export const dashboard = asyncHandler(async (_req, res) => { res.json(await admin.dashboard()) })

export const listBookings = asyncHandler(async (req, res) => {
  res.json(await admin.listBookings(parseAdminBookingsQuery(req.query as Record<string, unknown>)))
})
export const getBooking = asyncHandler(async (req, res) => { res.json({ booking: await admin.getBooking(strParam(req.params.id)) }) })
export const confirmBooking = asyncHandler(async (req, res) => { res.json({ booking: await admin.confirmBooking(strParam(req.params.id)) }) })
export const cancelBooking = asyncHandler(async (req, res) => { res.json({ booking: await admin.cancelBooking(strParam(req.params.id)) }) })

export const listServices = asyncHandler(async (_req, res) => { res.json({ services: await admin.listServices() }) })
export const createService = asyncHandler(async (req, res) => { res.status(201).json({ service: await admin.createService(parseServiceCreate(req.body)) }) })
export const updateService = asyncHandler(async (req, res) => { res.json({ service: await admin.updateService(strParam(req.params.id), parseServicePatch(req.body)) }) })
export const deleteService = asyncHandler(async (req, res) => { await admin.deleteService(strParam(req.params.id)); res.json({ ok: true }) })

export const listSlots = asyncHandler(async (_req, res) => { res.json({ slots: await admin.listSlots() }) })
export const createSlot = asyncHandler(async (req, res) => { res.status(201).json({ slot: await admin.createSlot(parseSlotCreate(req.body)) }) })
export const updateSlot = asyncHandler(async (req, res) => { res.json({ slot: await admin.updateSlot(parseIntParam(req.params.id), parseSlotPatch(req.body)) }) })
export const deleteSlot = asyncHandler(async (req, res) => { await admin.deleteSlot(parseIntParam(req.params.id)); res.json({ ok: true }) })

export const getHours = asyncHandler(async (_req, res) => { res.json({ hours: await admin.getHours() }) })
export const saveHours = asyncHandler(async (req, res) => { res.json({ hours: await admin.saveHours(parseHoursAll(req.body)) }) })

export const listHolidays = asyncHandler(async (_req, res) => { res.json({ holidays: await admin.listHolidays() }) })
export const addHoliday = asyncHandler(async (req, res) => { res.status(201).json(await admin.addHoliday(parseHolidayCreate(req.body))) })
export const deleteHoliday = asyncHandler(async (req, res) => { await admin.deleteHoliday(parseIntParam(req.params.id)); res.json({ ok: true }) })

export const getSettings = asyncHandler(async (_req, res) => { res.json({ settings: await admin.getSettings() }) })
export const updateSettings = asyncHandler(async (req, res) => { res.json({ settings: await admin.updateSettings(parseSettingsPatch(req.body)) }) })
