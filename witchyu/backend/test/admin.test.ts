import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AppError } from '../src/domain/errors'
import { DUMMY_HASH, hashPassword, verifyPassword } from '../src/domain/password'
import { signToken, verifyToken } from '../src/domain/token'
import { LoginLimiter } from '../src/domain/loginLimiter'
import { computeOpenNow, formatHoursLabel, type HoursFull } from '../src/domain/shop'
import { computeDaySlots, assertSlotAvailable } from '../src/domain/rules'
import { shopNow } from '../src/domain/time'
import {
  parseAdminBookingsQuery, parseHolidayCreate, parseHoursAll, parseLogin, parseServiceCreate, parseServicePatch,
  parseSettingsPatch, parseSlotCreate, parseSlotPatch,
} from '../src/domain/adminValidation'
import { toAdminServiceDto } from '../src/domain/dto'

const code = (fn: () => unknown) => {
  try { fn() } catch (e) { return e instanceof AppError ? e.code : `non-AppError:${String(e)}` }
  return null
}
const SECRET = 'x'.repeat(40)

test('password hashing: verify ok / wrong / malformed / dummy', async () => {
  const h = await hashPassword('correct horse battery')
  assert.match(h, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/)
  assert.equal(await verifyPassword('correct horse battery', h), true)
  assert.equal(await verifyPassword('wrong password!!', h), false)
  assert.equal(await verifyPassword('x', 'garbage'), false)
  assert.equal(await verifyPassword('x', 'scrypt$$'), false)
  assert.equal(await verifyPassword('anything', DUMMY_HASH), false)
  assert.notEqual(await hashPassword('same'), await hashPassword('same'), 'unique salt per hash')
})

test('token: sign / verify / expiry / tamper', () => {
  const now = 1_800_000_000_000
  const { token, expiresAt } = signToken('admin1', SECRET, now, 3600_000)
  assert.equal(expiresAt, Math.floor((now + 3600_000) / 1000) * 1000)
  assert.equal(verifyToken(token, SECRET, now + 1000)?.sub, 'admin1')
  assert.equal(verifyToken(token, SECRET, now + 3600_000), null, 'expired')
  assert.equal(verifyToken(token, 'y'.repeat(40), now + 1000), null, 'wrong secret')
  const [body, sig] = token.split('.')
  const forged = Buffer.from(JSON.stringify({ sub: 'admin2', iat: 1, exp: 9_999_999_999 })).toString('base64url')
  assert.equal(verifyToken(`${forged}.${sig}`, SECRET, now), null, 'payload swapped')
  assert.equal(verifyToken(`${body}.${sig}x`, SECRET, now), null, 'sig altered')
  assert.equal(verifyToken('', SECRET, now), null)
  assert.equal(verifyToken('a.b.c', SECRET, now), null)
  assert.equal(verifyToken('x'.repeat(3000), SECRET, now), null)
})

test('login limiter: blocks after max, window slides, reset clears', () => {
  const l = new LoginLimiter(3, 60_000)
  assert.equal(l.retryAfterSec('k', 0), 0)
  l.fail('k', 0); l.fail('k', 1000); l.fail('k', 2000)
  assert.equal(l.retryAfterSec('k', 3000), 57)
  assert.equal(l.retryAfterSec('other', 3000), 0)
  // ครั้งแรก (t=0) หลุดหน้าต่าง 60 วินาทีที่ t=60000 เหลือ 2 ครั้ง < 3 จึงลองได้อีก
  assert.equal(l.retryAfterSec('k', 60_000), 0)
  l.fail('k', 60_500)
  assert.equal(l.retryAfterSec('k', 60_600), 1) // 1000/2000/60500 อยู่ในหน้าต่าง → ถูกบล็อกจน t=61000 หลุด
  assert.equal(l.retryAfterSec('k', 61_000), 0)
  l.reset('k')
  assert.equal(l.retryAfterSec('k', 3000), 0)
})

