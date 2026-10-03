import { useBooking } from '../../hooks/useBooking'

export default function StepNote() {
  const { draft, patchDraft } = useBooking()
  return (
    <label className="grid gap-2 text-sm">รายละเอียดเพิ่มเติม (ไม่บังคับ)
      <textarea
        value={draft.note}
        onChange={(e) => patchDraft({ note: e.target.value.slice(0, 500) })}
        rows={7}
        placeholder="พิมพ์สิ่งที่อยากแจ้งหมอดู เช่น คำถามที่อยากรู้ หรือเรื่องที่กังวล"
        className="w-full resize-none rounded-xl border border-line bg-surface p-4 text-ink placeholder:text-mute/60 focus:border-gold focus:outline-none"
      />
      <span className="text-right text-xs text-mute">{draft.note.length}/500</span>
    </label>
  )
}
