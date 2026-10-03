import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import BottomSheet from '../BottomSheet'
import { useBooking } from '../../hooks/useBooking'
import { GROUPS, SERVICES, servicePrice } from '../../data/services'
import { SHOP } from '../../data/shop'
import type { Service } from '../../types'

const MULTI_BLOCKED_TEXT = 'ไม่สามารถเลือกหลายรายการได้'

export default function StepService() {
  const { draft, patchDraft } = useBooking()
  const [openIds, setOpenIds] = useState<string[]>([])
  const { serviceIds, multi, questionCount } = draft

  // กล่องข้อความของ "อื่นๆ" (คำถาม 2 ทางเลือก)
  const [otherOpen, setOtherOpen] = useState(false)
  const [otherText, setOtherText] = useState('')
  const [otherErr, setOtherErr] = useState('')

  const applyToggle = (svc: Service) => {
    const on = serviceIds.includes(svc.id)
    if (multi) patchDraft({ serviceIds: on ? serviceIds.filter((x) => x !== svc.id) : [...serviceIds, svc.id], time: '' })
    else patchDraft({ serviceIds: on ? [] : [svc.id], time: '' })
  }
  const openOther = () => {
    setOtherText(draft.otherQuestion)
    setOtherErr('')
    setOtherOpen(true)
  }
  const select = (svc: Service) => {
    if (svc.id === 'ch-other' && !serviceIds.includes(svc.id)) return openOther()
    applyToggle(svc)
  }
  const saveOther = () => {
    const text = otherText.trim()
    if (!text) return setOtherErr('กรุณาพิมพ์คำถามของคุณ')
    const svc = SERVICES.find((x) => x.id === 'ch-other')
    if (!svc) return
    patchDraft({ otherQuestion: text })
    if (!serviceIds.includes(svc.id)) applyToggle(svc)
    setOtherOpen(false)
  }
  const toggleOpen = (id: string) => setOpenIds((x) => (x.includes(id) ? x.filter((i) => i !== id) : [...x, id]))

  const box = (sel: boolean) => `rounded-2xl border transition-colors ${sel ? 'border-gold bg-gold/10' : 'border-line bg-surface'}`
  const mark = (sel: boolean) => (
    <span className={`grid h-6 w-6 shrink-0 place-items-center border ${multi ? 'rounded-md' : 'rounded-full'} ${sel ? 'border-gold bg-gold text-night' : 'border-mute/50'}`}>
      {sel && <Check size={16} strokeWidth={3} />}
    </span>
  )

  return (
    <div className="grid gap-7">
      {multi && <p className="rounded-xl bg-gold/10 px-3 py-2 text-sm text-gold">โหมดเลือกหลายรายการ — เลือกได้เฉพาะ คำถาม 2 ทางเลือก เซ็ตความรัก การงาน และการเรียน</p>}

      {GROUPS.map((g) => {
        const list = SERVICES.filter((s) => s.active && s.group === g.id)
        if (list.length === 0) return null
        const blocked = multi && !g.multi
        return (
          <section key={g.id} aria-disabled={blocked} className={blocked ? 'opacity-40' : ''}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-base font-semibold">{g.label}</h2>
              {blocked && <span className="text-xs text-mute">{MULTI_BLOCKED_TEXT}</span>}
            </div>

            <div className="grid items-start gap-2 md:grid-cols-2">
              {list.map((svc) => {
                const sel = serviceIds.includes(svc.id)
                const callOff = svc.group === 'call' && !SHOP.callsEnabled
                const disabled = blocked || callOff

                if (svc.perQuestion) {
                  const total = servicePrice(svc, questionCount)
                  return (
                    <div key={svc.id} className={box(sel)}>
                      <div className="flex items-center gap-3 px-4 pt-3">
                        <span className="flex-1 text-sm">{svc.name}:</span>
                        <input
                          aria-label="จำนวนคำถาม"
                          inputMode="numeric"
                          disabled={disabled}
                          value={questionCount > 0 ? String(questionCount) : ''}
                          onChange={(e) => patchDraft({ questionCount: Math.min(50, Number(e.target.value.replace(/\D/g, '').slice(0, 2)) || 0) })}
                          className="h-12 w-24 rounded-xl border border-line bg-night px-3 text-center text-lg text-ink focus:border-gold focus:outline-none"
                        />
                      </div>
                      <p className="px-4 pt-2 text-sm text-mute">ราคารวม ({total} บาท):</p>
                      <div className="p-3">
                        <button disabled={disabled || questionCount < 1} onClick={() => select(svc)} className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:cursor-not-allowed ${sel ? 'bg-gold text-night' : 'bg-raised'}`}>
                          {sel ? <><Check size={18} />เลือกแล้ว</> : 'เลือกแบบระบุจำนวน'}
                        </button>
                      </div>
                    </div>
                  )
                }

                const expanded = openIds.includes(svc.id)
                return (
                  <div key={svc.id} className={box(sel)}>
                    <button disabled={disabled} onClick={() => select(svc)} aria-pressed={sel} className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left disabled:cursor-not-allowed">
                      {mark(sel)}
                      <span className="flex-1 font-medium">{svc.name}{callOff && <span className="block text-xs font-normal text-warn">ขณะนี้ปิดรับจองโทร</span>}</span>
                      <span className="font-semibold text-gold">{svc.price} <span className="text-xs font-normal text-mute">บาท</span></span>
                    </button>
                    {svc.id === 'ch-other' && sel && (
                      <div className="px-4 pb-3">
                        <p className="break-words rounded-xl bg-night/60 p-3 text-sm text-mute">“{draft.otherQuestion}”</p>
                        <button onClick={openOther} className="mt-1 h-10 text-sm text-gold">แก้ไขคำถาม</button>
                      </div>
                    )}
                    {svc.questions && (
                      <div className="px-4 pb-1">
                        <button onClick={() => toggleOpen(svc.id)} aria-expanded={expanded} className="flex h-10 items-center gap-1 text-sm text-gold">
                          ดูรายละเอียด<ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        </button>
                        {expanded && <ul className="list-disc space-y-1 pb-3 pl-5 text-sm text-mute">{svc.questions.map((q) => <li key={q}>{q}</li>)}</ul>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {g.note && <p className="mt-2 text-xs text-mute">{g.note}</p>}
          </section>
        )
      })}

      <BottomSheet open={otherOpen} title="พิมพ์คำถามของคุณ" onClose={() => setOtherOpen(false)}>
        <label className="grid gap-2 text-sm">คำถามที่อยากถามหมอดู (อื่นๆ — 49 บาท)
          <textarea
            autoFocus
            rows={5}
            value={otherText}
            onChange={(e) => { setOtherText(e.target.value.slice(0, 300)); setOtherErr('') }}
            placeholder="เช่น ควรย้ายไปอยู่ต่างจังหวัดไหม ระหว่างอยู่กรุงเทพฯ กับเชียงใหม่"
            className="w-full resize-none rounded-xl border border-line bg-night p-4 text-ink placeholder:text-mute/60 focus:border-gold focus:outline-none"
          />
          <span className="flex justify-between text-xs"><span className="text-bad">{otherErr}</span><span className="text-mute">{otherText.length}/300</span></span>
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button onClick={() => setOtherOpen(false)} className="h-12 rounded-2xl bg-raised text-sm font-medium">ยกเลิก</button>
          <button onClick={saveOther} className="h-12 rounded-2xl bg-gold text-sm font-semibold text-night">ตกลง</button>
        </div>
      </BottomSheet>
    </div>
  )
}
