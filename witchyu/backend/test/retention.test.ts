import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../src/db'
import { cleanupExpiredPaymentProofs } from '../src/services/paymentProofService'

const createdProofIds: string[] = []
const createdBookingIds: string[] = []
const createdUserIds: string[] = []

const makeProof = async (
  submittedAt: Date,
  storageProvider = 'database',
) => {
  const user = await prisma.user.create({
    data: {
      clientId: `test-retention-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      nickname: 'Retention Test',
      fullName: 'Retention Test User',
      age: 21,
      relationship: 'single',
    },
  })
  createdUserIds.push(user.id)

  const booking = await prisma.booking.create({
    data: {
      id: `TEST-RETENTION-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: user.id,
      serviceIds: ['test-service'],
      serviceName: 'Retention Test',
      price: 99,
      date: '2099-12-31',
      time: '22:30',
      nickname: user.nickname,
      fullName: user.fullName,
      age: user.age,
      relationship: user.relationship,
      isCall: false,
      expiresAt: new Date('2099-12-31T23:59:00.000Z'),
    },
  })
  createdBookingIds.push(booking.id)

  const proof = await prisma.paymentProof.create({
    data: {
      bookingId: booking.id,
      mimeType: 'image/jpeg',
      originalName: 'retention-test.jpg',
      size: 100,
      storageProvider,
      submittedAt,
    },
  })
  createdProofIds.push(proof.id)

  return proof
}

afterEach(async () => {
  if (createdProofIds.length) {
    await prisma.paymentProof.deleteMany({
      where: { id: { in: createdProofIds } },
    })
    createdProofIds.length = 0
  }

  if (createdBookingIds.length) {
    await prisma.booking.deleteMany({
      where: { id: { in: createdBookingIds } },
    })
    createdBookingIds.length = 0
  }

  if (createdUserIds.length) {
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    })
    createdUserIds.length = 0
  }
})

test('retention: deletes payment proofs older than cutoff', async () => {
  const now = Date.now()
  const proof = await makeProof(new Date(now - 31 * 24 * 60 * 60 * 1000))
  const cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000)

  const result = await cleanupExpiredPaymentProofs(cutoff)
  const remaining = await prisma.paymentProof.findUnique({
    where: { id: proof.id },
  })

  assert.equal(result.deleted, 1)
  assert.equal(remaining, null)
})

test('retention: keeps payment proofs newer than cutoff', async () => {
  const now = Date.now()
  const proof = await makeProof(new Date(now - 29 * 24 * 60 * 60 * 1000))
  const cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000)

  const result = await cleanupExpiredPaymentProofs(cutoff)
  const remaining = await prisma.paymentProof.findUnique({
    where: { id: proof.id },
  })

  assert.equal(result.deleted, 0)
  assert.equal(remaining?.id, proof.id)
})

test('retention: keeps proof when stored file deletion fails', async () => {
  const now = Date.now()
  const proof = await makeProof(
    new Date(now - 31 * 24 * 60 * 60 * 1000),
    'invalid-test-provider',
  )
  const cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000)

  const result = await cleanupExpiredPaymentProofs(cutoff)
  const remaining = await prisma.paymentProof.findUnique({
    where: { id: proof.id },
  })

  assert.equal(result.failed, 1)
  assert.equal(remaining?.id, proof.id)
})
