import type { BookingStatus } from '../types'
import { STATUS_LABEL } from '../utils/format'

const TONE: Record<BookingStatus, string> = {
  pending_payment: 'bg-warn/15 text-warn',
  confirmed: 'bg-ok/15 text-ok',
  completed: 'bg-mute/15 text-mute',
  cancelled: 'bg-bad/15 text-bad',
}

export default function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${TONE[status]}`}>{STATUS_LABEL[status]}</span>
}
