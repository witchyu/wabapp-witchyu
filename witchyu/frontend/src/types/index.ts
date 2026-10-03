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
  serviceId: string
  serviceName: string
  questionCount?: number
  price: number
  date: string             // YYYY-MM-DD
  time: string             // HH:mm
  note: string
  customer: CustomerInfo
  status: BookingStatus
  isCall: boolean
}

export type SlotStatus = 'available' | 'full' | 'closed'
