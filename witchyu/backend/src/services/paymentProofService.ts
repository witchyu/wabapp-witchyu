import { safeCreateNotification } from './notificationService'
import { prisma } from '../db'
import { AppError } from '../domain/errors'

const MAX_FILE_SIZE = 2 * 1024 * 1024

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

type UploadedProof = {
  buffer: Buffer
  mimetype: string
  originalname: string
  size: number
}

function detectImageType(buffer: Buffer): string | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) return 'image/jpeg'

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    )
  ) return 'image/png'

  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) return 'image/webp'

  return null
}

function validateFile(file: UploadedProof) {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    throw new AppError(400, 'FILE_REQUIRED', 'กรุณาเลือกไฟล์สลิป')
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new AppError(413, 'FILE_TOO_LARGE', 'ไฟล์ต้องมีขนาดไม่เกิน 2 MB')
  }

  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    throw new AppError(415, 'UNSUPPORTED_FILE', 'รองรับเฉพาะ JPG, PNG และ WebP')
  }

  const detectedType = detectImageType(file.buffer)

  if (!detectedType || detectedType !== file.mimetype) {
    throw new AppError(415, 'INVALID_IMAGE', 'ไฟล์ภาพไม่ถูกต้อง')
  }
}

export async function uploadPaymentProof(
  bookingId: string,
  clientId: string,
  file: UploadedProof
) {
  validateFile(file)

  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      user: { clientId },
    },
    include: {
      paymentProofs: {
        where: { status: 'pending' },
        select: { id: true },
      },
    },
  })

  if (!booking) {
    throw new AppError(404, 'BOOKING_NOT_FOUND', 'ไม่พบรายการจอง')
  }

  if (booking.status !== 'pending_payment') {
    throw new AppError(409, 'INVALID_BOOKING_STATUS', 'รายการจองนี้ไม่สามารถส่งสลิปได้')
  }

  if (booking.expiresAt <= new Date()) {
    throw new AppError(409, 'PAYMENT_EXPIRED', 'หมดเวลาชำระเงินแล้ว')
  }

  if (booking.paymentProofs.length > 0) {
    throw new AppError(409, 'PROOF_ALREADY_PENDING', 'มีสลิปรอตรวจสอบอยู่แล้ว')
  }

  return prisma.paymentProof.create({
    data: {
      bookingId,
      mimeType: file.mimetype,
      data: file.buffer,
      originalName: file.originalname.slice(0, 255),
      size: file.size,
    },
    select: {
      id: true,
      bookingId: true,
      mimeType: true,
      originalName: true,
      size: true,
      status: true,
      submittedAt: true,
    },
  })
}

export async function getCustomerPaymentProof(
  bookingId: string,
  clientId: string
) {
  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      user: { clientId },
    },
    include: {
      paymentProofs: {
        orderBy: { submittedAt: 'desc' },
        select: {
          id: true,
          mimeType: true,
          originalName: true,
          size: true,
          status: true,
          submittedAt: true,
          reviewedAt: true,
          reviewNote: true,
        },
      },
    },
  })

  if (!booking) {
    throw new AppError(404, 'BOOKING_NOT_FOUND', 'ไม่พบรายการจอง')
  }

  return booking.paymentProofs
}

export async function deleteCustomerPaymentProof(
  bookingId: string,
  clientId: string
) {
  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      user: { clientId },
    },
    include: {
      paymentProofs: {
        where: { status: 'pending' },
      },
    },
  })

  if (!booking) {
    throw new AppError(404, 'BOOKING_NOT_FOUND', 'ไม่พบรายการจอง')
  }

  const proof = booking.paymentProofs[0]

  if (!proof) {
    throw new AppError(404, 'PROOF_NOT_FOUND', 'ไม่พบสลิปที่รอการตรวจสอบ')
  }

  await prisma.paymentProof.delete({
    where: { id: proof.id },
  })

  return { ok: true }
}


export async function getAdminPaymentProof(bookingId: string) {
  const proof = await prisma.paymentProof.findFirst({
    where: { bookingId },
    orderBy: { submittedAt: 'desc' },
    select: {
      id: true,
      bookingId: true,
      mimeType: true,
      data: true,
      originalName: true,
      size: true,
      status: true,
      submittedAt: true,
      reviewedAt: true,
      reviewNote: true,
    },
  })

  if (!proof) throw new AppError(404, 'PROOF_NOT_FOUND', 'ไม่พบสลิป')
  return proof
}

export async function reviewPaymentProof(
  bookingId: string,
  adminId: string,
  decision: 'approved' | 'rejected',
  note?: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const proof = await tx.paymentProof.findFirst({
      where: { bookingId, status: 'pending' },
      orderBy: { submittedAt: 'desc' },
    })

    if (!proof) throw new AppError(404, 'PROOF_NOT_FOUND', 'ไม่พบสลิปที่รอตรวจสอบ')

    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { user: { select: { clientId: true } } },
    })
    if (!booking || booking.status !== 'pending_payment') {
      throw new AppError(409, 'INVALID_BOOKING_STATUS', 'รายการจองนี้ไม่อยู่ในสถานะรอชำระเงิน')
    }

    const now = new Date()

    await tx.paymentProof.update({
      where: { id: proof.id },
      data: {
        status: decision,
        reviewedAt: now,
        reviewedByAdminId: adminId,
        reviewNote: note?.slice(0, 500) || null,
      },
    })

    if (decision === 'approved') {
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'confirmed' },
      })
    } else {
      await tx.booking.update({
        where: { id: bookingId },
        data: { expiresAt: new Date(now.getTime() + 15 * 60 * 1000) },
      })
    }

    return {
      ok: true,
      status: decision,
      clientId: booking.user.clientId,
      serviceName: booking.serviceName,
      date: booking.date,
      time: booking.time,
    }
  })

  await safeCreateNotification({
    clientId: result.clientId,
    type: 'payment',
    title: result.status === 'approved' ? 'ยืนยันการชำระเงินแล้ว' : 'หลักฐานการชำระเงินไม่ผ่าน',
    message: result.status === 'approved'
      ? `การจอง ${bookingId} ได้รับการยืนยันแล้ว`
      : `กรุณาตรวจสอบสลิปและส่งหลักฐานใหม่สำหรับการจอง ${bookingId}`,
    data: {
      bookingId,
      status: result.status,
      serviceName: result.serviceName,
      date: result.date,
      time: result.time,
    },
  })

  return { ok: true, status: result.status }
}

export async function deleteAdminPaymentProof(bookingId: string) {
  const proof = await prisma.paymentProof.findFirst({
    where: { bookingId },
    orderBy: { submittedAt: 'desc' },
  })

  if (!proof) throw new AppError(404, 'PROOF_NOT_FOUND', 'ไม่พบสลิป')

  await prisma.paymentProof.delete({ where: { id: proof.id } })
  return { ok: true }
}
