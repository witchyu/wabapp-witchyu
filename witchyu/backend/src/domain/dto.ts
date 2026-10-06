// รูปแบบข้อมูลที่ส่งให้หน้าเว็บ (ตรงกับ type Booking / Service ฝั่ง frontend)
export interface BookingRowLike {
  id: string
  serviceIds: string[]
  serviceName: string
  questionCount: number | null
  otherQuestion: string | null
  price: number
  date: string
  time: string
  note: string
  nickname: string
  fullName: string
  age: number
  relationship: string
  isCall: boolean
  status: string
  expiresAt: Date
  createdAt: Date
}

export function toBookingDto(b: BookingRowLike) {
  return {
    id: b.id,
    serviceId: b.serviceIds[0],
    serviceIds: b.serviceIds,
    serviceName: b.serviceName,
    questionCount: b.questionCount ?? undefined,
    otherQuestion: b.otherQuestion ?? undefined,
    price: b.price,
    date: b.date,
    time: b.time,
    note: b.note,
    customer: { nickname: b.nickname, fullName: b.fullName, age: String(b.age), relationship: b.relationship },
    status: b.status,
    isCall: b.isCall,
    expiresAt: b.expiresAt.getTime(),
    createdAt: b.createdAt.getTime(),
  }
}

export interface ServiceRowLike {
  id: string
  group: string
  name: string
  description: string
  price: number
  durationMin: number | null
  unlimited: boolean
  perQuestion: boolean
  questions: string[]
  active: boolean
  recommended: boolean
}

export function toServiceDto(s: ServiceRowLike) {
  return {
    id: s.id,
    group: s.group,
    name: s.name,
    desc: s.description,
    price: s.price,
    durationMin: s.durationMin ?? undefined,
    unlimited: s.unlimited || undefined,
    perQuestion: s.perQuestion || undefined,
    questions: s.questions.length ? s.questions : undefined,
    active: s.active,
    recommended: s.recommended || undefined,
  }
}

export interface AdminServiceRowLike extends ServiceRowLike { sortOrder: number }

// ฝั่ง Admin ส่งค่าจริงทุกฟิลด์ (รวมค่า false/ว่าง) เพื่อใช้เป็นข้อมูลตั้งต้นของฟอร์มแก้ไข
export function toAdminServiceDto(s: AdminServiceRowLike) {
  return {
    id: s.id,
    group: s.group,
    name: s.name,
    desc: s.description,
    price: s.price,
    durationMin: s.durationMin,
    unlimited: s.unlimited,
    perQuestion: s.perQuestion,
    questions: s.questions,
    active: s.active,
    recommended: s.recommended,
    sortOrder: s.sortOrder,
  }
}
