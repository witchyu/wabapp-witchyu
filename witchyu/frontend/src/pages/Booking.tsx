import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarX, ChevronLeft, ListChecks, X } from 'lucide-react'
import StepInfo from '../components/booking/StepInfo'
import StepService from '../components/booking/StepService'
import StepDateTime from '../components/booking/StepDateTime'
import StepNote from '../components/booking/StepNote'
import StepSummary from '../components/booking/StepSummary'
import { EmptyState } from '../components/states'
import PageHeader from '../components/PageHeader'
import { useBooking } from '../hooks/useBooking'
import { useToast } from '../hooks/useToast'
import { getService, selectionTotal } from '../data/services'
import { validateCustomer, validateSchedule, validateSelection } from '../utils/bookingRules'
import { SHOP } from '../data/shop'

const TITLES = ['ข้อมูลผู้จอง', 'เลือกบริการ', 'วันและเวลา', 'หมายเหตุ', 'สรุปการจอง']

export default function Booking() {
  const nav = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const { draft, patchDraft, setMulti, resetDraft, bookings, createBooking } = useBooking()
  const [step, setStep] = useState(0)

  // มาจากหน้า Services/Home พร้อมบริการที่เลือกไว้แล้ว
  useEffect(() => {
    const id = params.get('service')
    if (id && getService(id)) patchDraft({ serviceIds: [id], multi: false, time: '' })
  }, [params, patchDraft])

  if (!SHOP.isOpen) {
    return (
      <div>
        <PageHeader title="จองคิว" back="/" />
        <EmptyState icon={<CalendarX size={28} />} title="ขณะนี้ร้านปิดรับจองคิว" text="กลับมาดูอีกครั้งตอนร้านเปิดนะ" />
      </div>
    )
  }

  const validate = (): string | null => {
    if (step === 0) return validateCustomer(draft.customer)
    if (step === 1) return validateSelection(draft)
    if (step === 2) return validateSchedule(draft, bookings, Date.now())
    return null
  }

  const next = () => {
    const err = validate()
    if (err) return toast(err, 'error')
    setStep((s) => s + 1)
  }

  const back = () => (step === 0 ? nav(-1) : setStep((s) => s - 1))

  const confirm = () => {
    const result = createBooking()
    if (!result.ok) {
      toast(result.error, 'error')
      setStep(result.step)
      return
    }
    resetDraft()
    nav(`/payment/${result.booking.id}`, { replace: true })
  }

  const last = step === TITLES.length - 1

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-night/90 px-3 pb-3 backdrop-blur" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
        <div className="flex items-center gap-2">
          <button onClick={back} aria-label="ย้อนกลับ" className="grid h-11 w-11 place-items-center rounded-full active:bg-raised"><ChevronLeft size={24} /></button>
          <div className="flex-1">
            <div className="text-xs text-mute">ขั้นตอนที่ {step + 1} จาก {TITLES.length}</div>
            <h1 className="font-display text-lg font-semibold">{TITLES[step]}</h1>
          </div>
          {step === 1 && (draft.multi ? (
            <button onClick={() => setMulti(false)} className="flex h-11 items-center gap-1.5 rounded-full bg-raised px-4 text-sm font-medium"><X size={16} />ยกเลิก</button>
          ) : (
            <button onClick={() => setMulti(true)} className="flex h-11 items-center gap-1.5 rounded-full bg-gold px-4 text-sm font-semibold text-night"><ListChecks size={16} />เลือกหลายรายการ</button>
          ))}
        </div>
        <div className="mt-3 flex gap-1.5 px-2" aria-hidden>
          {TITLES.map((_, i) => <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-gold' : 'bg-line'}`} />)}
        </div>
      </header>

      <div className={`mx-auto px-4 pb-44 pt-5 ${step === 1 ? 'max-w-6xl' : 'max-w-2xl'}`}>
        {step === 0 && <StepInfo />}
        {step === 1 && <StepService />}
        {step === 2 && <StepDateTime />}
        {step === 3 && <StepNote />}
        {step === 4 && <StepSummary />}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pt-3 backdrop-blur" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
        <div className={`mx-auto ${step === 1 ? 'max-w-6xl' : 'max-w-2xl'}`}>
          {step >= 1 && draft.serviceIds.length > 0 && (
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-mute">เลือกแล้ว {draft.serviceIds.length} รายการ</span>
              <span className="font-semibold text-gold">รวม {selectionTotal(draft.serviceIds, draft.questionCount)} บาท</span>
            </div>
          )}
          <button onClick={last ? confirm : next} className="h-14 w-full rounded-2xl bg-gold text-base font-semibold text-night active:scale-[.98]">
            {last ? 'ยืนยันการจอง' : 'ถัดไป'}
          </button>
        </div>
      </div>
    </div>
  )
}
