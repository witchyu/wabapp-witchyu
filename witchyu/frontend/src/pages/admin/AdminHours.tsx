import { useEffect, useState } from 'react'
import { adminApi } from '../../services/adminApi'
import { errorMessage } from '../../services/api'
import { useLoad } from '../../components/admin/useLoad'
import Toggle from '../../components/admin/Toggle'
import { ErrorState, Spinner } from '../../components/states'
import { useToast } from '../../hooks/useToast'
import type { AdminHours as Row } from '../../types/admin'

const NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const ORDER = [1, 2, 3, 4, 5, 6, 0]
const timeInput = 'h-12 rounded-xl border border-line bg-night px-3 focus:border-gold focus:outline-none disabled:opacity-40'

export default function AdminHours() {
  const toast = useToast()
  const { data, status, error, reload } = useLoad(() => adminApi.hours())
  const [rows, setRows] = useState<Row[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (data) setRows(data) }, [data])

  if (status === 'loading') return <Spinner />
  if (status === 'error' || !data) return <ErrorState title="โหลดเวลาทำการไม่สำเร็จ" text={error} onRetry={reload} />

  const set = (d: number, p: Partial<Row>) => setRows((r) => r.map((x) => (x.dayOfWeek === d ? { ...x, ...p } : x)))

  const save = async () => {
    if (saving) return
    const badRow = rows.find((r) => !r.isClosed && r.openTime >= r.closeTime)
    if (badRow) return toast(`วัน${NAMES[badRow.dayOfWeek]}: เวลาเปิดต้องมาก่อนเวลาปิด`, 'error')
    setSaving(true)
    try {
      setRows(await adminApi.saveHours(rows))
      toast('บันทึกเวลาทำการแล้ว', 'success')
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <p className="mb-4 text-sm text-mute">รอบเวลาที่อยู่นอกเวลาทำการของวันนั้นจะถูกปิดรับจองอัตโนมัติ</p>
      <ul className="grid gap-2">
        {ORDER.map((d) => {
          const r = rows.find((x) => x.dayOfWeek === d)
          if (!r) return null
          return (
            <li key={d} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3">
              <span className="w-24 font-medium">{NAMES[d]}</span>
              <Toggle label={`เปิดทำการวัน${NAMES[d]}`} checked={!r.isClosed} onChange={(open) => set(d, { isClosed: !open })} />
              <span className="w-14 text-sm text-mute">{r.isClosed ? 'ปิด' : 'เปิด'}</span>
              <input type="time" aria-label={`เวลาเปิด ${NAMES[d]}`} disabled={r.isClosed} value={r.openTime} onChange={(e) => set(d, { openTime: e.target.value })} className={timeInput} />
              <span className="text-mute">ถึง</span>
              <input type="time" aria-label={`เวลาปิด ${NAMES[d]}`} disabled={r.isClosed} value={r.closeTime} onChange={(e) => set(d, { closeTime: e.target.value })} className={timeInput} />
            </li>
          )
        })}
      </ul>
      <button disabled={saving} onClick={save} className="mt-5 h-14 w-full rounded-2xl bg-gold font-semibold text-night disabled:opacity-60 md:w-64">{saving ? 'กำลังบันทึก' : 'บันทึกเวลาทำการ'}</button>
    </div>
  )
}
