import type { Service, ServiceGroup } from '../types'

// multi = กลุ่มที่เลือกหลายรายการได้เมื่อเปิดโหมด "เลือกหลายรายการ"
// สามกลุ่มแรก (เจาะจง / โทร / เป็นเรื่องๆ) เลือกได้ทีละรายการเสมอ
export const GROUPS: { id: ServiceGroup; label: string; hint?: string; note?: string; multi: boolean }[] = [
  { id: 'question', label: 'คำถามเจาะจง', multi: false },
  { id: 'call', label: 'คำถามแบบโทร', note: '* แพ็กเกจโทรไม่จำกัดชั่วโมง/คำถาม จองได้เฉพาะรอบเวลา 22:30 น. เท่านั้น', multi: false },
  { id: 'topic', label: 'คำถามเจาะจงเป็นเรื่องๆ', multi: false },
  { id: 'choice', label: 'คำถาม 2 ทางเลือก', multi: true },
  { id: 'love59', label: 'เซ็ตคำถามความรัก 59 บาท', multi: true },
  { id: 'love49', label: 'เซ็ตคำถามความรัก 49 บาท', multi: true },
  { id: 'work', label: 'เซ็ตคำถามการงาน', multi: true },
  { id: 'study', label: 'เซ็ตคำถามการเรียน', multi: true },
]

export const isMultiGroup = (g?: ServiceGroup) => GROUPS.find((x) => x.id === g)?.multi ?? false

// ข้อมูลบริการมาจาก API (Database) — เก็บไว้ที่นี่เพื่อให้ฟังก์ชันตรวจสอบเรียกใช้ได้แบบ synchronous
// ServicesProvider จะโหลดและเรียก setServices ก่อนแสดงหน้าใด ๆ
let registry: Service[] = []
export const setServices = (list: Service[]) => { registry = list }
export const getServices = () => registry

export const FEATURED_IDS = ['q-3', 'c-30', 't-money']

export const getService = (id: string) => registry.find((x) => x.id === id)
export const servicePrice = (svc: Service, count = 1) => (svc.perQuestion ? svc.price * count : svc.price)

export function selectedServices(ids: string[]): Service[] {
  return ids.map(getService).filter((x): x is Service => !!x)
}
export const selectionTotal = (ids: string[], count: number) =>
  selectedServices(ids).reduce((sum, v) => sum + servicePrice(v, count), 0)
