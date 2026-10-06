import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { adminApi } from '../../services/adminApi'
import { errorMessage } from '../../services/api'
import { useLoad } from '../../components/admin/useLoad'
import Toggle from '../../components/admin/Toggle'
import BottomSheet from '../../components/BottomSheet'
import Modal from '../../components/Modal'
import { ErrorState, Spinner } from '../../components/states'
import { useToast } from '../../hooks/useToast'
import type {
  AdminServiceCategory,
  AdminServiceCategoryInput,
} from '../../types/admin'

interface Form {
  id: string
  label: string
  hint: string
  note: string
  multi: boolean
  active: boolean
  sortOrder: string
}

const blank = (): Form => ({
  id: '',
  label: '',
  hint: '',
  note: '',
  multi: false,
  active: true,
  sortOrder: '0',
})

const fromCategory = (c: AdminServiceCategory): Form => ({
  id: c.id,
  label: c.label,
  hint: c.hint,
  note: c.note,
  multi: c.multi,
  active: c.active,
  sortOrder: String(c.sortOrder),
})

const input =
  'h-12 w-full rounded-xl border border-line bg-night px-4 text-ink focus:border-gold focus:outline-none'

export default function AdminServiceCategories() {
  const toast = useToast()
  const { data, setData, status, error, reload } =
    useLoad(() => adminApi.serviceCategories())

  const [form, setForm] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)
  const [del, setDel] = useState<AdminServiceCategory | null>(null)

  if (status === 'loading') return <Spinner />
  if (status === 'error' || !data) {
    return (
      <ErrorState
        title="โหลดหมวดหมู่ไม่สำเร็จ"
        text={error}
        onRetry={reload}
      />
    )
  }

  const replace = (category: AdminServiceCategory) => {
    setData(
      data
        .map((x) => (x.id === category.id ? category : x))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)),
    )
  }

  const set = (patch: Partial<Form>) => {
    setForm((current) => (current ? { ...current, ...patch } : current))
  }

  const toggleActive = async (
    category: AdminServiceCategory,
    active: boolean,
  ) => {
    const previous = category

    replace({ ...category, active })

    try {
      replace(await adminApi.updateServiceCategory(category.id, { active }))
    } catch (e) {
      replace(previous)
      toast(errorMessage(e), 'error')
    }
  }

  const save = async () => {
    if (!form || saving) return

    const id = form.id.trim()
    const label = form.label.trim()
    const hint = form.hint.trim()
    const note = form.note.trim()
    const sortOrder = Number(form.sortOrder)

    if (!id) {
      toast('กรุณากรอกรหัสหมวดหมู่', 'error')
      return
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      toast('รหัสหมวดหมู่ใช้ได้เฉพาะ a-z, A-Z, 0-9, _ และ -', 'error')
      return
    }

    if (!label) {
      toast('กรุณากรอกชื่อหมวดหมู่', 'error')
      return
    }

    if (
      !Number.isInteger(sortOrder) ||
      sortOrder < 0 ||
      sortOrder > 9999
    ) {
      toast('ลำดับหมวดหมู่ต้องเป็นจำนวนเต็ม 0–9999', 'error')
      return
    }

    setSaving(true)

    try {
      if (data.some((x) => x.id === id && x.id !== form.id)) {
        toast('รหัสหมวดหมู่นี้มีอยู่แล้ว', 'error')
        return
      }

      if (form.id) {
        const updated = await adminApi.updateServiceCategory(form.id, {
          label,
          hint,
          note,
          multi: form.multi,
          active: form.active,
          sortOrder,
        })

        replace(updated)
        toast('บันทึกหมวดหมู่แล้ว', 'success')
      } else {
        const created = await adminApi.createServiceCategory({
          id,
          label,
          hint,
          note,
          multi: form.multi,
          active: form.active,
          sortOrder,
        } satisfies AdminServiceCategoryInput)

        setData(
          [...data, created].sort(
            (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
          ),
        )

        toast('เพิ่มหมวดหมู่แล้ว', 'success')
      }

      setForm(null)
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!del) return

    try {
      await adminApi.deleteServiceCategory(del.id)
      setData(data.filter((x) => x.id !== del.id))
      toast('ลบหมวดหมู่แล้ว', 'success')
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setDel(null)
    }
  }

  return (
    <section className="mt-8 border-t border-line pt-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">
            หมวดหมู่บริการ
          </h2>
          <p className="mt-1 text-sm text-mute">
            จัดการหมวดหมู่ที่ใช้จัดกลุ่มบริการ
          </p>
        </div>

        <button
          onClick={() => setForm(blank())}
          className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-gold px-4 text-sm font-semibold text-night"
        >
          <Plus size={18} />
          เพิ่มหมวด
        </button>
      </div>

      <div className="grid gap-2">
        {data.map((category) => (
          <div
            key={category.id}
            className={`rounded-2xl border border-line bg-surface p-4 ${
              category.active ? '' : 'opacity-60'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{category.label}</span>

                  <span className="rounded-full bg-raised px-2 py-0.5 text-xs text-mute">
                    {category.id}
                  </span>

                  {category.multi && (
                    <span className="rounded-full bg-gold/10 px-2 py-0.5 text-xs text-gold">
                      หลายรายการ
                    </span>
                  )}
                </div>

                {category.hint && (
                  <div className="mt-1 text-sm text-mute">
                    {category.hint}
                  </div>
                )}

                {category.note && (
                  <div className="mt-1 text-xs text-mute">
                    {category.note}
                  </div>
                )}

                <div className="mt-2 text-xs text-mute">
                  ลำดับ {category.sortOrder}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Toggle
                  label={`เปิดใช้งานหมวด ${category.label}`}
                  checked={category.active}
                  onChange={(value) => toggleActive(category, value)}
                />

                <button
                  aria-label={`แก้ไขหมวด ${category.label}`}
                  onClick={() => setForm(fromCategory(category))}
                  className="grid h-11 w-11 place-items-center rounded-xl bg-raised"
                >
                  <Pencil size={18} />
                </button>

                <button
                  aria-label={`ลบหมวด ${category.label}`}
                  onClick={() => setDel(category)}
                  className="grid h-11 w-11 place-items-center rounded-xl bg-bad/15 text-bad"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {data.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-mute">
            ยังไม่มีหมวดหมู่บริการ
          </div>
        )}
      </div>

      <BottomSheet
        open={!!form}
        title={form?.id ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่'}
        onClose={() => !saving && setForm(null)}
      >
        {form && (
          <div className="grid gap-3 text-sm">
            <label className="grid gap-1.5">
              รหัสหมวดหมู่
              <input
                className={input}
                value={form.id}
                disabled={!!form.id}
                onChange={(e) =>
                  set({ id: e.target.value.replace(/\s/g, '').slice(0, 50) })
                }
                maxLength={50}
                placeholder="เช่น question"
              />
            </label>

            <label className="grid gap-1.5">
              ชื่อหมวดหมู่
              <input
                className={input}
                value={form.label}
                onChange={(e) => set({ label: e.target.value })}
                maxLength={100}
                placeholder="เช่น คำถามเจาะจง"
              />
            </label>

            <label className="grid gap-1.5">
              คำอธิบาย
              <input
                className={input}
                value={form.hint}
                onChange={(e) => set({ hint: e.target.value })}
                maxLength={500}
              />
            </label>

            <label className="grid gap-1.5">
              หมายเหตุ
              <textarea
                rows={4}
                className="w-full resize-none rounded-xl border border-line bg-night p-3 text-ink focus:border-gold focus:outline-none"
                value={form.note}
                onChange={(e) => set({ note: e.target.value })}
                maxLength={1000}
              />
            </label>

            <label className="grid gap-1.5">
              ลำดับการแสดง
              <input
                className={input}
                inputMode="numeric"
                value={form.sortOrder}
                onChange={(e) =>
                  set({
                    sortOrder: e.target.value.replace(/\D/g, '').slice(0, 4),
                  })
                }
              />
            </label>

            <div className="flex items-center justify-between gap-3 rounded-xl bg-night/60 px-4 py-3">
              <span>อนุญาตให้เลือกหลายบริการในหมวดนี้</span>
              <Toggle
                label="เลือกหลายบริการ"
                checked={form.multi}
                onChange={(value) => set({ multi: value })}
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl bg-night/60 px-4 py-3">
              <span>เปิดให้ใช้งาน</span>
              <Toggle
                label="เปิดใช้งานหมวดหมู่"
                checked={form.active}
                onChange={(value) => set({ active: value })}
              />
            </div>

            <button
              disabled={saving}
              onClick={save}
              className="mt-2 h-14 rounded-2xl bg-gold font-semibold text-night disabled:opacity-60"
            >
              {saving ? 'กำลังบันทึก' : 'บันทึก'}
            </button>
          </div>
        )}
      </BottomSheet>

      <Modal
        open={!!del}
        danger
        title="ลบหมวดหมู่นี้?"
        confirmLabel="ลบ"
        cancelLabel="ไม่ลบ"
        onCancel={() => setDel(null)}
        onConfirm={remove}
      >
        “{del?.label}” จะถูกลบถาวร ระบบจะอนุญาตให้ลบได้เฉพาะหมวดที่ไม่มีบริการใช้งานอยู่เท่านั้น
      </Modal>
    </section>
  )
}
