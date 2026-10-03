import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface Props { open: boolean; title: string; onClose: () => void; children: ReactNode }

export default function BottomSheet({ open, title, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="ปิด" className="absolute inset-0 animate-fade bg-black/60" onClick={onClose} />
      <div className="relative max-h-[88%] w-full max-w-xl animate-sheet overflow-y-auto rounded-t-3xl border-t border-line bg-surface px-5 pb-6 pt-3 safe-bottom">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="ปิด" className="grid h-10 w-10 place-items-center rounded-full bg-raised"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
