import type { ReactNode } from 'react'

interface Props {
  open: boolean
  title: string
  children?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function Modal({ open, title, children, confirmLabel, cancelLabel = 'ยกเลิก', danger, onConfirm, onCancel }: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center px-6" role="alertdialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade bg-black/70" onClick={onCancel} />
      <div className="relative w-full max-w-sm animate-pop rounded-3xl border border-line bg-surface p-5">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <div className="mt-2 text-sm text-mute">{children}</div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={onCancel} className="h-12 rounded-2xl bg-raised text-sm font-medium">{cancelLabel}</button>
          <button onClick={onConfirm} className={`h-12 rounded-2xl text-sm font-semibold ${danger ? 'bg-bad text-night' : 'bg-gold text-night'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
