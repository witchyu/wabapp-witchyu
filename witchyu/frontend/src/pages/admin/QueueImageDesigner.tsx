import { useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, Image as ImageIcon, Type, Palette, MoveVertical,
  MessageCircle, Phone, Eye, EyeOff, Download, Share2, Clock3,
} from 'lucide-react'
import { toPng } from 'html-to-image'

type QueueItem = {
  id: string
  time: string
  detail: string
  status: 'available' | 'full'
}

type QueueImageSettings = {
  heading?: string
  subtitle?: string
  background?: string
  useBackgroundImage?: boolean
  textColor?: string
  fontSize?: number
  verticalPosition?: number
  headingX?: number
  subtitleX?: number
  dateX?: number
  showText?: boolean
  showTimes?: boolean
  showCallQueue?: boolean
  aspectRatio?: string
  iconSize?: number
  iconX?: number
  iconY?: number
  backgroundZoom?: number
  backgroundX?: number
  backgroundY?: number
}

type Props = {
  date: string
  textTitle: string
  callTitle: string
  textEntries: QueueItem[]
  callEntries: QueueItem[]
  showCall: boolean
  initialSettings: QueueImageSettings
  onSaveSettings: (settings: Record<string, unknown>) => Promise<void>
  onBack: () => void
}

const backgrounds = [
  { name: 'ม่วงเข้ม', value: '#21143d' },
  { name: 'ดำ', value: '#171717' },
  { name: 'กรมท่า', value: '#14243d' },
  { name: 'ชมพู', value: '#592d50' },
  { name: 'ครีม', value: '#f3eadb' },
  { name: 'เขียว', value: '#173d35' },
]

