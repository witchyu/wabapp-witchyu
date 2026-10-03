import { useState } from 'react'
import { Check, ChevronDown, Clock, Minus, Phone, Plus } from 'lucide-react'
import type { Service } from '../types'
import { baht } from '../utils/format'
import { servicePrice } from '../data/services'

interface Props {
  svc: Service
  selected?: boolean
  disabled?: boolean
  disabledReason?: string
  count?: number
  onCount?: (n: number) => void
  onSelect: () => void
  actionLabel?: string
}

export default function ServiceCard({ svc, selected, disabled, disabledReason, count = 1, onCount, onSelect, actionLabel = 'เลือก' }: Props) {
  const showStepper = svc.perQuestion && selected && onCount
  const [open, setOpen] = useState(false)
  return (
    <div className={`rounded-2xl border p-4 transition-colors ${selected ? 'border-gold bg-gold/10' : 'border-line bg-surface'} ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{svc.name}</h3>
            {svc.durationMin && <span className="flex items-center gap-1 text-xs text-mute"><Clock size={12} />{svc.durationMin} นาที</span>}
            {svc.unlimited && <span className="flex items-center gap-1 text-xs text-gold"><Phone size={12} />รอบ 22:30</span>}
          </div>
          {svc.desc && <p className="mt-1 text-sm text-mute">{svc.desc}</p>}
          {disabled && disabledReason && <p className="mt-1 text-xs text-warn">{disabledReason}</p>}
        </div>
        <div className="text-right">
          <div className="font-display text-lg font-semibold text-gold">{svc.price}</div>
          <div className="text-[11px] text-mute">{svc.perQuestion ? 'บาท/ข้อ' : 'บาท'}</div>
        </div>
      </div>

      {svc.questions && (
        <div className="mt-2">
          <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex h-10 items-center gap-1 text-sm text-gold">
            ดูรายละเอียด<ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && <ul className="list-disc space-y-1 pl-5 text-sm text-mute">{svc.questions.map((q) => <li key={q}>{q}</li>)}</ul>}
        </div>
      )}

      {showStepper && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-night/60 p-2">
          <span className="pl-2 text-sm text-mute">จำนวนคำถาม</span>
          <div className="flex items-center gap-3">
            <button aria-label="ลดจำนวนคำถาม" onClick={() => onCount(Math.max(1, count - 1))} className="grid h-11 w-11 place-items-center rounded-full bg-raised"><Minus size={18} /></button>
            <span className="w-8 text-center text-lg font-semibold">{count}</span>
            <button aria-label="เพิ่มจำนวนคำถาม" onClick={() => onCount(Math.min(50, count + 1))} className="grid h-11 w-11 place-items-center rounded-full bg-raised"><Plus size={18} /></button>
          </div>
        </div>
      )}
      {showStepper && <p className="mt-2 text-right text-sm">รวม <span className="font-semibold text-gold">{baht(servicePrice(svc, count))}</span></p>}

      <button
        disabled={disabled}
        onClick={onSelect}
        className={`mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition active:scale-[.98] ${selected ? 'bg-gold text-night' : 'bg-raised text-ink'} disabled:cursor-not-allowed`}
      >
        {selected ? <><Check size={18} />เลือกแล้ว</> : actionLabel}
      </button>
    </div>
  )
}
