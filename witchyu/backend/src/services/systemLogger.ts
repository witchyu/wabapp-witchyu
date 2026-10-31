import { prisma } from '../db'
type Level = 'info' | 'warn' | 'error'
export async function writeSystemLog(
  level: Level,
  event: string,
  message: string,
) {
  try {
    await prisma.systemLog.create({
      data: {
        level,
        event: event.slice(0, 100),
        message: message.slice(0, 500),
      },
    })
  } catch (error) {
    console.error('[system-log] write failed', error)
  }
}
export const systemLogger = {
  info: (event: string, message: string) =>
    writeSystemLog('info', event, message),
  warn: (event: string, message: string) =>
    writeSystemLog('warn', event, message),
  error: (event: string, message: string) =>
    writeSystemLog('error', event, message),
}
