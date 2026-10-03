import { MessageCircle } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { EmptyState } from '../components/states'

// Placeholder: แชตจริงด้วย Socket.IO จะทำใน Phase 5
export default function Chat() {
  return (
    <div>
      <PageHeader title="แชต" />
      <EmptyState icon={<MessageCircle size={28} />} title="แชตกับหมอดูจะเปิดใช้เร็ว ๆ นี้" text="ตอนนี้หน้านี้ยังเป็นตัวอย่าง (Placeholder) ระบบแชตจริงจะเพิ่มใน Phase 5" />
    </div>
  )
}
