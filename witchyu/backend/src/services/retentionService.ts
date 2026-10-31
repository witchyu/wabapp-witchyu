import { prisma } from '../db'
import { config } from '../config'

function cutoffDays(days: number, now = Date.now()): Date {
  return new Date(now - Math.max(0, days) * 24 * 60 * 60 * 1000)
}

export async function cleanupExpiredData(now = Date.now()) {
  const settings = await prisma.shopSetting.findUnique({
    where: { id: 1 },
  })

  const chatDays = settings?.chatRetentionDays ?? config.chatRetentionDays
  const callDays = settings?.callRecordRetentionDays ?? config.callRecordRetentionDays
  const bookingDays = settings?.bookingRetentionDays ?? config.bookingRetentionDays
  const customerDays = settings?.customerDataRetentionDays ?? config.customerDataRetentionDays
  const systemLogDays = settings?.systemLogRetentionDays ?? config.systemLogRetentionDays

  const chatCutoff = cutoffDays(chatDays, now)
  const callCutoff = cutoffDays(callDays, now)
  const bookingCutoff = cutoffDays(bookingDays, now)
  const customerCutoff = cutoffDays(customerDays, now)

  // ลบข้อความเก่าก่อน เพื่อไม่ให้เหลือข้อมูลที่อ้างถึง Booking ที่จะถูกลบ
  const deletedMessages = await prisma.message.deleteMany({
    where: {
      createdAt: { lt: chatCutoff },
      booking: {
        status: {
          in: ['completed', 'cancelled'],
        },
      },
    },
  })

  // CallSession เป็นข้อมูลชั่วคราวของระบบโทร
  const deletedCallSessions = await prisma.callSession.deleteMany({
    where: {
      createdAt: { lt: callCutoff },
      booking: {
        status: {
          in: ['completed', 'cancelled'],
        },
      },
    },
  })

  // ลบเฉพาะ Booking ที่ไม่ใช่รายการที่กำลังใช้งาน
  // confirmed ไม่ถูกลบโดย retention นี้ เพื่อป้องกันการลบการจองที่ยังมีผล
  const deletedBookings = await prisma.booking.deleteMany({
    where: {
      createdAt: { lt: bookingCutoff },
      status: {
        in: ['completed', 'cancelled'],
      },
      messages: {
        none: {},
      },
      calls: {
        none: {},
      },
    },
  })

  // ลบ User เฉพาะกรณีไม่มี Booking/Message เหลืออยู่แล้ว
  // Booking เก็บ snapshot ข้อมูลลูกค้าไว้แยกต่างหาก
  const deletedCustomers = await prisma.user.deleteMany({
    where: {
      updatedAt: { lt: customerCutoff },
      bookings: { none: {} },
      messages: { none: {} },
    },
  })

  const deletedSystemLogs = await prisma.systemLog.deleteMany({
    where: {
      createdAt: { lt: cutoffDays(systemLogDays, now) },
    },
  })
  return {
    deletedMessages: deletedMessages.count,
    deletedCallSessions: deletedCallSessions.count,
    deletedBookings: deletedBookings.count,
    deletedCustomers: deletedCustomers.count,
    deletedSystemLogs: deletedSystemLogs.count,
    retention: {
      customerDataDays: customerDays,
      bookingDays: bookingDays,
      chatDays: chatDays,
      callRecordDays: callDays,
      systemLogDays: systemLogDays,
    },
  }
}
