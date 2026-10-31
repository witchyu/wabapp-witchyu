import { useEffect, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface Props { open: boolean; title: string; onClose: () => void; children: ReactNode }

export default function BottomSheet({ open, title, onClose, children }: Props) {
  const [viewport, setViewport] = useState<{ height: number; offsetTop: number; bottomInset: number } | null>(null)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      const bottomInset = Math.max(
        0,
        window.innerHeight - vv.height - vv.offsetTop,
      )

      setViewport({
        height: vv.height,
        offsetTop: vv.offsetTop,
        bottomInset,
      })
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    window.addEventListener('resize', update)

    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [open])

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
    <div
      className="fixed inset-x-0 top-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        height: viewport ? `${viewport.height}px` : '100dvh',
        transform: viewport ? `translateY(${viewport.offsetTop}px)` : undefined,
      }}
    >
      <button aria-label="ปิด" className="absolute inset-0 animate-fade bg-black/60" onClick={onClose} />
      <div
        className="relative w-full max-w-xl animate-sheet overflow-y-auto rounded-t-3xl border-t border-line bg-surface px-5 pb-6 pt-3 safe-bottom"
        style={{
          maxHeight: viewport ? `${Math.max(240, viewport.height - 16)}px` : '88dvh',
        }}
      >
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
