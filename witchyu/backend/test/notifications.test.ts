import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server as HttpServer } from 'node:http'
import { prisma } from '../src/db'
import { createApp } from '../src/app'

const unique = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const clientA = unique('notify-a')
const clientB = unique('notify-b')
const createdIds: string[] = []
let server: HttpServer
let baseUrl: string

async function startServer() {
  server = createServer(createApp())

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address()
  assert.ok(address && typeof address === 'object')
  baseUrl = `http://127.0.0.1:${address.port}`
}

async function api(
  path: string,
  clientId: string,
  method = 'GET',
  body?: unknown,
) {
  return fetch(`${baseUrl}/api/notifications${path}`, {
    method,
    headers: {
      'X-Client-Id': clientId,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

after(async () => {
  if (createdIds.length) {
    await prisma.notification.deleteMany({
      where: { id: { in: createdIds } },
    })
  }

  await prisma.notificationPreference.deleteMany({
    where: { clientId: { in: [clientA, clientB] } },
  })

  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})

test('Notification API: CRUD, preferences and client isolation', async () => {
  await startServer()

  const first = await prisma.notification.create({
    data: {
      clientId: clientA,
      type: 'booking',
      title: 'Booking confirmed',
      message: 'Your booking is confirmed.',
    },
  })
  createdIds.push(first.id)

  const second = await prisma.notification.create({
    data: {
      clientId: clientA,
      type: 'payment',
      title: 'Payment received',
      message: 'Payment has been received.',
    },
  })
  createdIds.push(second.id)

  const privateNotification = await prisma.notification.create({
    data: {
      clientId: clientB,
      type: 'system',
      title: 'Private notification',
      message: 'This belongs to another client.',
    },
  })
  createdIds.push(privateNotification.id)

  // List: only notifications belonging to the requesting client.
  const listResponse = await api('/', clientA)
  assert.equal(listResponse.status, 200)
  const listBody = await listResponse.json() as {
    notifications: Array<{ id: string }>
  }
  assert.equal(listBody.notifications.length, 2)
  assert.ok(listBody.notifications.every((item) => item.id !== privateNotification.id))

  // Unread count.
  const unreadResponse = await api('/unread', clientA)
  assert.equal(unreadResponse.status, 200)
  assert.deepEqual(await unreadResponse.json(), { unread: 2 })

  // Mark one notification as read.
  const readResponse = await api(`/${first.id}/read`, clientA, 'PATCH')
  assert.equal(readResponse.status, 200)
  assert.deepEqual(await readResponse.json(), { updated: true })

  const unreadAfterRead = await api('/unread', clientA)
  assert.deepEqual(await unreadAfterRead.json(), { unread: 1 })

  // Mark all remaining notifications as read.
  const readAllResponse = await api('/read-all', clientA, 'PATCH')
  assert.equal(readAllResponse.status, 200)
  assert.deepEqual(await readAllResponse.json(), { updated: 1 })

  const unreadAfterAll = await api('/unread', clientA)
  assert.deepEqual(await unreadAfterAll.json(), { unread: 0 })

  // Preferences: defaults and updates.
  const preferencesResponse = await api('/preferences', clientA)
  assert.equal(preferencesResponse.status, 200)
  const preferencesBody = await preferencesResponse.json() as {
    preferences: { bookingEnabled: boolean; chatEnabled: boolean }
  }
  assert.equal(preferencesBody.preferences.bookingEnabled, true)
  assert.equal(preferencesBody.preferences.chatEnabled, true)

  const updatePreferencesResponse = await api(
    '/preferences',
    clientA,
    'PATCH',
    { bookingEnabled: false, chatEnabled: false },
  )
  assert.equal(updatePreferencesResponse.status, 200)
  const updatedPreferences = await updatePreferencesResponse.json() as {
    preferences: { bookingEnabled: boolean; chatEnabled: boolean }
  }
  assert.equal(updatedPreferences.preferences.bookingEnabled, false)
  assert.equal(updatedPreferences.preferences.chatEnabled, false)

  // Invalid preference values must be rejected.
  const invalidPreferencesResponse = await api(
    '/preferences',
    clientA,
    'PATCH',
    { bookingEnabled: 'false' },
  )
  assert.equal(invalidPreferencesResponse.status, 400)

  // Client B cannot read or modify Client A's notification.
  const crossReadResponse = await api(`/${first.id}/read`, clientB, 'PATCH')
  assert.deepEqual(await crossReadResponse.json(), { updated: false })

  const crossDeleteResponse = await api(`/${first.id}`, clientB, 'DELETE')
  assert.deepEqual(await crossDeleteResponse.json(), { deleted: false })

  const stillExists = await prisma.notification.findUnique({
    where: { id: first.id },
  })
  assert.ok(stillExists, 'another client must not delete this notification')

  // Owner can delete their own notification.
  const deleteResponse = await api(`/${second.id}`, clientA, 'DELETE')
  assert.equal(deleteResponse.status, 200)
  assert.deepEqual(await deleteResponse.json(), { deleted: true })

  // Invalid client ID must be rejected.
  const invalidClientResponse = await fetch(`${baseUrl}/api/notifications`, {
    headers: { 'X-Client-Id': 'short' },
  })
  assert.equal(invalidClientResponse.status, 401)
})
