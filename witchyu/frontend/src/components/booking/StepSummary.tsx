import { useBooking } from '../../hooks/useBooking'
import { selectedServices, selectionTotal } from '../../data/services'
import { baht, dateLong } from '../../utils/format'

export default function StepSummary() {
  const { draft } = useBooking()
  const svcs = selectedServices(draft.serviceIds)
  if (svcs.length === 0) return null
  const name = svcs.map((s) => (s.perQuestion ? `${s.name} (${draft.questionCount} คำถาม)` : s.name)).join('\n')
  const rows: [string, string][] = [
    ['ชื่อ', `${draft.customer.nickname} (${draft.customer.fullName})`],
    ['บริการ', name],
    ['วันที่', dateLong(draft.date)],
    ['เวลา', `${draft.time} น.`],
    ['หมายเหตุ', draft.note.trim() || '-'],
  ]
  return (
    <div>
      <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-4 px-4 py-3 text-sm">
            <span className="w-20 shrink-0 text-mute">{k}</span>
            <span className="flex-1 whitespace-pre-line break-words">{v}</span>
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-mute">ราคา</span>
          <span className="font-display text-2xl font-semibold text-gold">{baht(selectionTotal(draft.serviceIds, draft.questionCount))}</span>
        </div>
      </div>
      <p className="mt-3 text-xs text-mute">หลังกดยืนยัน ระบบจะพาไปหน้าชำระเงิน ยังไม่ถือว่าจองสำเร็จจนกว่าจะชำระเงิน</p>
    </div>
  )
}
