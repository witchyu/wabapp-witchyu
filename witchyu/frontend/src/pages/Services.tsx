import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import ServiceCard from '../components/ServiceCard'
import { EmptyState } from '../components/states'
import { GROUPS, SERVICES } from '../data/services'
import { SHOP } from '../data/shop'
import type { ServiceGroup } from '../types'
import { SearchX } from 'lucide-react'

export default function Services() {
  const nav = useNavigate()
  const [group, setGroup] = useState<ServiceGroup>('question')
  const list = useMemo(() => SERVICES.filter((s) => s.active && s.group === group), [group])
  const hint = GROUPS.find((g) => g.id === group)?.hint

  return (
    <div>
      <PageHeader title="บริการทั้งหมด" back="/" />
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
        {GROUPS.map((g) => (
          <button key={g.id} onClick={() => setGroup(g.id)} className={`h-11 shrink-0 rounded-full px-4 text-sm font-medium ${group === g.id ? 'bg-gold text-night' : 'bg-surface text-mute'}`}>
            {g.label}
          </button>
        ))}
      </div>
      <p className="px-5 pb-3 text-sm text-mute">{hint}</p>
      <div className="grid items-start gap-3 px-4 md:grid-cols-2 lg:grid-cols-3">
        {list.length === 0 && <EmptyState icon={<SearchX size={28} />} title="ยังไม่มีบริการในหมวดนี้" text="ลองเลือกหมวดอื่นดูนะ" />}
        {list.map((s) => {
          const callOff = s.group === 'call' && !SHOP.callsEnabled
          return (
            <ServiceCard key={s.id} svc={s} disabled={callOff} disabledReason="ขณะนี้ปิดรับจองโทร" actionLabel="จองบริการนี้" onSelect={() => nav(`/booking?service=${s.id}`)} />
          )
        })}
      </div>
    </div>
  )
}
