import { useState } from 'react'
import { CalendarCheck, Clock, Hourglass, WalletCards } from 'lucide-react'
import { adminApi } from '../../services/adminApi'
import { errorMessage } from '../../services/api'
import { useLoad } from '../../components/admin/useLoad'
import Toggle from '../../components/admin/Toggle'
import Modal from '../../components/Modal'
import StatusBadge from '../../components/StatusBadge'
import { ErrorState, Spinner } from '../../components/states'
import { useToast } from '../../hooks/useToast'
import type { AdminSettings } from '../../types/admin'
import { baht, dateShort } from '../../utils/format'

export default function Dashboard() {
  const toast = useToast()
  const { data, setData, status, error, reload } = useLoad(() => adminApi.dashboard())
  const [busy, setBusy] = useState(false)
  const [askClose, setAskClose] = useState(false)

  if (status === 'loading') return <Spinner />
  if (status === 'error' || !data) return <ErrorState title="โหลดข้อมูลไม่สำเร็จ" text={error} onRetry={reload} />

  const save = async (patch: Partial<AdminSettings>) => {
    if (busy) return
    setBusy(true)
    const prev = data
    setData({ ...data, settings: { ...data.settings, ...patch } }) // แสดงผลทันที ถ้าบันทึกไม่สำเร็จจะย้อนกลับ
    try {
      const settings = await adminApi.updateSettings(patch)
      setData({ ...data, settings })
      toast('บันทึกแล้ว', 'success')
    } catch (e) {
      setData(prev)
      toast(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const updateRetention = async (
    field:
      | 'customerDataRetentionDays'
      | 'bookingRetentionDays'
      | 'chatRetentionDays'
      | 'callRecordRetentionDays'
      | 'systemLogRetentionDays',
    value: string,
  ) => {
    if (busy) return

    const days = Number(value)

    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      toast('จำนวนวันต้องเป็นจำนวนเต็ม 1–3650 วัน', 'error')
      return
    }

    await save({ [field]: days })
  }

  const stats = [
    { icon: CalendarCheck, label: 'คิววันนี้', value: data.stats.todayCount },
    { icon: Hourglass, label: 'รอชำระเงิน', value: data.stats.pendingCount },
    { icon: Clock, label: 'ยืนยันแล้ว (ยังไม่ถึงเวลา)', value: data.stats.upcomingCount },
    { icon: WalletCards, label: 'รายได้วันนี้', value: baht(data.stats.todayRevenue) },
    { icon: WalletCards, label: 'รายได้รวม', value: baht(data.stats.totalRevenue) },
    { icon: CalendarCheck, label: 'รายการที่สร้างรายได้', value: data.stats.paidCount },
  ]

  return (
    <div className="grid gap-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-2xl border border-line bg-surface p-4">
            <Icon size={20} className="text-gold" />
            <div className="mt-3 font-display text-3xl font-semibold">{value}</div>
            <div className="text-sm text-mute">{label}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-3 rounded-2xl border border-line bg-surface p-4 md:grid-cols-2">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="font-medium">เปิดรับจองคิว (เปิด/ปิดร้าน)</div>
            <div className="text-sm text-mute">{data.settings.shopOpen ? 'ลูกค้าจองคิวได้ตามปกติ' : 'ปิดอยู่ — ลูกค้าจองคิวไม่ได้'}</div>
          </div>
          <Toggle label="เปิดรับจองคิว" checked={data.settings.shopOpen} disabled={busy} onChange={(v) => (v ? save({ shopOpen: true }) : setAskClose(true))} />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="font-medium">เปิดรับจองโทร</div>
            <div className="text-sm text-mute">{data.settings.callsEnabled ? 'ลูกค้าจองแพ็กเกจโทรได้' : 'ปิดอยู่ — ลูกค้าจองแพ็กเกจโทรไม่ได้'}</div>
          </div>
          <Toggle label="เปิดรับจองโทร" checked={data.settings.callsEnabled} disabled={busy} onChange={(v) => save({ callsEnabled: v })} />
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-4">
          <h2 className="font-display text-lg font-semibold">
            การเก็บข้อมูล
          </h2>
          <p className="mt-1 text-sm text-mute">
            กำหนดจำนวนวันที่ระบบจะเก็บข้อมูลแต่ละประเภท
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {[
            {
              field: 'customerDataRetentionDays' as const,
              label: 'ข้อมูลลูกค้า',
              value: data.settings.customerDataRetentionDays,
            },
            {
              field: 'bookingRetentionDays' as const,
              label: 'ข้อมูลการจอง',
              value: data.settings.bookingRetentionDays,
            },
            {
              field: 'chatRetentionDays' as const,
              label: 'ข้อความแชต',
              value: data.settings.chatRetentionDays,
            },
            {
              field: 'callRecordRetentionDays' as const,
              label: 'ประวัติการโทร',
              value: data.settings.callRecordRetentionDays,
            },
            {
              field: 'systemLogRetentionDays' as const,
              label: 'System Log',
              value: data.settings.systemLogRetentionDays,
            },
          ].map(({ field, label, value }) => (
            <label
              key={field}
              className="flex items-center gap-3 rounded-xl bg-night/60 p-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{label}</span>
                <span className="text-xs text-mute">
                  เก็บไว้ {value} วัน
                </span>
              </span>

              <input
                type="number"
                min={1}
                max={3650}
                inputMode="numeric"
                defaultValue={value}
                disabled={busy}
                className="h-11 w-24 rounded-xl border border-line bg-night px-3 text-center text-ink focus:border-gold focus:outline-none disabled:opacity-60"
                onBlur={(e) => {
                  const next = e.currentTarget.value
                  if (Number(next) !== value) {
                    void updateRetention(field, next)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur()
                  }
                }}
              />

              <span className="text-sm text-mute">วัน</span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">คิวที่จะถึง</h2>
        {data.next.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-mute">ยังไม่มีคิวที่ยืนยันแล้ว</p>
        ) : (
          <ul className="grid gap-2">
            {data.next.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
                <span className="w-28 font-semibold">{dateShort(b.date)} · {b.time}</span>
                <span className="min-w-0 flex-1 break-words">{b.serviceName}{b.questionCount ? ` (${b.questionCount} คำถาม)` : ''} — {b.customer.nickname}</span>
                <span className="text-gold">{baht(b.price)}</span>
                <StatusBadge status={b.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal open={askClose} danger title="ปิดรับจองคิว?" confirmLabel="ปิดร้าน" cancelLabel="ไม่ปิด" onCancel={() => setAskClose(false)} onConfirm={() => { setAskClose(false); save({ shopOpen: false }) }}>
        ลูกค้าจะจองคิวใหม่ไม่ได้จนกว่าจะเปิดอีกครั้ง (การจองที่มีอยู่แล้วไม่ถูกยกเลิก)
      </Modal>
    </div>
  )
}
