import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Loader2, ImageOff } from 'lucide-react'
import { adminApi, adminToken } from '../../services/adminApi'
import { getClientId } from '../../services/clientId'
import { useToast } from '../../hooks/useToast'
import { errorMessage } from '../../services/api'

const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '')

export default function AdminPaymentReview({
  bookingId,
  onReviewed,
}: {
  bookingId: string
  onReviewed: () => void
}) {
  const toast = useToast()
  const [imageUrl, setImageUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    let active = true
    let objectUrl = ''

    const load = async () => {
      try {
        const response = await fetch(
          `${BASE}/api/admin/bookings/${encodeURIComponent(bookingId)}/payment-slip`,
          {
            headers: {
              Authorization: `Bearer ${adminToken.get()}`,
              'X-Client-Id': getClientId(),
            },
            cache: 'no-store',
          },
        )
        if (!response.ok) throw new Error('ไม่สามารถโหลดภาพสลิปได้')
        const blob = await response.blob()
        objectUrl = URL.createObjectURL(blob)
        if (active) setImageUrl(objectUrl)
      } catch (error) {
        if (active) toast(errorMessage(error), 'error')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [bookingId])

  const review = async (decision: 'approved' | 'rejected') => {
    if (busy) return
    setBusy(true)
    try {
      await adminApi.reviewPaymentProof(bookingId, decision, note.trim())
      toast(
        decision === 'approved' ? 'อนุมัติการชำระเงินแล้ว' : 'ปฏิเสธสลิปแล้ว',
        'success',
      )
      onReviewed()
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-4 rounded-2xl border border-line bg-surface p-4">
      <h3 className="font-semibold">ตรวจสอบหลักฐานการชำระเงิน</h3>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-mute">
          <Loader2 className="animate-spin" size={20} />
          กำลังโหลดภาพสลิป
        </div>
      )}

      {!loading && imageUrl && (
        <img
          src={imageUrl}
          alt="หลักฐานการชำระเงิน"
          className="mt-3 max-h-[420px] w-full rounded-xl bg-white object-contain"
        />
      )}

      {!loading && !imageUrl && (
        <div className="flex items-center gap-2 py-6 text-sm text-mute">
          <ImageOff size={20} /> ไม่สามารถแสดงภาพสลิปได้
        </div>
      )}

      <label className="mt-4 block text-sm text-mute">
        หมายเหตุการตรวจสอบ
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          rows={3}
          placeholder="ระบุเหตุผลเมื่อปฏิเสธ หรือหมายเหตุเพิ่มเติม"
          className="mt-2 w-full rounded-xl border border-line bg-night p-3 text-text outline-none focus:border-purple-500"
        />
      </label>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          disabled={busy || loading || !imageUrl}
          onClick={() => review('approved')}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-purple-600 font-semibold text-white disabled:opacity-50"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
          อนุมัติ
        </button>
        <button
          disabled={busy || loading || !imageUrl}
          onClick={() => review('rejected')}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-bad/15 font-semibold text-bad disabled:opacity-50"
        >
          <XCircle size={18} /> ปฏิเสธ
        </button>
      </div>
    </section>
  )
}
