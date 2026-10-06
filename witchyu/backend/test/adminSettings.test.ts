import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../src/db'
import { getSettings, updateSettings } from '../src/services/adminService'
import { parseSettingsPatch } from '../src/domain/adminValidation'

let originalSettings: Awaited<
  ReturnType<typeof prisma.shopSetting.findUnique>
>

before(async () => {
  originalSettings = await prisma.shopSetting.findUnique({
    where: { id: 1 },
  })
})

after(async () => {
  if (originalSettings) {
    await prisma.shopSetting.upsert({
      where: { id: 1 },
      update: {
        shopOpen: originalSettings.shopOpen,
        callsEnabled: originalSettings.callsEnabled,
        customerDataRetentionDays: originalSettings.customerDataRetentionDays,
        bookingRetentionDays: originalSettings.bookingRetentionDays,
        chatRetentionDays: originalSettings.chatRetentionDays,
        callRecordRetentionDays: originalSettings.callRecordRetentionDays,
        systemLogRetentionDays: originalSettings.systemLogRetentionDays,
      },
      create: {
        id: 1,
        shopOpen: originalSettings.shopOpen,
        callsEnabled: originalSettings.callsEnabled,
        customerDataRetentionDays: originalSettings.customerDataRetentionDays,
        bookingRetentionDays: originalSettings.bookingRetentionDays,
        chatRetentionDays: originalSettings.chatRetentionDays,
        callRecordRetentionDays: originalSettings.callRecordRetentionDays,
        systemLogRetentionDays: originalSettings.systemLogRetentionDays,
      },
    })
  } else {
    await prisma.shopSetting.deleteMany({
      where: { id: 1 },
    })
  }
})

test('settings: getSettings returns persisted/default values', async () => {
  const settings = await getSettings()

  assert.equal(typeof settings.shopOpen, 'boolean')
  assert.equal(typeof settings.callsEnabled, 'boolean')

  assert.equal(typeof settings.customerDataRetentionDays, 'number')
  assert.equal(typeof settings.bookingRetentionDays, 'number')
  assert.equal(typeof settings.chatRetentionDays, 'number')
  assert.equal(typeof settings.callRecordRetentionDays, 'number')
  assert.equal(typeof settings.systemLogRetentionDays, 'number')
})

test('settings: updateSettings persists shop switches and all retention values', async () => {
  const updated = await updateSettings({
    shopOpen: false,
    callsEnabled: false,
    customerDataRetentionDays: 45,
    bookingRetentionDays: 60,
    chatRetentionDays: 15,
    callRecordRetentionDays: 20,
    systemLogRetentionDays: 8,
  })

  assert.equal(updated.shopOpen, false)
  assert.equal(updated.callsEnabled, false)
  assert.equal(updated.customerDataRetentionDays, 45)
  assert.equal(updated.bookingRetentionDays, 60)
  assert.equal(updated.chatRetentionDays, 15)
  assert.equal(updated.callRecordRetentionDays, 20)
  assert.equal(updated.systemLogRetentionDays, 8)

  const persisted = await prisma.shopSetting.findUnique({
    where: { id: 1 },
  })

  assert.ok(persisted)
  assert.equal(persisted.shopOpen, false)
  assert.equal(persisted.callsEnabled, false)
  assert.equal(persisted.customerDataRetentionDays, 45)
  assert.equal(persisted.bookingRetentionDays, 60)
  assert.equal(persisted.chatRetentionDays, 15)
  assert.equal(persisted.callRecordRetentionDays, 20)
  assert.equal(persisted.systemLogRetentionDays, 8)

  const readBack = await getSettings()

  assert.deepEqual(readBack, {
    shopOpen: false,
    callsEnabled: false,
    customerDataRetentionDays: 45,
    bookingRetentionDays: 60,
    chatRetentionDays: 15,
    callRecordRetentionDays: 20,
    systemLogRetentionDays: 8,
  })
})

test('settings validation: accepts retention limits 1 and 3650', () => {
  const min = parseSettingsPatch({
    customerDataRetentionDays: 1,
    bookingRetentionDays: 1,
    chatRetentionDays: 1,
    callRecordRetentionDays: 1,
    systemLogRetentionDays: 1,
  })

  assert.equal(min.customerDataRetentionDays, 1)
  assert.equal(min.bookingRetentionDays, 1)
  assert.equal(min.chatRetentionDays, 1)
  assert.equal(min.callRecordRetentionDays, 1)
  assert.equal(min.systemLogRetentionDays, 1)

  const max = parseSettingsPatch({
    customerDataRetentionDays: 3650,
    bookingRetentionDays: 3650,
    chatRetentionDays: 3650,
    callRecordRetentionDays: 3650,
    systemLogRetentionDays: 3650,
  })

  assert.equal(max.customerDataRetentionDays, 3650)
  assert.equal(max.bookingRetentionDays, 3650)
  assert.equal(max.chatRetentionDays, 3650)
  assert.equal(max.callRecordRetentionDays, 3650)
  assert.equal(max.systemLogRetentionDays, 3650)
})

test('settings validation: rejects retention values outside 1-3650', () => {
  for (const field of [
    'customerDataRetentionDays',
    'bookingRetentionDays',
    'chatRetentionDays',
    'callRecordRetentionDays',
    'systemLogRetentionDays',
  ] as const) {
    assert.throws(
      () => parseSettingsPatch({ [field]: 0 }),
      /1–3650/,
    )

    assert.throws(
      () => parseSettingsPatch({ [field]: 3651 }),
      /1–3650/,
    )
  }
})
