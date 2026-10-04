import { Prisma, PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()

// ใช้ได้ทั้ง client ปกติและ client ภายใน Transaction
export type Db = PrismaClient | Prisma.TransactionClient
