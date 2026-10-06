import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ChatView from '../../components/chat/ChatView'
import Modal from '../../components/Modal'
import type { ChatMessage } from '../../types/chat'
import { CustomerAvatar } from './AdminChats'
import { useConversation } from '../../hooks/useConversation'
import { adminApi } from '../../services/adminApi'
import { dateShort } from '../../utils/format'

export default function AdminChatRoom() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const fetchPage = useCallback((before?: string) => adminApi.chatHistory(id, before), [id])
  const sendApi = useCallback((body: string, clientMsgId: string) => adminApi.chatSend(id, body, clientMsgId), [id])
  const conv = useConversation({ role: 'admin', bookingId: id, fetchPage, sendApi })
  const b = conv.booking
  const [askDelete, setAskDelete] = useState<ChatMessage | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const deleteMessage = async () => {
    if (!askDelete || deleting) return
    setDeleting(true)
    setDeleteError('')

    try {
      await adminApi.chatDeleteMessage(id, askDelete.id)
      setAskDelete(null)
      conv.reload()
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'ลบข้อความไม่สำเร็จ')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <ChatView
        role="admin"
        conv={conv}
        title={b ? `${b.customer.nickname} (${b.customer.fullName})` : 'แชต'}
        subtitle={b ? `${b.serviceName} · ${dateShort(b.date)} ${b.time}` : undefined}
        avatar={<CustomerAvatar name={b?.customer.nickname ?? ''} />}
        onBack={() => nav('/admin/chat')}
        onDeleteMessage={(message) => setAskDelete(message)}
      />

      <Modal
        open={!!askDelete}
        danger
        title="ลบข้อความถาวร?"
        confirmLabel={deleting ? 'กำลังลบ…' : 'ลบข้อความ'}
        cancelLabel="ยกเลิก"
        onCancel={() => {
          if (!deleting) {
            setAskDelete(null)
            setDeleteError('')
          }
        }}
        onConfirm={deleteMessage}
      >
        <p>ข้อความนี้จะถูกลบออกจากระบบถาวร และไม่สามารถกู้คืนได้</p>
        {askDelete && (
          <p className="mt-2 rounded-xl bg-raised p-3 text-sm text-mute break-words">
            {askDelete.body}
          </p>
        )}
        {deleteError && (
          <p className="mt-2 text-sm text-bad">{deleteError}</p>
        )}
      </Modal>
    </>
  )
}
