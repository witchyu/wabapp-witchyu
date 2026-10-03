import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

interface Props { title: string; back?: boolean | string; right?: ReactNode }

export default function PageHeader({ title, back, right }: Props) {
  const nav = useNavigate()
  const goBack = () => (typeof back === 'string' ? nav(back) : nav(-1))
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-night/90 px-3 pb-3 backdrop-blur" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
      {back ? (
        <button onClick={goBack} aria-label="ย้อนกลับ" className="grid h-11 w-11 place-items-center rounded-full active:bg-raised"><ChevronLeft size={24} /></button>
      ) : <span className="w-2" />}
      <h1 className="flex-1 font-display text-lg font-semibold">{title}</h1>
      {right}
    </header>
  )
}
