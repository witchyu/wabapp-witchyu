import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AppError } from '../src/domain/errors'
import { addDaysISO, dayOfWeek, isISODate, shopNow, startMs } from '../src/domain/time'
import {
  assertSlotAvailable, bookingEndMs, computeDaySlots, isEditable, nextBookingId, resolveSelection,
  type ServiceRow, type SlotRow,
} from '../src/domain/rules'
import { parseClientId, parseCreateBooking, parseCustomer, parseSlotsQuery, parseUpdateBooking } from '../src/domain/validation'
import { toBookingDto } from '../src/domain/dto'

const svc = (id: string, group: string, price: number, extra: Partial<ServiceRow> = {}): ServiceRow => ({
  id, group, name: id, price, durationMin: null, unlimited: false, perQuestion: false, active: true, ...extra,
})
const SERVICES: ServiceRow[] = [
  svc('q-3', 'question', 79),
  svc('q-custom', 'question', 29, { perQuestion: true }),
  svc('c-30', 'call', 129, { durationMin: 30 }),
  svc('c-unl', 'call', 299, { unlimited: true }),
  svc('t-money', 'topic', 149),
  svc('ch-uni', 'choice', 69),
  svc('ch-other', 'choice', 49),
  svc('l-new', 'love59', 59),
  svc('w-now', 'work', 129),
  svc('s-old', 'study', 129, { active: false }),
]
const SLOTS: SlotRow[] = ['18:00', '19:00', '20:00', '21:00', '22:30'].map((time) => ({ time, capacity: 1, active: true }))
const HOURS = { openTime: '18:00', closeTime: '23:00', isClosed: false }

// 2026-10-04 19:30 เวลาไทย = 12:30 UTC
const NOW_MS = Date.parse('2026-10-04T12:30:00Z')
const NOW = shopNow(NOW_MS)
const day = (date: string, o: Partial<Parameters<typeof computeDaySlots>[0]> = {}) =>
  computeDaySlots({ date, shopOpen: true, now: NOW, slots: SLOTS, hours: HOURS, holiday: null, counts: {}, unlimited: false, ...o })
const code = (fn: () => unknown) => {
  try { fn() } catch (e) { return e instanceof AppError ? e.code : `non-AppError:${String(e)}` }
  return null
}
const customer = { nickname: 'มิ้นท์', fullName: 'ชลธิชา ใจดี', age: '24', relationship: 'โสด' }

test('shopNow uses Thailand time regardless of server timezone', () => {
  assert.deepEqual(shopNow(Date.parse('2026-10-03T18:30:00Z')), { date: '2026-10-04', minutes: 90 })
  assert.deepEqual(shopNow(Date.parse('2026-10-03T16:59:00Z')), { date: '2026-10-03', minutes: 23 * 60 + 59 })
  assert.deepEqual(NOW, { date: '2026-10-04', minutes: 19 * 60 + 30 })
})

test('date helpers', () => {
  assert.ok(isISODate('2026-02-28'))
  assert.ok(!isISODate('2026-02-30'))
  assert.ok(!isISODate('2026-2-3'))
  assert.ok(!isISODate(20261004))
  assert.equal(addDaysISO('2026-10-30', 3), '2026-11-02')
  assert.equal(addDaysISO('2026-12-31', 1), '2027-01-01')
  assert.equal(dayOfWeek('2026-10-04'), 0) // อาทิตย์
  assert.equal(startMs('2026-10-04', '19:00'), Date.parse('2026-10-04T12:00:00Z'))
})

test('parseCustomer', () => {
  assert.deepEqual(parseCustomer(customer), { ...customer, age: 24, nickname: 'มิ้นท์' })
  assert.equal(code(() => parseCustomer({ ...customer, nickname: '  ' })), 'VALIDATION_CUSTOMER')
  assert.equal(code(() => parseCustomer({ ...customer, age: '0' })), 'VALIDATION_CUSTOMER')
  assert.equal(code(() => parseCustomer({ ...customer, age: 'abc' })), 'VALIDATION_CUSTOMER')
  assert.equal(code(() => parseCustomer({ ...customer, age: 24.5 })), 'VALIDATION_CUSTOMER')
  assert.equal(code(() => parseCustomer({ ...customer, relationship: '' })), 'VALIDATION_CUSTOMER')
  assert.equal(code(() => parseCustomer(null)), 'VALIDATION')
})

