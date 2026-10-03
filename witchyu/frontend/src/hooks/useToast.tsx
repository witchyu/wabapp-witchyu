import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'

type Kind = 'success' | 'error' | 'info'
interface ToastItem { id: number; kind: Kind; text: string }

const Ctx = createContext<(text: string, kind?: Kind) => void>(() => {})
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((text: string, kind: Kind = 'info') => {
    const id = Date.now() + Math.random()
    setItems((x) => [...x, { id, kind, text }])
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 2800)
  }, [])

  const icon = { success: <CheckCircle2 size={18} className="text-ok" />, error: <AlertCircle size={18} className="text-bad" />, info: <Info size={18} className="text-gold" /> }

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4 safe-top" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }} aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className="pointer-events-auto flex max-w-sm animate-toast items-center gap-2 rounded-2xl border border-line bg-raised px-4 py-3 text-sm shadow-xl">
            {icon[i.kind]}
            <span>{i.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
