import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarPlus, Clock, Instagram, MessageCircle, Moon, Phone, Sparkles } from 'lucide-react'
import { SHOP } from '../data/shop'
import { bookingApi } from '../services/bookingApi'
import type { DaySlots } from '../types'
import { getServices } from '../data/services'
import BottomSheet from '../components/BottomSheet'
import { addDays, dateShort, dayShort, toISO } from '../utils/format'

export default function Home() {
  const nav = useNavigate()
  const [contact, setContact] = useState(false)
  const [queue, setQueue] = useState<DaySlots | null>(null)
  const [queueError, setQueueError] = useState('')
  const [queueLoading, setQueueLoading] = useState(true)

  const todayISO = toISO(new Date())
  const [selectedDate, setSelectedDate] = useState(todayISO)
  const days = Array.from(
    { length: Math.min(7, Math.max(1, SHOP.bookingDays || 7)) },
    (_, i) => toISO(addDays(new Date(`${todayISO}T12:00:00`), i)),
  )
  useEffect(() => {
    let active = true
    setQueueLoading(true)
    setQueueError('')
    setQueue(null)
    bookingApi.slots(selectedDate, [])
      .then((data) => { if (active) setQueue(data) })
      .catch(() => { if (active) setQueueError('ไม่สามารถโหลดสถานะคิวได้') })
      .finally(() => { if (active) setQueueLoading(false) })
    return () => { active = false }
  }, [selectedDate])
  const open = SHOP.openNow
  const featured = getServices().filter((s) => s.active && s.recommended)

  return (
    <div>
      <header className="flex items-center justify-between px-5 pb-2" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
        <div className="flex items-center gap-3">
          <img src="/icon.png" alt="Witchyu" className="h-10 w-10 rounded-xl object-cover" />
          <span className="font-display text-xl font-semibold tracking-wide">Witchyu</span>
        </div>
        <span className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${open ? 'bg-ok/15 text-ok' : 'bg-bad/15 text-bad'}`}>
          <span className={`h-2 w-2 rounded-full ${open ? 'bg-ok' : 'bg-bad'}`} />{open ? 'ร้านเปิด' : 'ร้านปิด'}
        </span>
      </header>

      <section className="mx-5 mt-4 rounded-2xl border border-gold/30 bg-gradient-to-br from-raised via-surface to-night p-3 text-center">
        <p className="text-xs text-mute">สถานะคิวประจำวัน</p>

        <div className="no-scrollbar mt-3 -mx-1 flex justify-center gap-2 overflow-x-auto px-1 pb-1">
          {days.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDate(d)}
              className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ${
                selectedDate === d ? 'bg-gold text-night' : 'bg-raised text-ink'
              }`}
            >
              <span className={`text-[10px] ${selectedDate === d ? 'text-night/70' : 'text-mute'}`}>
                {d === todayISO ? 'วันนี้' : dayShort(d)}
              </span>
              <span className="mt-0.5 text-xs font-semibold">{dateShort(d)}</span>
            </button>
          ))}
        </div>

        {queueLoading ? (
          <p className="py-3 text-xs text-mute">กำลังโหลดสถานะคิว...</p>
        ) : queueError ? (
          <p className="py-3 text-xs text-bad">{queueError}</p>
        ) : queue?.closed ? (
          <p className="mt-2 rounded-xl bg-bad/10 px-3 py-2 text-xs text-bad">
            {queue.reason || 'วันนี้ปิดให้บริการ'}
          </p>
        ) : queue?.slots.length ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {queue.slots.map((slot, index) => (
              <div
                key={slot.time}
                className={`flex flex-col items-center justify-center rounded-lg border border-line bg-surface px-2 py-2 text-center ${
                  queue.slots.length % 2 === 1 && index === queue.slots.length - 1
                    ? 'col-span-2'
                    : ''
                }`}
              >
                <span className="text-xs font-semibold">{slot.time}–{slot.endTime}</span>
                <span className={`mt-0.5 text-[11px] ${
                  slot.status === 'available' ? 'text-ok' : 'text-mute'
                }`}>
                  {slot.status === 'available' ? 'ว่าง' : slot.status === 'full' ? 'เต็ม' : 'ปิด'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-3 text-xs text-mute">ไม่มีช่วงเวลาให้บริการวันนี้</p>
        )}
      </section>
      <section className="mx-5 mt-5 overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-raised via-surface to-night p-5">
        <Moon className="text-gold" size={26} />
        <h2 className="mt-3 font-display text-lg font-semibold">จองคิวดูดวงได้ในไม่กี่ขั้นตอน</h2>
        <p className="mt-1 text-sm text-mute">เลือกบริการ เลือกเวลา แล้วชำระเงินในแอปได้เลย</p>
        <button onClick={() => nav('/booking')} className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gold text-base font-semibold text-night active:scale-[.98]">
          <CalendarPlus size={20} />จองคิว
        </button>
      </section>

      <a
        href="https://www.instagram.com/witchyu_2006?xtok=MTY1dzFwYTZxcHg2Ng%3D%3D&utm_source=qr"
        target="_blank"
        rel="noopener noreferrer"
        className="mx-5 mt-4 flex min-h-[60px] items-center justify-center gap-3 rounded-2xl border border-gold/40 bg-gold px-4 py-3 font-semibold text-white active:scale-[.98]"
      >
        <Instagram size={22} />
        ติดต่อ Witchyu ผ่าน Instagram
      </a>

      <section className="mx-5 mt-4 flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
        <Clock size={20} className="text-gold" />
        <div className="text-sm">
          <div className="font-medium">เวลาทำการ</div>
          <div className="text-mute">{SHOP.hoursLabel}</div>
        </div>
      </section>

      <section className="mt-7 px-5">
        <h2 className="font-display text-lg font-semibold">บริการของเรา</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {[
            { icon: Sparkles, label: 'ดูดวงแบบคำถาม', sub: 'เริ่มต้น 29 บาท', to: '/services' },
            { icon: Phone, label: 'ดูดวงผ่านสาย', sub: 'เริ่มต้น 99 บาท', to: '/services' },
            { icon: MessageCircle, label: 'แชตกับหมอดู', sub: 'คุยต่อได้หลังจองคิว', to: '/chat' },
          ].map(({ icon: Icon, label, sub, to }) => (
            <button key={label} onClick={() => nav(to)} className="flex min-h-[64px] items-center gap-4 rounded-2xl border border-line bg-surface px-4 py-3 text-left active:bg-raised">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-gold/10 text-gold"><Icon size={22} /></span>
              <span><span className="block font-medium">{label}</span><span className="text-sm text-mute">{sub}</span></span>
            </button>
          ))}
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mt-7">
          <div className="flex items-center justify-between px-5">
            <h2 className="font-display text-lg font-semibold">บริการแนะนำ</h2>
            <button onClick={() => nav('/services')} className="h-10 text-sm text-gold">ดูทั้งหมด</button>
          </div>
          <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-5">
            {featured.map((s) => (
              <button key={s.id} onClick={() => nav(`/booking?service=${s.id}`)} className="w-44 shrink-0 rounded-2xl border border-line bg-surface p-4 text-left active:bg-raised">
                <div className="font-semibold">{s.name}</div>
                <div className="mt-1 line-clamp-2 text-xs text-mute">{s.desc}</div>
                <div className="mt-3 font-display text-lg text-gold">{s.price} <span className="text-xs text-mute">บาท</span></div>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="px-5 pt-7">
        <button onClick={() => setContact(true)} className="h-12 w-full rounded-2xl border border-line bg-surface text-sm font-medium active:bg-raised">ติดต่อเรา</button>
      </div>

      <BottomSheet open={contact} title="ติดต่อเรา" onClose={() => setContact(false)}>
        <p className="text-sm text-mute">เวลาทำการ: {SHOP.hoursLabel}</p>
        <a
          href="https://www.instagram.com/witchyu_2006?xtok=MTY1dzFwYTZxcHg2Ng%3D%3D&utm_source=qr"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex h-12 items-center justify-center gap-2 rounded-2xl border border-gold/40 bg-gold font-semibold text-white"
        >
          <Instagram size={18} /> Instagram @witchyu_2006
        </a>
        <button onClick={() => { setContact(false); nav('/chat') }} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gold font-semibold text-night">
          <MessageCircle size={18} />ไปที่แชต
        </button>
      </BottomSheet>
    </div>
  )
}
