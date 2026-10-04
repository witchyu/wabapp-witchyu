// จำกัดจำนวนครั้งที่ล็อกอินผิดต่อช่วงเวลา (เก็บในหน่วยความจำ — รีสตาร์ทเซิร์ฟเวอร์แล้วเริ่มนับใหม่)
export class LoginLimiter {
  private fails = new Map<string, number[]>()
  constructor(private readonly max: number, private readonly windowMs: number) {}

  private recent(key: string, now: number): number[] {
    const list = (this.fails.get(key) ?? []).filter((t) => now - t < this.windowMs)
    if (list.length) this.fails.set(key, list)
    else this.fails.delete(key)
    return list
  }

  // คืนจำนวนวินาทีที่ต้องรอ (0 = ลองได้)
  retryAfterSec(key: string, now: number): number {
    const list = this.recent(key, now)
    if (list.length < this.max) return 0
    return Math.ceil((list[0] + this.windowMs - now) / 1000)
  }

  fail(key: string, now: number): void {
    const list = this.recent(key, now)
    list.push(now)
    this.fails.set(key, list)
    if (this.fails.size > 5000) { // กันหน่วยความจำบวม
      for (const k of this.fails.keys()) this.recent(k, now)
    }
  }

  reset(key: string): void {
    this.fails.delete(key)
  }
}