test('parseCreateBooking', () => {
  const ok = parseCreateBooking({ customer, serviceIds: ['q-3'], date: '2026-10-05', time: '20:00', note: ' hi ' })
  assert.equal(ok.note, 'hi')
  assert.equal(ok.questionCount, undefined)
  assert.equal(code(() => parseCreateBooking({ customer, serviceIds: [], date: '2026-10-05', time: '20:00' })), 'VALIDATION_SERVICE')
  assert.equal(code(() => parseCreateBooking({ customer, serviceIds: ['a', 'a'], date: '2026-10-05', time: '20:00' })), 'VALIDATION_SERVICE')
  assert.equal(code(() => parseCreateBooking({ customer, serviceIds: ['q-3'], date: '2026-13-05', time: '20:00' })), 'VALIDATION_SCHEDULE')
  assert.equal(code(() => parseCreateBooking({ customer, serviceIds: ['q-3'], date: '2026-10-05', time: '25:00' })), 'VALIDATION_SCHEDULE')
  assert.equal(code(() => parseCreateBooking({ customer, serviceIds: ['q-3'], date: '2026-10-05', time: '20:00', note: 'x'.repeat(501) })), 'VALIDATION')
  assert.equal(code(() => parseCreateBooking({ customer, serviceIds: ['q-custom'], questionCount: 2.5, date: '2026-10-05', time: '20:00' })), 'VALIDATION_SERVICE')
  assert.equal(code(() => parseCreateBooking('nope')), 'VALIDATION')
  // ไม่เชื่อราคาจาก client: ฟิลด์ price ถูกเมินเฉย
  const withPrice = parseCreateBooking({ customer, serviceIds: ['q-3'], date: '2026-10-05', time: '20:00', price: 1 }) as unknown as Record<string, unknown>
  assert.equal('price' in withPrice, false)
})

test('parseUpdateBooking', () => {
  assert.deepEqual(parseUpdateBooking({ note: 'x' }), { note: 'x' })
  assert.deepEqual(parseUpdateBooking({ date: '2026-10-06', time: '21:00' }), { date: '2026-10-06', time: '21:00' })
  assert.equal(code(() => parseUpdateBooking({ date: '2026-10-06' })), 'VALIDATION_SCHEDULE')
  assert.equal(code(() => parseUpdateBooking({})), 'VALIDATION')
})

test('parseClientId / parseSlotsQuery', () => {
  assert.equal(parseClientId('3f2b6c1e-8a44-4d6b-9a11-0c5e7d2f9a10'), '3f2b6c1e-8a44-4d6b-9a11-0c5e7d2f9a10')
  assert.equal(code(() => parseClientId(undefined)), 'CLIENT_ID_REQUIRED')
  assert.equal(code(() => parseClientId('short')), 'CLIENT_ID_REQUIRED')
  assert.equal(code(() => parseClientId('has space has space')), 'CLIENT_ID_REQUIRED')
  assert.deepEqual(parseSlotsQuery({ date: '2026-10-05', serviceIds: 'a,b' }), { date: '2026-10-05', serviceIds: ['a', 'b'] })
  assert.deepEqual(parseSlotsQuery({ date: '2026-10-05' }), { date: '2026-10-05', serviceIds: [] })
  assert.equal(code(() => parseSlotsQuery({})), 'VALIDATION_SCHEDULE')
})

