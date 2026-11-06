import { useState } from 'react'
import { Plus, Save, Trash2, X, Clock3 } from 'lucide-react'
import { adminApi } from '../../services/adminApi'
import { errorMessage } from '../../services/api'
import { useLoad } from '../../components/admin/useLoad'
import Toggle from '../../components/admin/Toggle'
import Modal from '../../components/Modal'
import { ErrorState, Spinner } from '../../components/states'
import { useToast } from '../../hooks/useToast'
import type { AdminSlot } from '../../types/admin'

type SlotForm = {
  time: string
  endTime: string
}
const emptyForm: SlotForm = {
  time: '',
  endTime: '',
}

const validTime = (value: string) =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

const sortSlots = (slots: AdminSlot[]) =>
  [...slots].sort((a, b) => a.time.localeCompare(b.time))

export default function AdminSlots() {
  const toast = useToast()
  const { data, setData, status, error, reload } = useLoad(() => adminApi.slots())

  const [form, setForm] = useState<SlotForm>(emptyForm)
  const [adding, setAdding] = useState(false)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<SlotForm>(emptyForm)
  const [del, setDel] = useState<AdminSlot | null>(null)

  if (status === 'loading') return <Spinner />
  if (status === 'error' || !data) {
    return <ErrorState title="โหลดรอบเวลาไม่สำเร็จ" text={error} onRetry={reload} />
  }

  const updateForm = (key: keyof SlotForm, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const updateEditForm = (key: keyof SlotForm, value: string | boolean) => {
    setEditForm((current) => ({ ...current, [key]: value }))
  }

  const validateRange = (start: string, end: string) => {
    if (!validTime(start) || !validTime(end)) {
      toast('กรุณากำหนดเวลาเริ่มต้นและสิ้นสุดให้ถูกต้อง', 'error')
      return false
    }
    if (start === end) {
      toast('เวลาเริ่มต้นและสิ้นสุดต้องไม่ตรงกัน', 'error')
      return false
    }
    return true
  }

  const add = async () => {
    if (adding) return
    if (!validateRange(form.time, form.endTime)) return

    setAdding(true)
    try {
      const slot = await adminApi.createSlot(form)
      setData(sortSlots([
        ...data,
        slot,
      ]))
      setForm(emptyForm)
      toast('เพิ่มรอบเวลาแล้ว', 'success')
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setAdding(false)
    }
  }

  const startEdit = (slot: AdminSlot) => {
    setEditingId(slot.id)
    setEditForm({
      time: slot.time,
      endTime: slot.endTime,
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm(emptyForm)
  }

  const saveEdit = async (slot: AdminSlot) => {
    if (savingId !== null) return
    if (!validateRange(editForm.time, editForm.endTime)) return

    setSavingId(slot.id)
    try {
      const updated = await adminApi.updateSlot(slot.id, editForm)
      setData(sortSlots(data.map((item) => {
        if (item.id === updated.id) return updated
        return item
      })))
      cancelEdit()
      toast('บันทึกรอบเวลาแล้ว', 'success')
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setSavingId(null)
    }
  }

  const patch = async (slot: AdminSlot, patchData: { active?: boolean }) => {
    const previous = data
    setData(data.map((item) =>
      item.id === slot.id ? { ...item, ...patchData } : item
    ))

    try {
      const updated = await adminApi.updateSlot(slot.id, patchData)
      setData(data.map((item) =>
        item.id === updated.id ? updated : item
      ))
    } catch (e) {
      setData(previous)
      toast(errorMessage(e), 'error')
    }
  }

  const remove = async () => {
    if (!del) return
    try {
      await adminApi.deleteSlot(del.id)
      setData(data.filter((item) => item.id !== del.id))
      toast('ลบรอบเวลาแล้ว', 'success')
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setDel(null)
    }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 font-display text-base font-semibold">
          เพิ่มรอบเวลาใหม่
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
          <label className="grid gap-1.5 text-sm">
            เวลาเริ่มต้น
            <input
              type="time"
              value={form.time}
              onChange={(e) => updateForm('time', e.target.value)}
              className="h-12 rounded-xl border border-line bg-night px-3 focus:border-primary focus:outline-none"
            />
          </label>

          <label className="grid gap-1.5 text-sm">
            เวลาสิ้นสุด
            <input
              type="time"
              value={form.endTime}
              onChange={(e) => updateForm('endTime', e.target.value)}
              className="h-12 rounded-xl border border-line bg-night px-3 focus:border-primary focus:outline-none"
            />
          </label>

          <button
            disabled={adding}
            onClick={add}
            className="flex h-12 items-center justify-center gap-2 self-end rounded-xl bg-primary px-5 font-semibold text-white disabled:opacity-60"
          >
            <Plus size={18} />
            {adding ? 'กำลังเพิ่ม...' : 'เพิ่มรอบเวลา'}
          </button>
        </div>

      </section>

      <section>
        <h2 className="mb-1 font-display text-base font-semibold">
          รอบเวลาทั้งหมด
        </h2>
        <p className="mb-3 text-sm text-mute">
          แต่ละรอบรับจองได้ 1 คน · ลูกค้าจะเห็นช่วงเวลาตามที่กำหนดไว้
        </p>

        <ul className="grid gap-3 md:grid-cols-2">
          {data.map((slot) => (
            <li
              key={slot.id}
              className={`rounded-2xl border border-line bg-surface p-3 ${
                slot.active ? '' : 'opacity-60'
              }`}
            >
              {editingId === slot.id ? (
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="grid gap-1 text-sm">
                      เวลาเริ่มต้น
                      <input
                        type="time"
                        value={editForm.time}
                        onChange={(e) => updateEditForm('time', e.target.value)}
                        className="h-11 min-w-0 rounded-xl border border-line bg-night px-2"
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      เวลาสิ้นสุด
                      <input
                        type="time"
                        value={editForm.endTime}
                        onChange={(e) => updateEditForm('endTime', e.target.value)}
                        className="h-11 min-w-0 rounded-xl border border-line bg-night px-2"
                      />
                    </label>
                  </div>


                  <div className="flex gap-2">
                    <button
                      disabled={savingId === slot.id}
                      onClick={() => saveEdit(slot)}
                      className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 font-semibold text-white"
                    >
                      <Save size={16} />
                      บันทึก
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="flex h-10 items-center justify-center gap-2 rounded-xl bg-raised px-3"
                    >
                      <X size={16} />
                      ยกเลิก
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Clock3 size={19} className="text-primary" />
                      <span className="font-display text-xl font-semibold">
                        {slot.time}–{slot.endTime}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Toggle
                      label={`เปิดรับจองรอบ ${slot.time} ถึง ${slot.endTime}`}
                      checked={slot.active}
                      onChange={(value) => patch(slot, { active: value })}
                    />

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEdit(slot)}
                        className="h-10 rounded-xl bg-raised px-3 text-sm"
                      >
                        แก้ไข
                      </button>
                      <button
                        aria-label={`ลบรอบ ${slot.time}`}
                        onClick={() => setDel(slot)}
                        className="grid h-10 w-10 place-items-center rounded-xl bg-bad/15 text-bad"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>

        {data.length === 0 && (
          <p className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-mute">
            ยังไม่มีรอบเวลา — ลูกค้าจะจองไม่ได้จนกว่าจะเพิ่ม
          </p>
        )}
      </section>

      <Modal
        open={!!del}
        danger
        title="ลบรอบเวลานี้?"
        confirmLabel="ลบ"
        cancelLabel="ไม่ลบ"
        onCancel={() => setDel(null)}
        onConfirm={remove}
      >
        รอบ {del?.time}–{del?.endTime} จะถูกนำออกจากหน้าลูกค้า
        หากมีการจองที่ยังไม่ถึงเวลา ระบบจะไม่อนุญาตให้ลบ
      </Modal>
    </div>
  )
}