test('formatHoursLabel', () => {
  const all = (o: Partial<HoursFull> = {}): HoursFull[] => Array.from({ length: 7 }, (_, d) => ({ dayOfWeek: d, openTime: '18:00', closeTime: '23:00', isClosed: false, ...o }))
  assert.equal(formatHoursLabel(all()), 'ทุกวัน 18:00 – 23:00 น.')
  assert.equal(formatHoursLabel(all({ isClosed: true })), 'ปิดทุกวัน')
  const weekend = all().map((r) => (r.dayOfWeek === 0 || r.dayOfWeek === 6 ? { ...r, isClosed: true } : r))
  assert.equal(formatHoursLabel(weekend), 'จ.–ศ. 18:00 – 23:00 น. · ส.–อา. ปิด')
  const oneDay = all().map((r) => (r.dayOfWeek === 3 ? { ...r, isClosed: true } : r))
  assert.equal(formatHoursLabel(oneDay), 'จ.–อ. 18:00 – 23:00 น. · พ. ปิด · พฤ.–อา. 18:00 – 23:00 น.')
  assert.equal(formatHoursLabel([]), 'ปิดทุกวัน')
})

test('computeOpenNow', () => {
  const h: HoursFull = { dayOfWeek: 0, openTime: '18:00', closeTime: '23:00', isClosed: false }
  const at = (m: number) => ({ date: '2026-10-04', minutes: m })
  assert.equal(computeOpenNow({ shopOpen: true, now: at(19 * 60), hoursToday: h, holidayToday: false }), true)
  assert.equal(computeOpenNow({ shopOpen: true, now: at(18 * 60), hoursToday: h, holidayToday: false }), true)
  assert.equal(computeOpenNow({ shopOpen: true, now: at(23 * 60), hoursToday: h, holidayToday: false }), false)
  assert.equal(computeOpenNow({ shopOpen: true, now: at(10 * 60), hoursToday: h, holidayToday: false }), false)
  assert.equal(computeOpenNow({ shopOpen: false, now: at(19 * 60), hoursToday: h, holidayToday: false }), false)
  assert.equal(computeOpenNow({ shopOpen: true, now: at(19 * 60), hoursToday: h, holidayToday: true }), false)
  assert.equal(computeOpenNow({ shopOpen: true, now: at(19 * 60), hoursToday: { ...h, isClosed: true }, holidayToday: false }), false)
  assert.equal(computeOpenNow({ shopOpen: true, now: at(19 * 60), hoursToday: null, holidayToday: false }), false)
})

test('shop switch closes every slot (SHOP_CLOSED)', () => {
  const now = shopNow(Date.parse('2026-10-04T05:00:00Z')) // 12:00 ไทย
  const day = computeDaySlots({
    date: '2026-10-05', shopOpen: false, now, unlimited: false, holiday: null, counts: {},
    hours: { openTime: '18:00', closeTime: '23:00', isClosed: false },
    slots: [{ time: '19:00', capacity: 1, active: true }],
  })
  assert.equal(day.closed, true); assert.equal(day.reasonCode, 'SHOP_CLOSED')
  assert.equal(code(() => assertSlotAvailable(day, '19:00')), 'SHOP_CLOSED')
})

test('parseLogin', () => {
  assert.deepEqual(parseLogin({ username: ' Admin ', password: 'pw' }), { username: 'admin', password: 'pw' })
  assert.equal(code(() => parseLogin({ username: '', password: 'x' })), 'VALIDATION')
  assert.equal(code(() => parseLogin({ username: 'a', password: '' })), 'VALIDATION')
  assert.equal(code(() => parseLogin({ username: 'a', password: 5 })), 'VALIDATION')
  assert.equal(code(() => parseLogin(null)), 'VALIDATION')
})

test('parseServiceCreate / parseServicePatch', () => {
  const ok = parseServiceCreate({ group: 'topic', name: ' สุขภาพ ', price: '129' })
  assert.deepEqual(ok, { group: 'topic', name: 'สุขภาพ', description: '', price: 129, durationMin: null, unlimited: false, perQuestion: false, questions: [], active: true })
  assert.equal(code(() => parseServiceCreate({ group: 'nope', name: 'a', price: 1 })), 'VALIDATION')
  assert.equal(code(() => parseServiceCreate({ group: 'call', name: '', price: 1 })), 'VALIDATION')
  assert.equal(code(() => parseServiceCreate({ group: 'call', name: 'a', price: 0 })), 'VALIDATION')
  assert.equal(code(() => parseServiceCreate({ group: 'call', name: 'a', price: 1.5 })), 'VALIDATION')
  assert.equal(code(() => parseServiceCreate({ group: 'call', name: 'a', price: 100001 })), 'VALIDATION')
  assert.equal(code(() => parseServiceCreate({ group: 'call', name: 'a', price: 5, durationMin: 0 })), 'VALIDATION')
  assert.equal(code(() => parseServiceCreate({ group: 'call', name: 'a', price: 5, questions: [''] })), 'VALIDATION')
  assert.equal(code(() => parseServiceCreate({ group: 'call', name: 'a', price: 5, active: 'yes' })), 'VALIDATION')
  assert.deepEqual(parseServicePatch({ price: 99, active: false, durationMin: null }), { price: 99, active: false, durationMin: null })
  assert.equal(code(() => parseServicePatch({})), 'VALIDATION')
  // ฟิลด์แปลกปลอม (เช่น id, sortOrder) ไม่ถูกส่งต่อ
  assert.deepEqual(parseServicePatch({ price: 10, id: 'hack', sortOrder: 99 }), { price: 10 })
})

