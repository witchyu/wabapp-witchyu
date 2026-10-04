import { createApp } from './app'
import { config } from './config'
import { prisma } from './db'

const app = createApp()
const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`Witchyu API listening on :${config.port}`)
})

// หมายเหตุ: ไม่มี timer ยิงฐานข้อมูลเป็นระยะ เพื่อให้ Neon ปิดเครื่องได้เมื่อไม่มีคนใช้ (ประหยัดโควตาฟรี)
// สถานะหมดเวลา/เสร็จสิ้นของการจองถูกอัปเดตทุกครั้งที่มีคนเรียก API (settleBookings)

async function shutdown() {
  server.close()
  await prisma.$disconnect()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
