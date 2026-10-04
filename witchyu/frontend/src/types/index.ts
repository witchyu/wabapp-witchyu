export type ServiceGroup = 'question' | 'call' | 'topic' | 'choice' | 'love59' | 'love49' | 'work' | 'study'

export interface Service {
  id: string
  group: ServiceGroup
  name: string
  desc: string
  price: number            // บาท (ต่อคำถาม ถ้า perQuestion = true)
  durationMin?: number
  unlimited?: boolean      // จองได้เฉพาะ 22:30
  perQuestion?: boolean    // บริการ "จำนวนคำถามกำหนดเอง"
  questions?: string[]     // รายการคำถามในเซ็ต (แสดงใน "ดูรายละเอียด")
  active: boolean          // Phase 4: Admin เปิด/ปิดได้
}

export type BookingStatus = 'pending_payment' | 'confirmed' | 'completed' | 'cancelled'

export interface CustomerInfo {
  nickname: string
  fullName: string
  age: string
  relationship: string
}

export interface Booking {
  id: string
  serviceId: string        // รายการแรก (ใช้หาระยะเวลา/ชนิดบริการ)
  serviceIds: string[]
  serviceName: string
  questionCount?: number
  price: number
  date: string             // YYYY-MM-DD
  time: string             // HH:mm
  otherQuestion?: string   // คำถามที่ลูกค้าพิมพ์เองเมื่อเลือก "อื่นๆ"
  note: string
  customer: CustomerInfo
  status: BookingStatus
  isCall: boolean
  createdAt: number        // epoch ms
  expiresAt: number        // epoch ms — หมดเวลาชำระเงิน (เซิร์ฟเวอร์เป็นผู้กำหนด)
}

// ข้อมูลที่กำลังกรอกระหว่างจอง (Booking State)
export interface Draft {
  customer: CustomerInfo
  remember: boolean
  serviceIds: string[]
  multi: boolean            // โหมดเลือกหลายรายการ
  questionCount: number
  otherQuestion: string
  date: string
  time: string
  note: string
}

export type SlotStatus = 'available' | 'full' | 'closed'

export interface DaySlots {
  date: string
  closed: boolean         // ทั้งวันปิดรับ (วันหยุด/นอกช่วง 7 วัน)
  reason?: string
  slots: { time: string; status: SlotStatus }[]
}
