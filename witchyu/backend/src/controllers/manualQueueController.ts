import { asyncHandler } from '../middleware/asyncHandler'
import { AppError } from '../domain/errors'
import {
  parseQueueDate,
  parseQueueCreate,
  parseQueueEntryPatch,
  parseQueueSettingsPatch,
} from '../domain/manualQueueValidation'
import * as queue from '../services/manualQueueService'

const idParam = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(400, 'VALIDATION', 'รหัสช่วงเวลาคิวไม่ถูกต้อง')
  }
  return value
}

export const getManualQueue = asyncHandler(async (req, res) => {
  const date = parseQueueDate(req.query.date)
  res.json(await queue.getManualQueue(date))
})

export const updateManualQueueSettings = asyncHandler(async (req, res) => {
  const settings = await queue.updateManualQueueSettings(
    parseQueueSettingsPatch(req.body),
  )
  res.json({ settings })
})

export const createManualQueueEntry = asyncHandler(async (req, res) => {
  const entry = await queue.createManualQueueEntry(parseQueueCreate(req.body))
  res.status(201).json({ entry })
})

export const updateManualQueueEntry = asyncHandler(async (req, res) => {
  const parsed = parseQueueEntryPatch(req.body)
  const entry = await queue.updateManualQueueEntry(
    idParam(req.params.id),
    parsed.date,
    parsed.patch,
  )
  res.json({ entry })
})

export const deleteManualQueueEntry = asyncHandler(async (req, res) => {
  await queue.deleteManualQueueEntry(idParam(req.params.id))
  res.json({ ok: true })
})