export default function QueueImageDesigner({
  date,
  textTitle,
  callTitle,
  textEntries,
  callEntries,
  showCall,
  initialSettings,
  onSaveSettings,
  onBack,
}: Props) {

  const [heading, setHeading] = useState(initialSettings.heading ?? 'ตารางคิววันนี้')
  const [subtitle, setSubtitle] = useState(initialSettings.subtitle ?? 'เลือกเวลาที่สะดวกได้เลย')
  const [background, setBackground] = useState(initialSettings.background ?? '#21143d')
  const [useBackgroundImage, setUseBackgroundImage] = useState(initialSettings.useBackgroundImage ?? true)
  const [textColor, setTextColor] = useState(initialSettings.textColor ?? '#ffffff')
  const [fontSize, setFontSize] = useState(initialSettings.fontSize ?? 30)
  const [verticalPosition, setVerticalPosition] = useState(initialSettings.verticalPosition ?? 18)
  const [headingX, setHeadingX] = useState<number>(initialSettings.headingX ?? 0)
  const [subtitleX, setSubtitleX] = useState<number>(initialSettings.subtitleX ?? 0)
  const [dateX, setDateX] = useState<number>(initialSettings.dateX ?? 0)
  const [showText, setShowText] = useState<boolean>(initialSettings.showText ?? true)
  const [showTimes, setShowTimes] = useState<boolean>(initialSettings.showTimes ?? true)
  const [showCallQueue, setShowCallQueue] = useState<boolean>(initialSettings.showCallQueue ?? showCall)

  const [aspectRatio, setAspectRatio] = useState(initialSettings.aspectRatio ?? '9 / 16')
  const [iconSize, setIconSize] = useState(initialSettings.iconSize ?? 48)
  const [iconX, setIconX] = useState<number>(initialSettings.iconX ?? 50)
  const [iconY, setIconY] = useState<number>(initialSettings.iconY ?? 24)
  const [backgroundZoom, setBackgroundZoom] = useState(initialSettings.backgroundZoom ?? 100)
  const [backgroundX, setBackgroundX] = useState(initialSettings.backgroundX ?? 50)
  const [backgroundY, setBackgroundY] = useState(initialSettings.backgroundY ?? 50)
  const [draggingIcon, setDraggingIcon] = useState(false)

  const previewRef = useRef<HTMLDivElement | null>(null)

  const [saveStatus, setSaveStatus] = useState('')
  const [exportStatus, setExportStatus] = useState('')

  const createPreviewPng = async () => {
    if (!previewRef.current) throw new Error('ไม่พบภาพตัวอย่าง')
    return toPng(previewRef.current, { cacheBust: true, pixelRatio: 3 })
  }

  const downloadPng = async () => {
    try {
      setExportStatus('กำลังสร้าง PNG...')
      const dataUrl = await createPreviewPng()
      const link = document.createElement('a')
      link.download = `witchyu-queue-${date}.png`
      link.href = dataUrl
      link.click()
      setExportStatus('ดาวน์โหลดภาพแล้ว')
    } catch (error) {
      console.error('สร้างภาพ PNG ไม่สำเร็จ', error)
      setExportStatus('สร้างภาพไม่สำเร็จ กรุณาลองอีกครั้ง')
    }
  }

  const sharePng = async () => {
    try {
      setExportStatus('กำลังเตรียมภาพสำหรับแชร์...')
      const dataUrl = await createPreviewPng()
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], `witchyu-queue-${date}.png`, {
        type: 'image/png',
      })

      if (
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: heading || 'ตารางคิววันนี้',
        })
        setExportStatus('แชร์ภาพเรียบร้อย')
      } else {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.download = file.name
        link.href = url
        link.click()
        URL.revokeObjectURL(url)
        setExportStatus('อุปกรณ์ไม่รองรับแชร์ไฟล์โดยตรง จึงดาวน์โหลดภาพแทน')
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setExportStatus('ยกเลิกการแชร์แล้ว')
        return
      }
      console.error('แชร์ภาพไม่สำเร็จ', error)
      setExportStatus('แชร์ภาพไม่สำเร็จ กรุณาลองดาวน์โหลด PNG')
    }
  }

  const saveSettings = async () => {
    const settings = {
      heading,
      subtitle,
      background,
      useBackgroundImage,
      textColor,
      fontSize,
      verticalPosition,
      headingX,
      subtitleX,
      dateX,
      showText,
      showTimes,
      showCallQueue,
      aspectRatio,
      iconSize,
      iconX,
      iconY,
      backgroundZoom,
      backgroundX,
      backgroundY,
    }

    try {
      setSaveStatus('กำลังบันทึก...')
      await onSaveSettings(settings)
      setSaveStatus('บันทึกแล้ว')
    } catch (error) {
      console.error('บันทึกการออกแบบภาพคิวไม่สำเร็จ', error)
      setSaveStatus('บันทึกไม่สำเร็จ')
    }
  }

  const visibleTextCount = showText ? textEntries.length : 0
  const visibleCallCount =
    showCallQueue && showCall ? callEntries.length : 0
  const totalVisibleEntries = visibleTextCount + visibleCallCount

  // ใช้ไม่เกิน 2 คอลัมน์ เพื่อรักษาความอ่านง่าย
  const queueColumns = totalVisibleEntries > 8 ? 2 : 1

  // นับจำนวนแถวของคิวพิมพ์และคิวโทรรวมกัน

  // ย่อเนื้อหาเมื่อมีคิวมาก โดยไม่ซ่อนรายการ
  // ย่อการ์ดและตัวอักษรตามจำนวนคิวที่แสดงจริง
  const densityScale = Math.max(
    0.58,
    Math.min(0.82, 7 / Math.max(7, totalVisibleEntries))
  )
  const headingScale = Math.max(0.65, densityScale)

  const formattedDate = useMemo(() => {
    const [year, month, day] = date.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }, [date])

  const EntryList = ({
    title,
    entries,
    icon,
  }: {
    title: string
    entries: QueueItem[]
    icon: 'text' | 'call'
  }) => (
    <div
      className="rounded-2xl border border-white/15 bg-white/10"
      style={{ padding: `${10 * densityScale}px` }}
    >
      <div
        className="mb-2 flex items-center gap-2 font-normal"
        style={{ fontSize: `${14 * densityScale}px` }}
      >
        {icon === 'text'
          ? <MessageCircle size={14 * densityScale} />
          : <Phone size={14 * densityScale} />}
        {title}
      </div>
      {entries.length === 0 ? (
        <p className="text-sm opacity-65">ยังไม่มีคิว</p>
      ) : (
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${queueColumns}, minmax(0, 1fr))`,
            gap: `${6 * densityScale}px`,
          }}
        >
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex min-w-0 items-center justify-between gap-1 rounded-lg bg-black/15"
              style={{
                padding: `${5 * densityScale}px ${7 * densityScale}px`,
                minHeight: `${30 * densityScale}px`,
              }}
            >
              <div className="min-w-0">
                <span
                  className="font-normal leading-tight"
                  style={{ fontSize: `${Math.max(7, 17 * densityScale)}px` }}
                >
                  {showTimes && entry.time}
                </span>
                {entry.detail && (
                  <p
                    className="truncate font-normal leading-tight opacity-70"
                    style={{ fontSize: `${Math.max(6, 10 * densityScale)}px` }}
                  >
                    {entry.detail}
                  </p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full font-normal leading-tight ${
                  entry.status === 'available'
                    ? 'bg-emerald-400/20 text-emerald-200'
                    : 'bg-rose-400/20 text-rose-200'
                }`}
                style={{
                  padding: `${2 * densityScale}px ${5 * densityScale}px`,
                  fontSize: `${Math.max(6, 9 * densityScale)}px`,
                }}
              >
                {entry.status === 'available' ? 'ว่าง' : 'เต็ม'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="grid gap-4">
      <div className="sticky top-0 z-50 -mx-1 flex items-center gap-3 bg-night/95 px-1 py-2 backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-surface"
          aria-label="กลับหน้าจัดการคิว"
        >
          <ArrowLeft size={19} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold">ออกแบบภาพคิว</h1>
          <p className="text-xs text-mute">Queue Image Designer · Preview</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex flex-wrap justify-end gap-1">
            <button
              type="button"
              onClick={saveSettings}
              className="rounded-lg bg-gold px-2 py-2 text-[11px] font-semibold text-night shadow-md hover:brightness-110 active:scale-95"
            >
              บันทึก
            </button>
            <button
              type="button"
              onClick={downloadPng}
              className="flex items-center gap-1 rounded-lg border border-line bg-surface px-2 py-2 text-[11px] font-semibold hover:brightness-110 active:scale-95"
            >
              <Download size={13} /> PNG
            </button>
            <button
              type="button"
              onClick={sharePng}
              className="flex items-center gap-1 rounded-lg border border-line bg-surface px-2 py-2 text-[11px] font-semibold hover:brightness-110 active:scale-95"
            >
              <Share2 size={13} /> แชร์
            </button>
          </div>
          <span className="max-w-[210px] text-right text-[10px] text-mute" aria-live="polite">
            {[saveStatus, exportStatus].filter(Boolean).join(' · ')}
          </span>
        </div>
      </div>

      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
        <section className="grid min-w-0 gap-3 rounded-2xl border border-line bg-surface p-3 text-ink placeholder:text-mute md:sticky md:top-3 md:self-start">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ImageIcon size={17} />
              ตัวอย่างภาพประกาศ
            </div>
            <span className="text-xs text-mute">Preview 9:16</span>
          </div>

          <div className="mx-auto w-full max-w-[280px]">
            <div
              ref={previewRef}
              className="relative flex w-full flex-col overflow-hidden rounded-none p-5 shadow-xl transition-colors"
              style={{
                aspectRatio,
                backgroundColor: background,
                color: textColor,
                paddingTop: `${verticalPosition}%`,
                touchAction: draggingIcon ? 'none' : 'pan-y',
              }}
              onPointerMove={(event) => {
                if (!draggingIcon) return
                const rect = event.currentTarget.getBoundingClientRect()
                const halfWidth = (iconSize / 2 / rect.width) * 100
                const halfHeight = (iconSize / 2 / rect.height) * 100
                const nextX = ((event.clientX - rect.left) / rect.width) * 100
                const nextY = ((event.clientY - rect.top) / rect.height) * 100

                setIconX(Math.max(halfWidth, Math.min(100 - halfWidth, nextX)))
                setIconY(Math.max(halfHeight, Math.min(100 - halfHeight, nextY)))
              }}
              onPointerUp={() => setDraggingIcon(false)}
              onPointerCancel={() => setDraggingIcon(false)}
            >
              {useBackgroundImage && (
                <>
                  <img
                    src="/ubg.png"
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    className="pointer-events-none absolute"
                    style={{
                      width: `${backgroundZoom}%`,
                      maxWidth: 'none',
                      height: 'auto',
                      left: `${backgroundX}%`,
                      top: `${backgroundY}%`,
                      transform: `translate(-${backgroundX}%, -${backgroundY}%)`,
                    }}
                  />
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      backgroundImage:
                        'linear-gradient(rgba(15, 10, 25, 0.12), rgba(15, 10, 25, 0.18))',
                    }}
                  />
                </>
              )}
              <div
                role="button"
                tabIndex={0}
                aria-label="ลากเพื่อย้าย Icon"
                onPointerDown={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setDraggingIcon(true)
                  event.currentTarget.setPointerCapture(event.pointerId)
                }}
                onPointerUp={() => setDraggingIcon(false)}
                onPointerCancel={() => setDraggingIcon(false)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowLeft') setIconX((value: number) => Math.max(0, value - 1))
                  if (event.key === 'ArrowRight') setIconX((value: number) => Math.min(100, value + 1))
                  if (event.key === 'ArrowUp') setIconY((value: number) => Math.max(0, value - 1))
                  if (event.key === 'ArrowDown') setIconY((value: number) => Math.min(100, value + 1))
                }}
                className="absolute z-20 grid cursor-grab place-items-center overflow-hidden rounded-full border-0 bg-transparent p-0 shadow-none active:cursor-grabbing"
                style={{
                  left: `${iconX}%`,
                  top: `${iconY}%`,
                  transform: 'translate(-50%, -50%)',
                  width: `${iconSize}px`,
                  height: `${iconSize}px`,
                  maxWidth: '35%',
                  maxHeight: '35%',
                  touchAction: 'none',
                }}
              >
                <img
                  src="/icon.png"
                  alt="Icon บนภาพประกาศ"
                  draggable={false}
                  className="h-full w-full rounded-full object-contain"
                />
              </div>

              <div className="relative z-10 grid gap-1 text-center">
                <h2
                  className="relative break-words font-medium leading-tight"
                  style={{
                    fontSize: `${fontSize * headingScale}px`,
                    left: `${headingX}%`,
                  }}
                >
                  {heading}
                </h2>
                <p
                  className="relative text-sm leading-tight opacity-75"
                  style={{ left: `${subtitleX}%` }}
                >
                  {subtitle}
                </p>
                <p
                  className="relative text-xs leading-tight opacity-60"
                  style={{ left: `${dateX}%` }}
                >
                  {formattedDate}
                </p>
              </div>

              <div
                className="relative z-10 grid"
                style={{
                  marginTop: `${16 * densityScale}px`,
                  gap: `${10 * densityScale}px`,
                }}
              >
                {showText && (
                  <EntryList
                    title={textTitle}
                    entries={textEntries}
                    icon="text"
                  />
                )}
                {showCallQueue && showCall && (
                  <EntryList
                    title={callTitle}
                    entries={callEntries}
                    icon="call"
                  />
                )}
                {!showText && !(showCallQueue && showCall) && (
                  <p className="rounded-xl bg-white/10 p-4 text-center text-sm">
                    ยังไม่ได้เลือกหมวดคิวที่จะแสดง
                  </p>
                )}
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-mute">
            ตัวอย่างนี้ใช้ข้อมูลคิวของวันที่เลือกอยู่ในหน้าจัดการคิว
          </p>
        </section>

        <section className="grid min-w-0 gap-3 md:max-h-[calc(100dvh-110px)] md:overflow-y-auto md:overscroll-contain md:pr-1">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold">
              <Type size={18} />
              ข้อความบนภาพ
            </div>
            <label className="mb-3 grid gap-1.5 text-sm">
              อัตราส่วนภาพ
              <select
                value={aspectRatio}
                onChange={(event) => setAspectRatio(event.target.value)}
                className="h-11 rounded-xl border border-line bg-night px-3 text-ink"
              >
                <option value="9 / 16">9:16 · Instagram Story</option>
                <option value="1 / 1">1:1 · Square</option>
                <option value="16 / 9">16:9 · Landscape</option>
              </select>
            </label>
            <label className="mb-3 grid gap-1.5 text-sm">
              หัวข้อหลัก
              <input
                value={heading}
                maxLength={60}
                onChange={(event) => setHeading(event.target.value)}
                className="h-11 w-full rounded-xl border border-line bg-night px-3 text-ink placeholder:text-mute"
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              ข้อความรอง
              <input
                value={subtitle}
                maxLength={100}
                onChange={(event) => setSubtitle(event.target.value)}
                className="h-11 w-full rounded-xl border border-line bg-night px-3 text-ink placeholder:text-mute"
              />
            </label>
            <label className="mt-4 grid gap-2 text-sm">
              ขนาดหัวข้อ: {fontSize}px
              <input
                type="range"
                min="20"
                max="48"
                value={fontSize}
                onChange={(event) => setFontSize(Number(event.target.value))}
                className="w-full accent-gold"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold">
              <MoveVertical size={18} />
              ตำแหน่งข้อความแนวนอน
            </div>

            <label className="mb-4 grid gap-2 text-sm">
              หัวข้อหลัก: {headingX}%
              <input
                type="range"
                min="-30"
                max="30"
                value={headingX}
                onChange={(event) => setHeadingX(Number(event.target.value))}
                className="w-full accent-gold"
              />
            </label>

            <label className="mb-4 grid gap-2 text-sm">
              หัวข้อรอง: {subtitleX}%
              <input
                type="range"
                min="-30"
                max="30"
                value={subtitleX}
                onChange={(event) => setSubtitleX(Number(event.target.value))}
                className="w-full accent-gold"
              />
            </label>

            <label className="grid gap-2 text-sm">
              วัน / เดือน / ปี: {dateX}%
              <input
                type="range"
                min="-30"
                max="30"
                value={dateX}
                onChange={(event) => setDateX(Number(event.target.value))}
                className="w-full accent-gold"
              />
            </label>
            <p className="mt-2 text-xs text-mute">
              เลื่อนซ้ายหรือขวาเพื่อจัดตำแหน่งแต่ละข้อความแยกกัน
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold">
              <ImageIcon size={18} />
              Icon บนภาพ
            </div>
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-line bg-night/50 p-3">
              <img src="/icon.png" alt="ตัวอย่าง Icon" className="h-12 w-12 object-contain" />
              <div className="min-w-0 text-sm">
                <p className="font-medium">icon.png</p>
                <p className="text-xs text-mute">รูปภาพที่ใช้บนประกาศ</p>
              </div>
            </div>
            <label className="mt-3 grid gap-2 text-sm">
              ขนาด Icon: {iconSize}px
              <input type="range" min="16" max="100" value={iconSize}
                onChange={(event) => setIconSize(Number(event.target.value))}
                className="w-full accent-gold" />
            </label>
            <p className="mt-2 text-xs text-mute">ลากรูปบนภาพเพื่อเปลี่ยนตำแหน่งได้ โดยรูปจะรักษาสัดส่วนเดิม</p>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold">
              <Palette size={18} />
              สีของภาพ
            </div>
            <p className="mb-2 text-xs text-mute">พื้นหลังภาพ</p>
            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={() => setUseBackgroundImage(true)}
                aria-pressed={useBackgroundImage}
                className={`rounded-xl border px-3 py-2 text-xs ${
                  useBackgroundImage
                    ? 'border-gold bg-gold/15 text-gold'
                    : 'border-line'
                }`}
              >
                ใช้ภาพ ubg.png
              </button>
              <button
                type="button"
                onClick={() => setUseBackgroundImage(false)}
                aria-pressed={!useBackgroundImage}
                className={`rounded-xl border px-3 py-2 text-xs ${
                  !useBackgroundImage
                    ? 'border-gold bg-gold/15 text-gold'
                    : 'border-line'
                }`}
              >
                ใช้สีพื้นหลัง
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm">
                ซูมพื้นหลัง: {backgroundZoom}%
                <input type="range" min="100" max="220" value={backgroundZoom}
                  onChange={(event) => setBackgroundZoom(Number(event.target.value))}
                  className="w-full accent-gold" />
              </label>
              <label className="grid gap-2 text-sm">
                ตำแหน่งแนวนอน: {backgroundX}%
                <input type="range" min="0" max="100" value={backgroundX}
                  onChange={(event) => setBackgroundX(Number(event.target.value))}
                  className="w-full accent-gold" />
              </label>
              <label className="grid gap-2 text-sm">
                ตำแหน่งแนวตั้ง: {backgroundY}%
                <input type="range" min="0" max="100" value={backgroundY}
                  onChange={(event) => setBackgroundY(Number(event.target.value))}
                  className="w-full accent-gold" />
              </label>
            </div>
            <p className="mb-2 mt-4 text-xs text-mute">เลือกสีพื้นหลัง</p>
            <div className="flex flex-wrap gap-2">
              {backgrounds.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setBackground(item.value)
                    setUseBackgroundImage(false)
                  }}
                  aria-label={item.name}
                  aria-pressed={background === item.value}
                  className={`h-10 w-10 rounded-full border-2 ${
                    background === item.value
                      ? 'border-gold ring-2 ring-gold/30'
                      : 'border-white/20'
                  }`}
                  style={{ backgroundColor: item.value }}
                />
              ))}
            </div>
            <label className="mt-4 grid gap-2 text-sm">
              สีตัวอักษร
              <select
                value={textColor}
                onChange={(event) => setTextColor(event.target.value)}
                className="h-11 rounded-xl border border-line bg-night px-3 text-ink placeholder:text-mute"
              >
                <option value="#ffffff">สีขาว</option>
                <option value="#171717">สีดำ</option>
                <option value="#ffe7a3">สีทองอ่อน</option>
                <option value="#e9d5ff">สีม่วงอ่อน</option>
              </select>
            </label>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold">
              <MoveVertical size={18} />
              ตำแหน่งและข้อมูลคิว
            </div>
            <label className="grid gap-2 text-sm">
              ระยะห่างด้านบน: {verticalPosition}%
              <input
                type="range"
                min="8"
                max="30"
                value={verticalPosition}
                onChange={(event) => setVerticalPosition(Number(event.target.value))}
                className="w-full accent-gold"
              />
            </label>

            <div className="mt-4 grid gap-3">
              <button
                type="button"
                onClick={() => setShowText((value) => !value)}
                aria-pressed={showText}
                className="flex h-11 items-center justify-between rounded-xl border border-line px-3 text-sm"
              >
                <span className="flex items-center gap-2">
                  <MessageCircle size={17} /> แสดงคิวพิมพ์
                </span>
                {showText ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
              <button
                type="button"
                onClick={() => setShowTimes((value) => !value)}
                aria-pressed={showTimes}
                className="flex h-11 items-center justify-between rounded-xl border border-line px-3 text-sm"
              >
                <span className="flex items-center gap-2">
                  <Clock3 size={17} /> แสดงเวลา
                </span>
                {showTimes ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
              <button
                type="button"
                disabled={!showCall}
                onClick={() => setShowCallQueue((value) => !value)}
                aria-pressed={showCallQueue && showCall}
                className="flex h-11 items-center justify-between rounded-xl border border-line px-3 text-sm disabled:opacity-40"
              >
                <span className="flex items-center gap-2">
                  <Phone size={17} /> แสดงคิวโทร
                </span>
                {showCallQueue && showCall ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gold/20 bg-gold/5 p-3 text-xs leading-relaxed text-mute">
            Phase 6: ดาวน์โหลดภาพ PNG และแชร์ภาพประกาศ พร้อมคงการบันทึกการตั้งค่าแยกตามวันที่
          </div>
        </section>
      </div>
    </div>
  )
}
