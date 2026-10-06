import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, Loader2, MessageCircle, Send, WifiOff } from 'lucide-react'
import type { ChatRole } from '../../types/chat'
import type { useConversation } from '../../hooks/useConversation'
import { dayKey, dayLabel, lastReadOwnId, timeLabel } from '../../utils/chat'
import { ErrorState } from '../states'

type Conv = ReturnType<typeof useConversation>
interface Props { role: ChatRole; conv: Conv; title: string; subtitle?: string; avatar: ReactNode; onBack: () => void }

// ความสูงที่มองเห็นจริง (ลดลงเมื่อแป้นพิมพ์ขึ้นบน iPhone/iPad) กันช่องพิมพ์ถูกแป้นพิมพ์บัง
function useVisibleHeight(): number | null {
  const [h, setH] = useState<number | null>(() => (typeof window !== 'undefined' && window.visualViewport ? window.visualViewport.height : null))
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const on = () => setH(vv.height)
    vv.addEventListener('resize', on)
    return () => vv.removeEventListener('resize', on)
  }, [])
  return h
}

export default function ChatView({ role, conv, title, subtitle, avatar, onBack }: Props) {
  const { messages, status, error, reload, hasMore, loadingOlder, loadOlder, canSend, cannotSendReason, send, retry, notifyTyping, peerTyping, sendError, clearSendError, connected, peerOnline } = conv
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const atBottom = useRef(true)
  const anchor = useRef<number | null>(null)
  const lastCount = useRef(0)
  const height = useVisibleHeight()
  const readId = lastReadOwnId(messages, role)

  const scrollBottom = () => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight }

  // เลื่อนลงล่างเมื่อ: โหลดครั้งแรก / มีข้อความใหม่ขณะอยู่ล่างสุด / เราส่งเอง — ส่วนโหลดข้อความเก่าให้คงตำแหน่งเดิม
  useLayoutEffect(() => {
    const el = listRef.current
    if (!el) return
    if (anchor.current !== null) {
      el.scrollTop += el.scrollHeight - anchor.current
      anchor.current = null
    } else {
      const last = messages[messages.length - 1]
      const grew = messages.length > lastCount.current
      if (lastCount.current === 0 || (grew && (atBottom.current || last?.local))) scrollBottom()
    }
    lastCount.current = messages.length
  }, [messages])

  useLayoutEffect(() => { if (height !== null && atBottom.current) scrollBottom() }, [height])

  const olderClick = async () => {
    if (listRef.current) anchor.current = listRef.current.scrollHeight
    await loadOlder()
  }

  const submit = () => {
    const v = text
    if (!v.trim()) return
    setText('')
    send(v)
    inputRef.current?.focus()
    if (inputRef.current) inputRef.current.style.height = 'auto'
  }

  const onInput = (v: string) => {
    setText(v)
    if (sendError) clearSendError()
    if (v) notifyTyping()
    const el = inputRef.current
    if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 120)}px` }
  }

  let prevDay = ''
  return (
    <div className="fixed inset-x-0 top-0 z-40 mx-auto flex max-w-2xl flex-col bg-night" style={{ height: height ? `${height}px` : '100dvh' }}>
      <header className="flex items-center gap-2 border-b border-line bg-night px-2 pb-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}>
        <button onClick={onBack} aria-label="ย้อนกลับ" className="grid h-11 w-11 place-items-center rounded-full active:bg-raised"><ChevronLeft size={24} /></button>
        {avatar}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-base font-semibold leading-tight">{title}</h1>
          <div className="flex items-center gap-1.5 text-xs text-mute">
            <span className={`h-2 w-2 rounded-full ${peerOnline ? 'bg-ok' : 'bg-mute/50'}`} />
            <span>{peerOnline ? 'ออนไลน์' : 'ออฟไลน์'}</span>
            {subtitle && <span className="truncate">· {subtitle}</span>}
          </div>
        </div>
      </header>

      {!connected && (
        <div role="status" className="flex items-center justify-center gap-2 bg-warn/15 px-3 py-1.5 text-xs text-warn">
          <WifiOff size={14} />กำลังเชื่อมต่อใหม่… ข้อความที่ส่งยังบันทึกได้ แต่ข้อความใหม่อาจมาช้า
        </div>
      )}

      <div ref={listRef} onScroll={(e) => { const el = e.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80 }} className="min-h-0 flex-1 overflow-y-auto px-3 py-3" aria-live="polite">
        {status === 'loading' && <div className="flex h-full items-center justify-center text-mute"><Loader2 className="animate-spin text-gold" size={28} /></div>}
        {status === 'error' && <ErrorState title="โหลดข้อความไม่สำเร็จ" text={error} onRetry={reload} />}
        {status === 'ready' && (
          <>
            {hasMore && (
              <div className="mb-3 text-center">
                <button onClick={olderClick} disabled={loadingOlder} className="h-10 rounded-full bg-surface px-4 text-sm text-mute disabled:opacity-60">{loadingOlder ? 'กำลังโหลด…' : 'โหลดข้อความเก่า'}</button>
              </div>
            )}
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center px-8 text-center text-mute">
                <div className="mb-3 grid h-16 w-16 place-items-center rounded-full bg-raised text-gold"><MessageCircle size={28} /></div>
                <p className="font-display text-base font-semibold text-ink">ยังไม่มีข้อความ</p>
                <p className="mt-1 text-sm">{role === 'customer' ? 'ทักทายหมอดูได้เลย' : 'เริ่มคุยกับลูกค้าได้เลย'}</p>
              </div>
            )}
            {messages.map((m) => {
              const mine = m.senderRole === role
              const key = dayKey(m.createdAt)
              const sep = key !== prevDay ? dayLabel(m.createdAt) : null
              prevDay = key
              return (
                <div key={m.clientMsgId ?? m.id}>
                  {sep && <div className="my-3 text-center text-xs text-mute">{sep}</div>}
                  <div className={`mb-2 flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex max-w-[82%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                      <div className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed ${mine ? 'rounded-br-md bg-gold text-night' : 'rounded-bl-md bg-raised text-ink'} ${m.local ? 'opacity-70' : ''}`}>{m.body}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 px-1 text-[11px] text-mute">
                        {m.local === 'sending' && <span>กำลังส่ง…</span>}
                        {m.local === 'failed' && <button onClick={() => retry(m)} className="text-bad underline">ส่งไม่สำเร็จ — แตะเพื่อส่งใหม่</button>}
                        {!m.local && <span>{timeLabel(m.createdAt)}</span>}
                        {mine && m.id === readId && <span>· อ่านแล้ว</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            {peerTyping && (
              <div className="mb-2 flex justify-start" aria-label="อีกฝ่ายกำลังพิมพ์">
                <div className="flex gap-1 rounded-2xl rounded-bl-md bg-raised px-4 py-3">
                  {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-mute" style={{ animationDelay: `${i * 150}ms` }} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {sendError && <div role="alert" className="bg-bad/10 px-4 py-1.5 text-center text-xs text-bad">{sendError}</div>}

      <div className="border-t border-line bg-surface px-3 pt-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}>
        {status === 'ready' && !canSend ? (
          <p className="py-3 text-center text-sm text-mute">{cannotSendReason || 'ส่งข้อความไม่ได้ในขณะนี้'}</p>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={text}
              rows={1}
              maxLength={1000}
              enterKeyHint="send"
              aria-label="พิมพ์ข้อความ"
              placeholder="พิมพ์ข้อความ…"
              disabled={status !== 'ready'}
              onChange={(e) => onInput(e.target.value)}
              onKeyDown={(e) => {
                // คอมพิวเตอร์: Enter ส่ง / Shift+Enter ขึ้นบรรทัดใหม่ — มือถือ: Enter ขึ้นบรรทัดใหม่ ใช้ปุ่มส่ง
                if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) { e.preventDefault(); submit() }
              }}
              className="max-h-[120px] min-h-[48px] flex-1 resize-none rounded-2xl border border-line bg-night px-4 py-3 text-ink placeholder:text-mute/60 focus:border-gold focus:outline-none disabled:opacity-60"
            />
            <button onClick={submit} disabled={!text.trim() || status !== 'ready'} aria-label="ส่งข้อความ" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gold text-night transition active:scale-95 disabled:opacity-40"><Send size={20} /></button>
          </div>
        )}
      </div>
    </div>
  )
}