test('resolveSelection: price computed on server', () => {
  assert.equal(resolveSelection(SERVICES, { serviceIds: ['q-3'] }, true).price, 79)
  assert.equal(resolveSelection(SERVICES, { serviceIds: ['q-custom'], questionCount: 7 }, true).price, 203)
  assert.equal(resolveSelection(SERVICES, { serviceIds: ['l-new', 'w-now', 'ch-uni'] }, true).price, 59 + 129 + 69)
  const o = resolveSelection(SERVICES, { serviceIds: ['ch-other', 'l-new'], otherQuestion: '  ย้ายบ้านดีไหม ' }, true)
  assert.equal(o.otherQuestion, 'ย้ายบ้านดีไหม')
  assert.equal(o.price, 49 + 59)
  assert.equal(resolveSelection(SERVICES, { serviceIds: ['c-30'] }, true).isCall, true)
})

test('resolveSelection: rejections', () => {
  const c = (input: Parameters<typeof resolveSelection>[1], calls = true) => code(() => resolveSelection(SERVICES, input, calls))
  assert.equal(c({ serviceIds: ['nope'] }), 'SERVICE_NOT_FOUND')
  assert.equal(c({ serviceIds: ['s-old'] }), 'SERVICE_UNAVAILABLE')
  assert.equal(c({ serviceIds: ['q-3', 'c-30'] }), 'SELECTION_INVALID')
  assert.equal(c({ serviceIds: ['t-money', 'l-new'] }), 'SELECTION_INVALID')
  assert.equal(c({ serviceIds: ['c-30'] }, false), 'CALLS_DISABLED')
  assert.equal(c({ serviceIds: ['q-custom'] }), 'VALIDATION_SERVICE')
  assert.equal(c({ serviceIds: ['q-custom'], questionCount: 0 }), 'VALIDATION_SERVICE')
  assert.equal(c({ serviceIds: ['q-custom'], questionCount: 51 }), 'VALIDATION_SERVICE')
  assert.equal(c({ serviceIds: ['ch-other'], otherQuestion: '   ' }), 'VALIDATION_SERVICE')
})

test('computeDaySlots: window of 7 days', () => {
  assert.equal(day('2026-10-04').closed, false)
  assert.equal(day('2026-10-10').closed, false) // วันที่ 7
  const far = day('2026-10-11')
  assert.equal(far.closed, true); assert.equal(far.reasonCode, 'DATE_OUT_OF_RANGE')
  assert.equal(day('2026-10-03').reasonCode, 'DATE_OUT_OF_RANGE')
})

test('computeDaySlots: today past slots closed', () => {
  const today = day('2026-10-04').slots // ตอนนี้ 19:30
  assert.deepEqual(today.map((s) => s.status), ['closed', 'closed', 'available', 'available', 'available'])
  assert.deepEqual(day('2026-10-05').slots.map((s) => s.status), Array(5).fill('available'))
})

test('computeDaySlots: unlimited only 22:30', () => {
  const s = day('2026-10-05', { unlimited: true }).slots
  assert.deepEqual(s.map((x) => x.status), ['closed', 'closed', 'closed', 'closed', 'available'])
})

test('computeDaySlots: capacity / full', () => {
  assert.equal(day('2026-10-05', { counts: { '20:00': 1 } }).slots[2].status, 'full')
  const two = SLOTS.map((s) => (s.time === '20:00' ? { ...s, capacity: 2 } : s))
  assert.equal(day('2026-10-05', { slots: two, counts: { '20:00': 1 } }).slots[2].status, 'available')
  assert.equal(day('2026-10-05', { slots: two, counts: { '20:00': 2 } }).slots[2].status, 'full')
})

