// ข้อมูลร้านแบบจำลอง — Phase 4 จะดึงจาก Database (Admin จัดการได้)
// สถานะร้านมาจากเซิร์ฟเวอร์ (Admin เป็นผู้ตั้งค่า) — ค่าเริ่มต้นนี้ใช้ก่อนโหลดสำเร็จเท่านั้น
export const SHOP = {
  name: 'Witchyu',
  isOpen: true,        // สวิตช์เปิดรับจองคิว (ปิด = จองไม่ได้)
  callsEnabled: true,  // สวิตช์เปิดรับจองโทร
  openNow: false,      // อยู่ในเวลาทำการตอนนี้หรือไม่ (รวมวันหยุด)
  hoursLabel: '',
}

export interface ShopStatus { isOpen: boolean; callsEnabled: boolean; openNow: boolean; hoursLabel: string }
export const setShop = (s: ShopStatus) => { Object.assign(SHOP, s) }

export const BOOKING_DAYS = 7

export const RELATIONSHIPS = ['โสด', 'มีแฟน', 'คุยอยู่', 'แต่งงานแล้ว', 'ไม่ระบุ']
