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
import type { ServiceGroup } from '../../types'
import type { AdminService } from '../../types/admin'
import AdminServiceCategories from './AdminServiceCategories'

interface Form {
  id: string | null // null = เพิ่มใหม่
  group: ServiceGroup
  categoryId: string
  name: string
  desc: string
  price: string
  durationMin: string
  unlimited: boolean
  perQuestion: boolean
  questionsText: string
  active: boolean
  recommended: boolean
}

const blank = (categoryId = 'question', group: ServiceGroup = 'question'): Form => ({
  id: null,
  group,
  categoryId,
  name: '',
  desc: '',
  price: '',
  durationMin: '',
  unlimited: false,
  perQuestion: false,
  questionsText: '',
  active: true,
  recommended: false,
})

const fromService = (s: AdminService): Form => ({
  id: s.id,
  group: s.group,
  categoryId: s.categoryId ?? s.group,
  name: s.name,
  desc: s.desc,
  price: String(s.price),
  durationMin: s.durationMin ? String(s.durationMin) : '',
  unlimited: s.unlimited,
  perQuestion: s.perQuestion,
  questionsText: s.questions.join('\n'),
  active: s.active,
  recommended: s.recommended,
})

const input = 'h-12 w-full rounded-xl border border-line bg-night px-4 text-ink focus:border-gold focus:outline-none'

