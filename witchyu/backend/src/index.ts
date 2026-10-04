import { createApp } from './app'
import { config } from './config'
import { prisma } from './db'
import { settleBookings } from './services/bookingService'

const app = createApp()
const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`Witchyu API listening on :${config.port}`)
})

// อัปเดตสถานะตามเวลาเป็นระยะ (หมดเวลาชำระ / เสร็จสิ้น) นอกจากตอนมีคนเรียก API
const timer = setInterval(() => {
  settleBookings().catch((e) => console.error('[settle]', e))
}, 60_000)

async function shutdown() {
  clearInterval(timer)
  server.close()
  await prisma.$disconnect()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
