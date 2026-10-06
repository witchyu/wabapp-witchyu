import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AppError } from '../src/domain/errors'
import {
  MAX_BODY, canSend, cannotSendReason, decodeCursor, encodeCursor, parseBookingIdParam, parseClientMsgId,
  parseHistoryQuery, parseMessageBody, peerOf, toMessageDto,
} from '../src/domain/chat'
import { LoginLimiter } from '../src/domain/loginLimiter'

const code = (fn: () => unknown) => {
  try { fn() } catch (e) { return e instanceof AppError ? e.code : `non-AppError:${String(e)}` }
  return null
}

test('parseMessageBody: trims, normalizes, strips control chars, enforces length', () => {
  assert.equal(parseMessageBody('  สวัสดีค่ะ  '), 'สวัสดีค่ะ')
  assert.equal(parseMessageBody('a\r\nb'), 'a\nb')
  assert.equal(parseMessageBody('hi\u0000there\u0007'), 'hithere')
  assert.equal(parseMessageBody('บรรทัด1\n\nบรรทัด2'), 'บรรทัด1\n\nบรรทัด2')
  assert.equal(code(() => parseMessageBody('   ')), 'VALIDATION')
  assert.equal(code(() => parseMessageBody('\u0000\u0001')), 'VALIDATION')
  assert.equal(code(() => parseMessageBody(undefined)), 'VALIDATION')
  assert.equal(code(() => parseMessageBody(123)), 'VALIDATION')
  assert.equal(parseMessageBody('x'.repeat(MAX_BODY)).length, MAX_BODY)
  assert.equal(code(() => parseMessageBody('x'.repeat(MAX_BODY + 1))), 'VALIDATION')
  // HTML ไม่ถูกแก้ไข (หน้าเว็บ render เป็นข้อความล้วน ไม่ใช่ HTML)
  assert.equal(parseMessageBody('<b>x</b>'), '<b>x</b>')
})

test('parseClientMsgId', () => {
  assert.equal(parseClientMsgId(undefined), undefined)
  assert.equal(parseClientMsgId(null), undefined)
  assert.equal(parseClientMsgId('3f2b6c1e-8a44-4d6b'), '3f2b6c1e-8a44-4d6b')
  assert.equal(code(() => parseClientMsgId('short')), 'VALIDATION')
  assert.equal(code(() => parseClientMsgId('has spaces in it')), 'VALIDATION')
  assert.equal(code(() => parseClientMsgId(5)), 'VALIDATION')
})

test('cursor encode/decode round-trip and rejection', () => {
  const c = encodeCursor(1_790_000_000_000, 'cm1abcdefgh2345')
  assert.deepEqual(decodeCursor(c), { ms: 1_790_000_000_000, id: 'cm1abcdefgh2345' })
  assert.equal(code(() => decodeCursor('nope')), 'VALIDATION')
  assert.equal(code(() => decodeCursor('123_abc')), 'VALIDATION')
  assert.equal(code(() => decodeCursor("1790000000000_x'; DROP TABLE")), 'VALIDATION')
})

test('parseHistoryQuery', () => {
  assert.deepEqual(parseHistoryQuery({}), { limit: 30, before: undefined })
  assert.equal(parseHistoryQuery({ limit: '10' }).limit, 10)
  assert.equal(parseHistoryQuery({ before: encodeCursor(1_790_000_000_000, 'cm1abcdefgh2345') }).before?.ms, 1_790_000_000_000)
  assert.equal(code(() => parseHistoryQuery({ limit: '0' })), 'VALIDATION')
  assert.equal(code(() => parseHistoryQuery({ limit: '51' })), 'VALIDATION')
  assert.equal(code(() => parseHistoryQuery({ limit: 'abc' })), 'VALIDATION')
  assert.equal(code(() => parseHistoryQuery({ before: 'bad' })), 'VALIDATION')
})

test('parseBookingIdParam', () => {
  assert.equal(parseBookingIdParam('WY-20261005-001'), 'WY-20261005-001')
  assert.equal(parseBookingIdParam('WY-20261005-1000'), 'WY-20261005-1000')
  assert.equal(code(() => parseBookingIdParam('../etc/passwd')), 'BOOKING_NOT_FOUND')
  assert.equal(code(() => parseBookingIdParam(undefined)), 'BOOKING_NOT_FOUND')
  assert.equal(code(() => parseBookingIdParam('WY-2026-1')), 'BOOKING_NOT_FOUND')
})

test('canSend by role and booking status', () => {
  assert.equal(canSend('customer', 'confirmed'), true)
  assert.equal(canSend('customer', 'completed'), true)
  assert.equal(canSend('customer', 'pending_payment'), false)
  assert.equal(canSend('customer', 'cancelled'), false)
  assert.equal(canSend('admin', 'confirmed'), true)
  assert.equal(canSend('admin', 'pending_payment'), true)
  assert.equal(canSend('admin', 'completed'), true)
  assert.equal(canSend('admin', 'cancelled'), false)
  assert.match(cannotSendReason('customer', 'pending_payment'), /ชำระเงิน/)
  assert.match(cannotSendReason('customer', 'cancelled'), /ยกเลิก/)
  assert.equal(peerOf('customer'), 'admin')
  assert.equal(peerOf('admin'), 'customer')
})

test('toMessageDto', () => {
  const dto = toMessageDto({ id: 'm1', bookingId: 'WY-20261005-001', senderRole: 'admin', body: 'hi', clientMsgId: null, createdAt: new Date(1000), readAt: null })
  assert.deepEqual(dto, { id: 'm1', bookingId: 'WY-20261005-001', senderRole: 'admin', body: 'hi', clientMsgId: undefined, createdAt: 1000, readAt: null })
  assert.equal(toMessageDto({ id: 'm2', bookingId: 'b', senderRole: 'customer', body: 'x', clientMsgId: 'abcdefgh', createdAt: new Date(1), readAt: new Date(2) }).readAt, 2)
})

test('rate limiter used as send/typing throttle (20 per minute)', () => {
  const l = new LoginLimiter(20, 60_000)
  for (let i = 0; i < 20; i++) { assert.equal(l.retryAfterSec('k', i * 100), 0); l.fail('k', i * 100) }
  assert.ok(l.retryAfterSec('k', 2500) > 0, 'blocked on the 21st within the window')
  assert.equal(l.retryAfterSec('other', 2500), 0, 'other rooms unaffected')
  assert.equal(l.retryAfterSec('k', 61_000), 0, 'window slides')
})
