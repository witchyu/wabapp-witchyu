import { createServer } from 'node:http'
import { createApp } from './app'
import { config } from './config'
import { prisma } from './db'
import { initSocket } from './socket'
import { cleanupExpiredData } from './services/retentionService'

const app = createApp()
const httpServer = createServer(app)
const io = initSocket(httpServer) // Socket.IO ใช้พอร์ตเดียวกับ API

httpServer.listen(config.port, '0.0.0.0', () => {
  console.log(`Witchyu API + realtime listening on :${config.port}`)

  // Cleanup ทำเพียงครั้งเดียวตอน server เริ่ม ไม่ใช้ timer
  // เพื่อไม่ปลุก Neon เป็นระยะโดยไม่จำเป็น
  cleanupExpiredData()
    .then((result) => {
      console.log('[retention] cleanup completed', result)
    })
    .catch((error) => {
      console.error('[retention] cleanup failed', error)
    })
})

// หมายเหตุ: ไม่มี timer ยิงฐานข้อมูลเป็นระยะ เพื่อให้ Neon ปิดเครื่องได้เมื่อไม่มีคนใช้ (ประหยัดโควตาฟรี)
// สถานะหมดเวลา/เสร็จสิ้นของการจองถูกอัปเดตทุกครั้งที่มีคนเรียก API (settleBookings)

async function shutdown() {
  io.close()
  httpServer.close()
  await prisma.$disconnect()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
