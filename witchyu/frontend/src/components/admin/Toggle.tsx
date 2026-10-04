// สวิตช์เปิด/ปิด (Toggle Switch) — ใช้กับปุ่มเปิด-ปิดทั้งหมดของ Admin
interface Props { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }

export default function Toggle({ checked, onChange, label, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-gold' : 'bg-line'}`}
    >
      <span className={`absolute top-1 h-6 w-6 rounded-full bg-ink shadow transition-all ${checked ? 'left-7' : 'left-1'}`} />
    </button>
  )
}
