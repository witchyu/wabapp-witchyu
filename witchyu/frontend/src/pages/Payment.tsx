import { useEffect, useState, type ChangeEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Clock, ImagePlus, Loader2, Trash2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { EmptyState, ErrorState, Spinner } from '../components/states'
import { useBooking } from '../hooks/useBooking'
import { baht, dateLong, mmss } from '../utils/format'
import { useToast } from '../hooks/useToast'
import { bookingApi } from '../services/bookingApi'
import { errorMessage } from '../services/api'

type Proof = { id: string; status: string }

export default function Payment() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const { bookings, bookingsStatus, refreshBookings } = useBooking()
  const booking = bookings.find((b) => b.id === id)

  const [now, setNow] = useState(Date.now())
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [proofs, setProofs] = useState<Proof[]>([])
  const [loadingProofs, setLoadingProofs] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [proofImageUrl, setProofImageUrl] = useState('')

  const loadProofs = async () => {
    if (!id) return
    try {
      setProofs(await bookingApi.paymentProofs(id))
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setLoadingProofs(false)
    }
  }

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => { loadProofs() }, [id])

  useEffect(() => {
    if (!file) {
      setPreviewUrl('')
      return
    }

    const url = URL.createObjectURL(file)
    setPreviewUrl(url)

    return () => URL.revokeObjectURL(url)
  }, [file])

  const pendingProof = proofs.find((p) => p.status === 'pending')

  useEffect(() => {
    let active = true
    let objectUrl = ''

    setProofImageUrl('')

    if (!id || !pendingProof) {
      return () => { active = false }
    }

    bookingApi.paymentProofImage(id, pendingProof.id)
      .then((blob: Blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setProofImageUrl(objectUrl)
      })
      .catch((e: unknown) => {
        if (active) toast(errorMessage(e), 'error')
      })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id, pendingProof?.id])

  const hasPendingProof = proofs.some((p) => p.status === 'pending')
  const left = booking ? Math.max(0, Math.ceil((booking.expiresAt - now) / 1000)) : 0
  const timedOut = left === 0 && !hasPendingProof
  const pending = booking?.status === 'pending_payment'

  useEffect(() => {
    if (pending && timedOut && !uploading) refreshBookings()
  }, [pending, timedOut, uploading, refreshBookings])

  if (!booking && bookingsStatus === 'loading') return <Spinner />
  if (!booking) return <ErrorState title="ไม่พบรายการจอง" text="ลิงก์นี้อาจไม่ถูกต้อง ลองกลับไปที่หน้าการจอง" onRetry={() => nav('/bookings')} />
  if (booking.status === 'confirmed' || booking.status === 'completed') {
    return <Navigate to={`/bookings/${booking.id}`} replace />
  }

  const expired = booking.status === 'cancelled' || timedOut

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!selected) return
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(selected.type)) {
      toast('รองรับเฉพาะไฟล์ JPG, PNG และ WebP', 'error')
      return
    }
    if (selected.size > 2 * 1024 * 1024) {
      toast('ไฟล์ต้องมีขนาดไม่เกิน 2 MB', 'error')
      return
    }
    setFile(selected)
  }

  const submitSlip = async () => {
    if (!id || !file || uploading || hasPendingProof || expired) return
    setUploading(true)
    try {
      await bookingApi.uploadPaymentProof(id, file)
      setFile(null)
      await loadProofs()
      await refreshBookings()
      toast('ส่งสลิปแล้ว กรุณารอ Admin ตรวจสอบ', 'success')
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setUploading(false)
    }
  }

  const deleteSlip = async () => {
    if (!id || deleting) return
    setDeleting(true)
    try {
      await bookingApi.deletePaymentProof(id)
      await loadProofs()
      toast('ลบสลิปแล้ว สามารถส่งใหม่ได้', 'success')
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (expired) {
    return (
      <div>
        <PageHeader title="ชำระเงิน" />
        <EmptyState icon={<Clock size={28} />} title="รายการนี้หมดเวลาชำระเงิน" text="รอบเวลานี้ถูกปล่อยคืนแล้ว คุณสามารถจองคิวใหม่ได้" action={<button onClick={() => nav('/booking', { replace: true })} className="h-12 rounded-2xl bg-purple-600 px-8 font-semibold text-white">จองคิวใหม่</button>} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="ชำระเงิน" back="/" />
      <div className="px-4 pb-8 pt-5">
        <div className="rounded-2xl border border-line bg-surface p-4 text-sm">
          <div className="flex justify-between gap-3"><span className="text-mute">บริการ</span><span className="text-right">{booking.serviceName}{booking.questionCount ? ` (${booking.questionCount} คำถาม)` : ''}</span></div>
          <div className="mt-2 flex justify-between"><span className="text-mute">วันที่</span><span>{dateLong(booking.date)}</span></div>
          <div className="mt-2 flex justify-between"><span className="text-mute">เวลา</span><span>{booking.time} น.</span></div>
        </div>

        <div className="mt-6 text-center">
          <div className="text-sm text-mute">ยอดชำระ</div>
          <div className="font-display text-4xl font-semibold text-purple-400">{baht(booking.price)}</div>
        </div>

        {!hasPendingProof && (
          <>
        <div className="mt-5 flex flex-col items-center rounded-2xl border border-line bg-white p-4">
          <img src="/qrcode.png" alt="QR Code สำหรับชำระเงิน" className="h-auto w-full max-w-[280px] object-contain" />

          <p className="mt-3 text-center text-sm font-semibold text-gray-900">
            สแกน QR Code เพื่อชำระเงิน
          </p>
          <p className="mt-1 text-center text-xs text-gray-600">
            กรุณาตรวจสอบยอดเงินก่อนยืนยันการโอน
          </p>

          <div className="mt-5 text-center">
            <p className="font-medium text-gray-900">
              นางสาววรรณรดา ทรรศนีย์กุลกิจ
            </p>

            <div className="mt-4 flex items-center justify-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-white">
                <img
                  src="/tmn.png"
                  alt="TrueMoney Wallet"
                  className="h-5 w-5 object-contain"
                />
              </div>
              <p className="font-semibold text-gray-900">
                TrueMoney Wallet
              </p>
            </div>

            <p className="mt-4 text-lg font-semibold tracking-wide text-gray-900">
              062-450-9500
            </p>
          </div>
        </div>

          </>
        )}

        {hasPendingProof ? (
          <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-center gap-2 font-semibold text-emerald-500">
              <CheckCircle2 size={20} /> ส่งหลักฐานแล้ว
            </div>
            <p className="mt-2 text-sm text-mute">ระบบได้รับสลิปแล้ว ขณะนี้กำลังรอ Admin ตรวจสอบ การจองจะยังไม่ยืนยันจนกว่าจะได้รับอนุมัติ</p>

            <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
              {proofImageUrl ? (
                <img
                  src={proofImageUrl}
                  alt="สลิปการโอนเงินที่ส่งแล้ว"
                  className="mx-auto max-h-[480px] w-full object-contain"
                />
              ) : (
                <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-mute">
                  <Loader2 size={18} className="animate-spin" />
                  กำลังโหลดรูปสลิป...
                </div>
              )}
            </div>

            <button onClick={deleteSlip} disabled={deleting} className="mt-3 flex items-center gap-2 text-sm text-bad disabled:opacity-50">
              {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              ลบสลิปที่ส่งไป
            </button>
            <button
              onClick={() => nav('/')}
              className="mt-5 flex h-12 w-full items-center justify-center rounded-2xl bg-purple-600 font-semibold text-white active:scale-[.98]"
            >
              กลับไปยังหน้าแรก
            </button>
          </div>
        ) : (
          <>
            <div className="mt-6 text-center">
              <div className="text-sm text-mute">เวลาที่เหลือในการชำระ</div>
              <div className={`font-display text-3xl font-semibold ${left < 60 ? 'text-bad' : ''}`}>{mmss(left)}</div>
            </div>

            <label className="mt-6 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line bg-surface p-4 text-center">
              <ImagePlus size={28} className="text-purple-400" />
              <span className="mt-2 font-semibold">{file ? file.name : 'เลือกภาพสลิปการโอนเงิน'}</span>
              <span className="mt-1 text-xs text-mute">JPG, PNG หรือ WebP · ไม่เกิน 2 MB</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseFile} className="sr-only" />
            </label>

            {file && previewUrl && (
              <div className="mt-4 rounded-2xl border border-line bg-surface p-3">
                <p className="mb-2 text-sm font-semibold text-mute">
                  ตัวอย่างสลิปที่เลือก
                </p>
                <div className="flex justify-center overflow-hidden rounded-xl bg-white p-2">
                  <img
                    src={previewUrl}
                    alt="ตัวอย่างภาพสลิปที่เลือกก่อนส่ง"
                    className="max-h-64 w-auto max-w-full rounded-lg object-contain"
                  />
                </div>
                <p className="mt-2 truncate text-center text-xs text-mute">
                  {file.name}
                </p>
              </div>
            )}

            <button onClick={submitSlip} disabled={!file || uploading || left === 0} className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-purple-600 text-base font-semibold text-white active:scale-[.98] disabled:opacity-50">
              {uploading ? <><Loader2 className="animate-spin" size={20} />กำลังส่งสลิป</> : 'ส่งสลิปเพื่อรอตรวจสอบ'}
            </button>
          </>
        )}

        <p className="mt-4 text-center text-xs text-mute">
          {loadingProofs ? 'กำลังตรวจสอบสถานะสลิป...' : 'การส่งสลิปยังไม่ถือว่าชำระเงินสำเร็จ ต้องรอ Admin ตรวจสอบและอนุมัติก่อน'}
        </p>
      </div>
    </div>
  )
}