test('slots / hours / holiday / settings / bookings query validation', () => {
  assert.deepEqual(parseSlotCreate({ time: '20:30' }), { time: '20:30', capacity: 1, active: true })
  assert.equal(code(() => parseSlotCreate({ time: '25:00' })), 'VALIDATION')
  assert.equal(code(() => parseSlotCreate({ time: '20:00', capacity: 0 })), 'VALIDATION')
  assert.equal(code(() => parseSlotCreate({ time: '20:00', capacity: 21 })), 'VALIDATION')
  assert.deepEqual(parseSlotPatch({ capacity: 3 }), { capacity: 3 })
  assert.equal(code(() => parseSlotPatch({ time: '10:00' })), 'VALIDATION')

  const hours = Array.from({ length: 7 }, (_, d) => ({ dayOfWeek: d, openTime: '18:00', closeTime: '23:00', isClosed: false }))
  assert.equal(parseHoursAll({ hours }).length, 7)
  assert.equal(code(() => parseHoursAll({ hours: hours.slice(0, 6) })), 'VALIDATION')
  assert.equal(code(() => parseHoursAll({ hours: hours.map((h) => ({ ...h, dayOfWeek: 1 })) })), 'VALIDATION')
  assert.equal(code(() => parseHoursAll({ hours: hours.map((h, i) => (i === 2 ? { ...h, openTime: '23:00', closeTime: '18:00' } : h)) })), 'VALIDATION')
  // วันที่ปิดทำการไม่ต้องตรวจลำดับเวลา
  assert.equal(parseHoursAll({ hours: hours.map((h, i) => (i === 2 ? { ...h, openTime: '23:00', closeTime: '18:00', isClosed: true } : h)) })[2].isClosed, true)

  assert.deepEqual(parseHolidayCreate({ date: '2026-12-31', reason: ' ปีใหม่ ' }), { date: '2026-12-31', reason: 'ปีใหม่' })
  assert.equal(code(() => parseHolidayCreate({ date: '2026-02-30' })), 'VALIDATION')
  assert.deepEqual(parseSettingsPatch({ shopOpen: false }), { shopOpen: false })
  assert.equal(code(() => parseSettingsPatch({ shopOpen: 'no' })), 'VALIDATION')
  assert.equal(code(() => parseSettingsPatch({})), 'VALIDATION')

  assert.deepEqual(parseAdminBookingsQuery({}), { status: 'active', date: undefined, search: undefined, page: 1, pageSize: 25 })
  assert.equal(parseAdminBookingsQuery({ status: 'cancelled', date: '2026-10-05', search: ' มิ้นท์ ', page: '2' }).page, 2)
  assert.equal(code(() => parseAdminBookingsQuery({ status: 'weird' })), 'VALIDATION')
  assert.equal(code(() => parseAdminBookingsQuery({ date: 'x' })), 'VALIDATION')
  assert.equal(code(() => parseAdminBookingsQuery({ page: '0' })), 'VALIDATION')
})

test('toAdminServiceDto keeps explicit false/empty values', () => {
  const dto = toAdminServiceDto({ id: 'a', group: 'call', name: 'n', description: '', price: 5, durationMin: null, unlimited: false, perQuestion: false, questions: [], active: true, sortOrder: 3 })
  assert.equal(dto.unlimited, false); assert.equal(dto.durationMin, null); assert.deepEqual(dto.questions, []); assert.equal(dto.sortOrder, 3)
})
