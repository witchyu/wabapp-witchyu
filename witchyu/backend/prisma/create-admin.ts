import { PrismaClient } from '@prisma/client'
import { MIN_PASSWORD_LENGTH, hashPassword } from '../src/domain/password'

// สร้าง/เปลี่ยนรหัสผ่านแอดมิน: อ่านจาก backend/.env  (ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_DISPLAY_NAME)
// รันเสร็จแล้วให้ "ลบบรรทัด ADMIN_PASSWORD ออกจากไฟล์ .env" — ในฐานข้อมูลเก็บเฉพาะค่าที่เข้ารหัสแล้ว
const prisma = new PrismaClient()

async function main() {
  const username = (process.env.ADMIN_USERNAME ?? '').trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD ?? ''
  const displayName = (process.env.ADMIN_DISPLAY_NAME ?? '').trim() || username

  if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
    throw new Error('ADMIN_USERNAME ต้องเป็นตัวอักษรอังกฤษพิมพ์เล็ก/ตัวเลข/_ . - ยาว 3-32 ตัว')
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD ต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`)
  }
  if (password.toLowerCase().includes(username)) {
    throw new Error('ADMIN_PASSWORD ไม่ควรมีชื่อผู้ใช้อยู่ในนั้น')
  }

  const passwordHash = await hashPassword(password)
  await prisma.admin.upsert({
    where: { username },
    update: { passwordHash, displayName },
    create: { username, passwordHash, displayName },
  })
  console.log(`พร้อมใช้งาน: แอดมิน "${username}"`)
  console.log('สำคัญ: ลบบรรทัด ADMIN_PASSWORD ออกจากไฟล์ backend/.env ตอนนี้เลย')
}

main()
  .catch((e) => {
    console.error('ไม่สำเร็จ:', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
