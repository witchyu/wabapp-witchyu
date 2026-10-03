const MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const DAYS_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']

const pad = (n: number) => String(n).padStart(2, '0')

export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const fromISO = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export const baht = (n: number) => `${n.toLocaleString('th-TH')} บาท`
export const dayShort = (iso: string) => DAYS_SHORT[fromISO(iso).getDay()]
export const dateShort = (iso: string) => {
  const d = fromISO(iso)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}
export const dateLong = (iso: string) => {
  const d = fromISO(iso)
  return `${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`
}
export const mmss = (sec: number) => `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`

export const STATUS_LABEL = {
  pending_payment: 'รอชำระเงิน',
  confirmed: 'ยืนยันแล้ว',
  completed: 'เสร็จแล้ว',
  cancelled: 'ยกเลิก',
} as const
