// ข้อมูลร้านแบบจำลอง — Phase 4 จะดึงจาก Database (Admin จัดการได้)
export const SHOP = {
  name: 'Witchyu',
  openHour: 18,
  closeHour: 23,
  isOpen: true,        // สวิตช์เปิด/ปิดร้าน
  callsEnabled: true,  // สวิตช์เปิดรับจองโทร
  hoursLabel: 'ทุกวัน 18:00 – 23:00 น.',
}

export const BASE_SLOTS = ['18:00', '19:00', '20:00', '21:00', '22:30']
export const UNLIMITED_SLOT = '22:30'
export const BOOKING_DAYS = 7

export const RELATIONSHIPS = ['โสด', 'มีแฟน', 'คุยอยู่', 'แต่งงานแล้ว', 'ไม่ระบุ']
