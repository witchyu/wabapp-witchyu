import { useNavigate } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import { EmptyState } from '../components/states'

export default function NotFound() {
  const nav = useNavigate()
  return <EmptyState icon={<SearchX size={28} />} title="ไม่พบหน้านี้" text="ลิงก์อาจไม่ถูกต้อง" action={<button onClick={() => nav('/')} className="h-12 rounded-2xl bg-gold px-8 font-semibold text-night">กลับหน้าแรก</button>} />
}
