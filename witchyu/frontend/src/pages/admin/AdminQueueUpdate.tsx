import { useEffect, useState } from 'react'
import { adminApi, type ManualQueueSettingsPatch } from '../../services/adminApi'
import { errorMessage } from '../../services/api'
import QueueImageDesigner from './QueueImageDesigner'
import {
  CalendarDays, Clock3, MessageCircle, Phone, Plus, Pencil,
  Trash2, Check, X, CircleCheck, CircleX, Eye, EyeOff, Settings2,
} from 'lucide-react'

type QueueType = 'text' | 'call'

type QueueEntry = {
  id: string
  time: string
  detail: string
  status: 'available' | 'full'
}

type QueueDay = {
  text: QueueEntry[]
  call: QueueEntry[]
}

type QueueConfig = {
  title: string
  description: string
}

const todayISO = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const sortEntries = (entries: QueueEntry[]) =>
  [...entries].sort((a, b) => a.time.localeCompare(b.time))

const formatDate = (value: string) => {
  if (!value) return ''
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function QueueSection({
  type,
  config,
  onConfigChange,
  entries,
  onAdd,
  onUpdate,
  onDelete,
}: {
  type: QueueType
  config: QueueConfig
  onConfigChange: (patch: Partial<QueueConfig>) => void
  entries: QueueEntry[]
  onAdd: (time: string, detail: string) => Promise<void>
  onUpdate: (id: string, patch: Partial<QueueEntry>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [newTime, setNewTime] = useState('')
  const [newDetail, setNewDetail] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTime, setEditTime] = useState('')
  const [editDetail, setEditDetail] = useState('')

  const Icon = type === 'text' ? MessageCircle : Phone
  const fullCount = entries.filter((entry) => entry.status === 'full').length
  const allFull = entries.length > 0 && fullCount === entries.length

  const add = async () => {
    if (!newTime) {
      window.alert('กรุณาเลือกเวลา')
      return
    }
    if (entries.some((entry) => entry.time === newTime)) {
      window.alert('มีเวลานี้ในรายการแล้ว')
      return
    }
    await onAdd(newTime, newDetail.trim())
    setNewTime('')
    setNewDetail('')
  }

  const saveEdit = async (entry: QueueEntry) => {
    if (!editTime) return
    if (entries.some((item) => item.id !== entry.id && item.time === editTime)) {
      window.alert('มีเวลานี้ในรายการแล้ว')
      return
    }
    await onUpdate(entry.id, { time: editTime, detail: editDetail.trim() })
    setEditingId(null)
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex items-center gap-3 border-b border-line p-4">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gold/15 text-gold">
          <Icon size={21} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold">{config.title}</h2>
          <p className="text-xs text-mute">{config.description || 'ยังไม่มีรายละเอียด'}</p>
        </div>
        <span className="rounded-full bg-night px-3 text-ink placeholder:text-mute py-1 text-xs text-mute">
          {entries.length} เวลา
        </span>
      </div>

      <div className="grid gap-3 p-4">
        <details className="rounded-xl border border-line bg-night/50">
          <summary className="flex cursor-pointer items-center gap-2 p-3 text-sm font-medium">
            <Settings2 size={17} />
            แก้ไขชื่อและรายละเอียดของหมวดคิว
          </summary>
          <div className="grid gap-3 border-t border-line p-3">
            <label className="grid gap-1 text-sm">
              ชื่อหัวข้อ
              <input
                value={config.title}
                maxLength={60}
                onChange={(event) => onConfigChange({ title: event.target.value })}
                className="h-11 rounded-xl border border-line bg-surface px-3 text-ink placeholder:text-mute"
              />
            </label>
            <label className="grid gap-1 text-sm">
              รายละเอียดหมวดคิว
              <textarea
                value={config.description}
                maxLength={300}
                rows={3}
                onChange={(event) => onConfigChange({ description: event.target.value })}
                placeholder="กรอกรายละเอียดที่ต้องการแสดง..."
                className="rounded-xl border border-line bg-surface p-3 text-ink placeholder:text-mute"
              />
            </label>
          </div>
        </details>

        <div className="grid gap-2 rounded-xl bg-night/50 p-3">
          <label className="grid gap-1.5 text-sm">
            เวลา
            <input
              type="time"
              value={newTime}
              onChange={(event) => setNewTime(event.target.value)}
              className="h-11 rounded-xl border border-line bg-surface px-3 text-ink placeholder:text-mute"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            รายละเอียดของเวลานี้ (ไม่บังคับ)
            <input
              value={newDetail}
              maxLength={200}
              onChange={(event) => setNewDetail(event.target.value)}
              placeholder="เช่น รับ 1 คิว / รอบพิเศษ"
              className="h-11 rounded-xl border border-line bg-surface px-3 text-ink placeholder:text-mute"
            />
          </label>
          <button
            type="button"
            onClick={add}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-gold px-4 font-semibold text-white"
          >
            <Plus size={17} />
            เพิ่มเวลา
          </button>
        </div>

        {allFull && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-center">
            <CircleX size={25} className="mx-auto mb-1 text-rose-400" />
            <p className="font-semibold text-rose-400">คิวเต็ม</p>
            <p className="mt-1 text-xs text-rose-200/80">ทุกช่วงเวลาของหมวดนี้เต็มแล้ว</p>
          </div>
        )}

        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center">
            <Clock3 size={25} className="mx-auto mb-2 text-mute" />
            <p className="text-sm text-mute">ยังไม่มีเวลาคิวในวันนี้</p>
          </div>
        ) : (
          <ul className="grid gap-2">
            {sortEntries(entries).map((entry) => (
              <li key={entry.id} className="grid gap-2 rounded-xl border border-line bg-night/60 p-3">
                {editingId === entry.id ? (
                  <>
                    <label className="grid gap-1 text-sm">
                      เวลา
                      <input
                        type="time"
                        value={editTime}
                        onChange={(event) => setEditTime(event.target.value)}
                        className="h-10 rounded-lg border border-line bg-surface px-2"
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      รายละเอียด
                      <input
                        value={editDetail}
                        maxLength={200}
                        onChange={(event) => setEditDetail(event.target.value)}
                        placeholder="รายละเอียดของคิวนี้"
                        className="h-10 rounded-lg border border-line bg-surface px-3 text-ink placeholder:text-mute"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { void saveEdit(entry) }}
                        className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-gold text-white"
                      >
                        <Check size={16} />บันทึก
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="grid h-10 w-10 place-items-center rounded-lg bg-surface text-mute"
                      >
                        <X size={17} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex min-w-[75px] flex-1 items-center gap-2 font-display text-xl font-semibold">
                        <Clock3 size={17} className="text-mute" />
                        {entry.time}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdate(entry.id, {
                          status: entry.status === 'available' ? 'full' : 'available',
                        })}
                        className={`flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ${
                          entry.status === 'available'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-rose-500/15 text-rose-400'
                        }`}
                      >
                        {entry.status === 'available'
                          ? <><CircleCheck size={16} />ว่าง</>
                          : <><CircleX size={16} />เต็ม</>}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(entry.id)
                          setEditTime(entry.time)
                          setEditDetail(entry.detail)
                        }}
                        aria-label={`แก้ไขเวลา ${entry.time}`}
                        className="grid h-10 w-10 place-items-center rounded-lg bg-surface text-mute"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`ต้องการลบคิวเวลา ${entry.time} ใช่หรือไม่?`)) {
                            onDelete(entry.id)
                          }
                        }}
                        aria-label={`ลบเวลา ${entry.time}`}
                        className="grid h-10 w-10 place-items-center rounded-lg bg-bad/15 text-bad"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {entry.detail && (
                      <p className="border-t border-line pt-2 text-sm text-mute">
                        {entry.detail}
                      </p>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default function AdminQueueUpdate() {
  const [designerOpen, setDesignerOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(todayISO)
  const [textEntries, setTextEntries] = useState<QueueEntry[]>([])
  const [callEntries, setCallEntries] = useState<QueueEntry[]>([])
  const [showCall, setShowCall] = useState(true)
  const [configs, setConfigs] = useState<Record<QueueType, QueueConfig>>({
    text: {
      title: 'คิวพิมพ์',
      description: 'จัดการเวลาสำหรับบริการแบบพิมพ์แชต',
    },
    call: {
      title: 'คิวโทร',
      description: 'จัดการเวลาสำหรับบริการแบบโทร',
    },
  })
  const [loading, setLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // โหลดข้อมูลใหม่เมื่อเปลี่ยนวันที่ พร้อมป้องกัน response เก่าทับข้อมูลวันใหม่
  useEffect(() => {
    let active = true

    const load = async () => {
      setLoading(true)
      setError('')
      setNotice('')

      try {
        const result = await adminApi.manualQueue(selectedDate)
        if (!active) return

        const entries = result.day.entries
        setTextEntries(entries
          .filter((entry) => entry.type === 'text')
          .map(({ id, time, detail, status }) => ({ id, time, detail, status })))
        setCallEntries(entries
          .filter((entry) => entry.type === 'call')
          .map(({ id, time, detail, status }) => ({ id, time, detail, status })))

        setConfigs({
          text: {
            title: result.settings.textTitle,
            description: result.settings.textDescription,
          },
          call: {
            title: result.settings.callTitle,
            description: result.settings.callDescription,
          },
        })
        setShowCall(result.settings.showCall)
      } catch (e) {
        if (active) setError(errorMessage(e))
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => { active = false }
  }, [selectedDate])

  const updateConfig = (type: QueueType, patch: Partial<QueueConfig>) => {
    setConfigs((current) => ({
      ...current,
      [type]: { ...current[type], ...patch },
    }))
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    setError('')
    setNotice('')

    const patch: ManualQueueSettingsPatch = {
      textTitle: configs.text.title.trim(),
      textDescription: configs.text.description.trim(),
      callTitle: configs.call.title.trim(),
      callDescription: configs.call.description.trim(),
      showCall,
    }

    try {
      const saved = await adminApi.updateManualQueueSettings(patch)
      setConfigs({
        text: {
          title: saved.textTitle,
          description: saved.textDescription,
        },
        call: {
          title: saved.callTitle,
          description: saved.callDescription,
        },
      })
      setShowCall(saved.showCall)
      setNotice('บันทึกการตั้งค่าคิวเรียบร้อยแล้ว')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSavingSettings(false)
    }
  }

  const addEntry = async (type: QueueType, time: string, detail: string) => {
    setError('')
    setNotice('')

    try {
      const entry = await adminApi.createManualQueueEntry({
        date: selectedDate,
        type,
        time,
        detail,
      })
      const item: QueueEntry = {
        id: entry.id,
        time: entry.time,
        detail: entry.detail,
        status: entry.status,
      }

      if (type === 'text') {
        setTextEntries((current) => sortEntries([...current, item]))
      } else {
        setCallEntries((current) => sortEntries([...current, item]))
      }
      setNotice('เพิ่มเวลาคิวเรียบร้อยแล้ว')
    } catch (e) {
      setError(errorMessage(e))
      throw e
    }
  }

  const updateEntry = async (
    type: QueueType,
    id: string,
    patch: Partial<QueueEntry>,
  ) => {
    setError('')
    setNotice('')

    try {
      const entry = await adminApi.updateManualQueueEntry(id, selectedDate, patch)
      const updated: QueueEntry = {
        id: entry.id,
        time: entry.time,
        detail: entry.detail,
        status: entry.status,
      }

      const setter = type === 'text' ? setTextEntries : setCallEntries
      setter((current) =>
        sortEntries(current.map((item) => item.id === id ? updated : item)),
      )
      setNotice('บันทึกการแก้ไขคิวเรียบร้อยแล้ว')
    } catch (e) {
      setError(errorMessage(e))
      throw e
    }
  }

  const deleteEntry = async (type: QueueType, id: string) => {
    setError('')
    setNotice('')

    try {
      await adminApi.deleteManualQueueEntry(id)
      const setter = type === 'text' ? setTextEntries : setCallEntries
      setter((current) => current.filter((item) => item.id !== id))
      setNotice('ลบคิวเรียบร้อยแล้ว')
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const currentDay: QueueDay = {
    text: textEntries,
    call: callEntries,
  }

  const visibleEntries = [
    ...currentDay.text,
    ...(showCall ? currentDay.call : []),
  ]
  const total = visibleEntries.length
  const full = visibleEntries.filter((entry) => entry.status === 'full').length
  const allVisibleFull = total > 0 && full === total

  if (designerOpen) {
    return (
      <QueueImageDesigner
        date={selectedDate}
        textTitle={configs.text.title}
        callTitle={configs.call.title}
        textEntries={textEntries}
        callEntries={callEntries}
        showCall={showCall}
        onBack={() => setDesignerOpen(false)}
      />
    )
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gold/15 text-gold">
            <CalendarDays size={22} />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold">อัพเดทคิว</h1>
            <p className="text-sm text-mute">จัดการตารางคิวด้วยตนเอง</p>
          </div>
        </div>

        <label className="grid w-full gap-1.5 text-sm">
          เลือกวันที่
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="h-12 rounded-xl border border-line bg-night px-3 text-ink placeholder:text-mute"
          />
        </label>
        <p className="mt-3 text-sm font-medium text-mute">{formatDate(selectedDate)}</p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-night p-3 text-center">
            <div className="font-display text-2xl font-semibold">{total}</div>
            <div className="text-xs text-mute">คิวทั้งหมด</div>
          </div>
          <div className="rounded-xl bg-night p-3 text-center">
            <div className="font-display text-2xl font-semibold text-emerald-400">{total - full}</div>
            <div className="text-xs text-mute">คิวว่าง</div>
          </div>
          <div className="rounded-xl bg-night p-3 text-center">
            <div className="font-display text-2xl font-semibold text-rose-400">{full}</div>
            <div className="text-xs text-mute">คิวเต็ม</div>
          </div>
        </div>

        {allVisibleFull && (
          <div className="mt-3 rounded-xl bg-rose-500/10 p-3 text-center font-semibold text-rose-400">
            คิวเต็ม — ทุกช่วงเวลาที่แสดงเต็มหมดแล้ว
          </div>
        )}
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          {notice}
        </div>
      )}

      <section className="rounded-xl border border-line bg-surface p-3 text-ink placeholder:text-mute">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <strong>ออกแบบภาพประกาศคิว</strong>
            <p className="mt-1 text-xs text-mute">
              สร้างภาพประกาศจากข้อมูลคิวของวันที่เลือก
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => setDesignerOpen(true)}
            className="rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            ออกแบบภาพคิว
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-3 text-ink placeholder:text-mute">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <strong>การตั้งค่าคิว</strong>
            <p className="mt-1 text-xs text-mute">
              ข้อมูลคิวแยกจากระบบจองจริง และไม่เปลี่ยนสถานะรอบจอง
            </p>
          </div>
          <button
            type="button"
            disabled={savingSettings || loading}
            onClick={() => void saveSettings()}
            className="rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {savingSettings ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
          </button>
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-mute">
          กำลังโหลดข้อมูลคิว...
        </div>
      ) : (
        <>
          <QueueSection
            type="text"
            config={configs.text}
            onConfigChange={(patch) => updateConfig('text', patch)}
            entries={currentDay.text}
            onAdd={(time, detail) => addEntry('text', time, detail)}
            onUpdate={(id, patch) => updateEntry('text', id, patch)}
            onDelete={(id) => deleteEntry('text', id)}
          />

          <section className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-gold/15 text-gold">
                  <Phone size={21} />
                </div>
                <div>
                  <h2 className="font-semibold">การแสดงคิวโทร</h2>
                  <p className="text-xs text-mute">เลือกได้ว่าจะแสดงหมวดคิวโทรหรือไม่</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCall((value) => !value)}
                aria-pressed={showCall}
                className={`flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold ${
                  showCall ? 'bg-emerald-500/15 text-emerald-400' : 'bg-surface text-mute'
                }`}
              >
                {showCall ? <><Eye size={16} />เปิดแสดง</> : <><EyeOff size={16} />ปิดแสดง</>}
              </button>
            </div>
          </section>

          {showCall && (
            <QueueSection
              type="call"
              config={configs.call}
              onConfigChange={(patch) => updateConfig('call', patch)}
              entries={currentDay.call}
              onAdd={(time, detail) => addEntry('call', time, detail)}
              onUpdate={(id, patch) => updateEntry('call', id, patch)}
              onDelete={(id) => deleteEntry('call', id)}
            />
          )}
        </>
      )}
    </div>
  )
}