export default function AdminServices() {
  const toast = useToast()
  const {
    data,
    setData,
    status,
    error,
    reload,
  } = useLoad(() => adminApi.services())

  const {
    data: categories,
    status: categoryStatus,
    error: categoryError,
    reload: reloadCategories,
  } = useLoad(() => adminApi.serviceCategories())

  const [form, setForm] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)
  const [del, setDel] = useState<AdminService | null>(null)

  if (status === 'loading' || categoryStatus === 'loading') return <Spinner />

  if (status === 'error' || !data) {
    return (
      <ErrorState
        title="โหลดบริการไม่สำเร็จ"
        text={error}
        onRetry={reload}
      />
    )
  }

  if (categoryStatus === 'error' || !categories) {
    return (
      <ErrorState
        title="โหลดหมวดหมู่บริการไม่สำเร็จ"
        text={categoryError}
        onRetry={reloadCategories}
      />
    )
  }

  const activeCategories = categories
    .filter((x) => x.active)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))

  const replace = (s: AdminService) =>
    setData(data.map((x) => (x.id === s.id ? s : x)))

  const toggleActive = async (s: AdminService, active: boolean) => {
    replace({ ...s, active }) // แสดงผลทันที ย้อนกลับถ้าไม่สำเร็จ
    try {
      replace(await adminApi.updateService(s.id, { active }))
    } catch (e) {
      replace(s)
      toast(errorMessage(e), 'error')
    }
  }

  const save = async () => {
    if (!form || saving) return
    const price = Number(form.price)
    if (!form.name.trim()) return toast('กรุณากรอกชื่อบริการ', 'error')
    if (!Number.isInteger(price) || price < 1) return toast('กรุณากรอกราคาเป็นจำนวนเต็มบาท', 'error')
    const duration = form.durationMin.trim() === '' ? null : Number(form.durationMin)
    if (duration !== null && (!Number.isInteger(duration) || duration < 1)) return toast('ระยะเวลาต้องเป็นจำนวนนาทีเต็ม', 'error')
    if (!form.categoryId) {
      return toast('กรุณาเลือกหมวดหมู่บริการ', 'error')
    }

    const category = categories.find((x) => x.id === form.categoryId)
    if (!category) {
      return toast('ไม่พบหมวดหมู่บริการที่เลือก', 'error')
    }

    const body = {
      group: form.group,
      categoryId: form.categoryId,
      name: form.name.trim(),
      desc: form.desc.trim(),
      price,
      durationMin: duration,
      unlimited: form.unlimited,
      perQuestion: form.perQuestion,
      questions: form.questionsText.split('\n').map((q) => q.trim()).filter(Boolean),
      active: form.active,
      recommended: form.recommended,
    }
    setSaving(true)
    try {
      // API ใช้ชื่อฟิลด์ description (หน้าเว็บใช้ desc)
      const payload = { ...body, description: body.desc } as Record<string, unknown>
      delete payload.desc
      if (form.id) {
        replace(await adminApi.updateService(form.id, payload as never))
        toast('บันทึกบริการแล้ว', 'success')
      } else {
        const created = await adminApi.createService(payload as never)
        setData([...data, created])
        toast('เพิ่มบริการแล้ว', 'success')
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
      await adminApi.deleteService(del.id)
      setData(data.filter((x) => x.id !== del.id))
      toast('ลบบริการแล้ว', 'success')
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setDel(null)
    }
  }

  const set = (p: Partial<Form>) => setForm((f) => (f ? { ...f, ...p } : f))

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-mute">แก้ไขชื่อ ราคา และคำถามในเซ็ตได้ที่นี่ มีผลกับลูกค้าทันที</p>
        <button onClick={() => setForm(blank())} className="flex h-12 shrink-0 items-center gap-2 rounded-xl bg-gold px-4 text-sm font-semibold text-night"><Plus size={18} />เพิ่มบริการ</button>
      </div>

      <div className="grid gap-7">
        {activeCategories.map((category) => {
          const list = data.filter((s) => s.categoryId === category.id)
          if (list.length === 0) return null

          return (
            <section key={category.id}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="font-display text-base font-semibold">{category.label}</h2>
                {category.multi && (
                  <span className="rounded-full bg-gold/10 px-2 py-0.5 text-xs text-gold">
                    หลายรายการ
                  </span>
                )}
              </div>
              <ul className="grid gap-2 md:grid-cols-2">
                {list.map((s) => (
                  <li key={s.id} className={`flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 ${s.active ? '' : 'opacity-60'}`}>
                    <div className="min-w-0 flex-1">
                      <div className="break-words font-medium">{s.name}{s.recommended && <span className="ml-2 rounded-full bg-gold/10 px-2 py-0.5 text-xs text-gold">แนะนำ</span>}</div>
                      <div className="text-sm text-gold">{s.price} บาท{s.perQuestion ? '/ข้อ' : ''}{s.durationMin ? ` · ${s.durationMin} นาที` : ''}{s.unlimited ? ' · รอบ 22:30' : ''}</div>
                    </div>
                    <Toggle label={`เปิดใช้งาน ${s.name}`} checked={s.active} onChange={(v) => toggleActive(s, v)} />
                    <button aria-label={`แก้ไข ${s.name}`} onClick={() => setForm(fromService(s))} className="grid h-11 w-11 place-items-center rounded-xl bg-raised"><Pencil size={18} /></button>
                    <button aria-label={`ลบ ${s.name}`} onClick={() => setDel(s)} className="grid h-11 w-11 place-items-center rounded-xl bg-bad/15 text-bad"><Trash2 size={18} /></button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>

      <BottomSheet open={!!form} title={form?.id ? 'แก้ไขบริการ' : 'เพิ่มบริการ'} onClose={() => setForm(null)}>
        {form && (
          <div className="grid gap-3 text-sm">
            <label className="grid gap-1.5">
              หมวดหมู่บริการ
              <select
                className={input}
                value={form.categoryId}
                onChange={(e) => {
                  const categoryId = e.target.value
                  const selected = categories.find((x) => x.id === categoryId)

                  set({
                    categoryId,
                    // รักษา legacy group ให้ตรงกับ category เดิมเมื่อเป็นหมวดเก่า
                    group: (selected?.id ?? form.group) as ServiceGroup,
                  })
                }}
              >
                {categories
                  .filter((category) => category.active || category.id === form.categoryId)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
              </select>
            </label>
            <label className="grid gap-1.5">ชื่อบริการ<input className={input} value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} /></label>
            <label className="grid gap-1.5">รายละเอียดสั้น ๆ (ไม่บังคับ)<input className={input} value={form.desc} onChange={(e) => set({ desc: e.target.value })} maxLength={200} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5">ราคา (บาท)<input className={input} inputMode="numeric" value={form.price} onChange={(e) => set({ price: e.target.value.replace(/\D/g, '').slice(0, 6) })} /></label>
              <label className="grid gap-1.5">ระยะเวลา (นาที)<input className={input} inputMode="numeric" placeholder="ไม่ระบุ" value={form.durationMin} onChange={(e) => set({ durationMin: e.target.value.replace(/\D/g, '').slice(0, 3) })} /></label>
            </div>
            <label className="grid gap-1.5">คำถามในเซ็ต (บรรทัดละ 1 ข้อ ไม่บังคับ)
              <textarea rows={5} className="w-full resize-none rounded-xl border border-line bg-night p-3 text-ink focus:border-gold focus:outline-none" value={form.questionsText} onChange={(e) => set({ questionsText: e.target.value })} />
            </label>
            {([
              ['perQuestion', 'คิดราคาต่อข้อ (ลูกค้าระบุจำนวนคำถามเอง)'],
              ['unlimited', 'จองได้เฉพาะรอบ 22:30 (โทรไม่จำกัด)'],
              ['active', 'เปิดให้ลูกค้าเห็นและจอง'],
              ['recommended', '⭐ แนะนำบนหน้าแรก'],
            ] as const).map(([k, label]) => (
              <div key={k} className="flex items-center justify-between gap-3 rounded-xl bg-night/60 px-4 py-3">
                <span>{label}</span>
                <Toggle label={label} checked={form[k]} onChange={(v) => set({ [k]: v } as Partial<Form>)} />
              </div>
            ))}
            <button disabled={saving} onClick={save} className="mt-2 h-14 rounded-2xl bg-gold font-semibold text-night disabled:opacity-60">{saving ? 'กำลังบันทึก' : 'บันทึก'}</button>
          </div>
        )}
      </BottomSheet>

      <Modal open={!!del} danger title="ลบบริการนี้?" confirmLabel="ลบ" cancelLabel="ไม่ลบ" onCancel={() => setDel(null)} onConfirm={remove}>
        “{del?.name}” จะหายจากหน้าลูกค้าถาวร (การจองเก่าที่เคยจองบริการนี้ยังเห็นชื่อและราคาตามเดิม) ถ้าแค่อยากหยุดขายชั่วคราว ให้ใช้สวิตช์ปิดแทนการลบ
      </Modal>

      <AdminServiceCategories />
    </div>
  )
}