test('computeDaySlots: holiday, closed weekday, inactive slot, outside hours', () => {
  const h = day('2026-10-06', { holiday: { reason: 'หยุดพิเศษ' } })
  assert.equal(h.closed, true); assert.equal(h.reason, 'หยุดพิเศษ'); assert.equal(h.reasonCode, 'DAY_CLOSED')
  assert.equal(day('2026-10-06', { hours: { ...HOURS, isClosed: true } }).closed, true)
  assert.equal(day('2026-10-06', { hours: null }).closed, true)
  const inactive = SLOTS.map((s) => (s.time === '19:00' ? { ...s, active: false } : s))
  assert.equal(day('2026-10-06', { slots: inactive }).slots[1].status, 'closed')
  const short = day('2026-10-06', { hours: { openTime: '19:00', closeTime: '22:00', isClosed: false } }).slots
  assert.deepEqual(short.map((x) => x.status), ['closed', 'available', 'available', 'available', 'closed'])
})

test('assertSlotAvailable error codes', () => {
  assert.equal(code(() => assertSlotAvailable(day('2026-10-05'), '20:00')), null)
  assert.equal(code(() => assertSlotAvailable(day('2026-10-05', { counts: { '20:00': 1 } }), '20:00')), 'SLOT_FULL')
  assert.equal(code(() => assertSlotAvailable(day('2026-10-05'), '03:00')), 'SLOT_CLOSED')
  assert.equal(code(() => assertSlotAvailable(day('2026-10-04'), '18:00')), 'SLOT_CLOSED')
  assert.equal(code(() => assertSlotAvailable(day('2026-10-20'), '20:00')), 'DATE_OUT_OF_RANGE')
  assert.equal(code(() => assertSlotAvailable(day('2026-10-06', { holiday: { reason: '' } }), '20:00')), 'DAY_CLOSED')
})

test('nextBookingId', () => {
  assert.equal(nextBookingId([], '2026-10-05'), 'WY-20261005-001')
  assert.equal(nextBookingId(['WY-20261005-005', 'WY-20261005-002', 'WY-20261006-009'], '2026-10-05'), 'WY-20261005-006')
  assert.equal(nextBookingId(['WY-20261005-005'], '2026-10-06'), 'WY-20261006-001')
  assert.equal(nextBookingId(['WY-20261005-999'], '2026-10-05'), 'WY-20261005-1000')
})

test('bookingEndMs / isEditable', () => {
  const start = startMs('2026-10-05', '20:00')
  assert.equal(bookingEndMs('2026-10-05', '20:00', [{ durationMin: 30, unlimited: false }]), start + 60 * 60000)
  assert.equal(bookingEndMs('2026-10-05', '20:00', [{ durationMin: 90, unlimited: false }]), start + 90 * 60000)
  assert.equal(bookingEndMs('2026-10-05', '20:00', [{ durationMin: null, unlimited: true }]), start + 120 * 60000)
  const b = { status: 'confirmed', expiresAtMs: 0, date: '2026-10-05', time: '20:00' }
  assert.equal(isEditable(b, NOW_MS), true)
  assert.equal(isEditable(b, start + 1), false)
  assert.equal(isEditable({ ...b, status: 'cancelled' }, NOW_MS), false)
  assert.equal(isEditable({ ...b, status: 'completed' }, NOW_MS), false)
  assert.equal(isEditable({ ...b, status: 'pending_payment', expiresAtMs: NOW_MS + 1 }, NOW_MS), true)
  assert.equal(isEditable({ ...b, status: 'pending_payment', expiresAtMs: NOW_MS }, NOW_MS), false)
})

test('toBookingDto matches frontend Booking shape', () => {
  const dto = toBookingDto({
    id: 'WY-20261005-001', serviceIds: ['l-new', 'w-now'], serviceName: 'l-new, w-now', questionCount: null, otherQuestion: null,
    price: 188, date: '2026-10-05', time: '20:00', note: '', nickname: 'มิ้นท์', fullName: 'ชลธิชา', age: 24, relationship: 'โสด',
    isCall: false, status: 'pending_payment', expiresAt: new Date(1000), createdAt: new Date(500),
  })
  assert.equal(dto.serviceId, 'l-new')
  assert.equal(dto.customer.age, '24')
  assert.equal(dto.questionCount, undefined)
  assert.equal(dto.expiresAt, 1000)
  assert.equal(dto.createdAt, 500)
})
