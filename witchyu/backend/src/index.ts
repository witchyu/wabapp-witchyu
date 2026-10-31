import { systemLogger } from './services/systemLogger'
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

  let cleanupRunning = false
  const runRetentionCleanup = async () => {
    if (cleanupRunning) return
    cleanupRunning = true
    try {
      const result = await cleanupExpiredData()
      console.log('[retention] cleanup completed', result)
    void systemLogger.info('retention.cleanup', JSON.stringify(result))
    } catch (error) {
      console.error('[retention] cleanup failed', error)
    void systemLogger.error('retention.cleanup.failed', error instanceof Error ? error.message : String(error))
    } finally {
      cleanupRunning = false
    }
  }
  void runRetentionCleanup()
  const retentionTimer = setInterval(() => {
    void runRetentionCleanup()
  }, 24 * 60 * 60 * 1000)
  retentionTimer.unref()
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
