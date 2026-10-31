import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import ServiceCard from '../components/ServiceCard'
import { EmptyState } from '../components/states'
import { serviceCategoryId, serviceCategoryOptions } from '../data/services'
import { useServices } from '../hooks/useServices'
import { SearchX } from 'lucide-react'

export default function Services() {
  const nav = useNavigate()
  const { services } = useServices()
  const [group, setGroup] = useState('')
  const visibleGroups = useMemo(() => serviceCategoryOptions(services), [services])
  const activeGroup = visibleGroups.some((g) => g.id === group)
    ? group
    : visibleGroups[0]?.id ?? ''
  const list = useMemo(
    () => services.filter((s) => s.active && serviceCategoryId(s) === activeGroup),
    [services, activeGroup],
  )
  const hint = visibleGroups.find((g) => g.id === activeGroup)?.hint

  return (
    <div>
      <PageHeader title="บริการทั้งหมด" back="/" />
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
        {visibleGroups.map((g) => (
          <button key={g.id} onClick={() => setGroup(g.id)} className={`h-11 shrink-0 rounded-full px-4 text-sm font-medium ${activeGroup === g.id ? 'bg-gold text-night' : 'bg-surface text-mute'}`}>
            {g.label}
          </button>
        ))}
      </div>
      <p className="px-5 pb-3 text-sm text-mute">{hint}</p>
      <div className="grid items-start gap-3 px-4 md:grid-cols-2 lg:grid-cols-3">
        {list.length === 0 && <EmptyState icon={<SearchX size={28} />} title="ยังไม่มีบริการในหมวดนี้" text="ลองเลือกหมวดอื่นดูนะ" />}
        {list.map((s) => (
          <ServiceCard key={s.id} svc={s} actionLabel="จองบริการนี้" onSelect={() => nav(`/booking?service=${s.id}`)} />
        ))}
      </div>
    </div>
  )
}
