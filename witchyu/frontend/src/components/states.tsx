import type { ReactNode } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'

export function Spinner({ label = 'กำลังโหลด' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-mute" role="status">
      <Loader2 className="animate-spin text-gold" size={28} />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-raised text-gold">{icon}</div>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-mute">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ title, text, onRetry }: { title: string; text: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-bad/10 text-bad"><AlertCircle size={28} /></div>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-mute">{text}</p>
      {onRetry && <button onClick={onRetry} className="mt-5 h-12 rounded-2xl bg-raised px-6 text-sm font-medium">ลองอีกครั้ง</button>}
    </div>
  )
}
