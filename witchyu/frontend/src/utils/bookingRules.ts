import { SHOP } from '../data/shop'
import { isMultiGroup, selectedServices } from '../data/services'
import type { CustomerInfo, Draft } from '../types'

export const EMPTY_CUSTOMER: CustomerInfo = { nickname: '', fullName: '', age: '', relationship: '' }

// การตรวจฝั่งหน้าเว็บมีไว้ให้ผู้ใช้เห็นข้อผิดพลาดเร็ว ๆ — เซิร์ฟเวอร์ตรวจซ้ำทั้งหมดและเป็นผู้ตัดสินสุดท้าย (รวมถึงราคาและรอบว่าง)
export function validateCustomer(c: CustomerInfo): string | null {
  if (!c.nickname.trim()) return 'กรุณากรอกชื่อเล่น'
  if (!c.fullName.trim()) return 'กรุณากรอกชื่อจริง'
  const age = Number(c.age)
  if (!c.age || !Number.isInteger(age) || age < 1 || age > 120) return 'กรุณากรอกอายุให้ถูกต้อง'
  if (!c.relationship) return 'กรุณาเลือกสถานะความสัมพันธ์'
  return null
}

export function validateSelection(d: Pick<Draft, 'serviceIds' | 'multi' | 'questionCount' | 'otherQuestion'>): string | null {
  const ids = d.serviceIds
  if (ids.length === 0) return 'กรุณาเลือกบริการอย่างน้อย 1 รายการ'
  const svcs = selectedServices(ids)
  if (svcs.length !== ids.length || svcs.some((s) => !s.active)) return 'มีบริการที่ไม่พร้อมให้จอง กรุณาเลือกใหม่'
  if (svcs.length > 1 && !(d.multi && svcs.every((s) => isMultiGroup(s.group)))) return 'บริการนี้เลือกหลายรายการไม่ได้'
  if (svcs.some((s) => s.group === 'call') && !SHOP.callsEnabled) return 'ขณะนี้ปิดรับจองโทร'
  if (svcs.some((s) => s.perQuestion) && (!Number.isInteger(d.questionCount) || d.questionCount < 1 || d.questionCount > 50)) return 'กรุณากรอกจำนวนคำถาม 1-50 ข้อ'
  if (ids.includes('ch-other') && !d.otherQuestion.trim()) return 'กรุณาพิมพ์คำถามของคุณในช่อง “อื่นๆ”'
  return null
}
