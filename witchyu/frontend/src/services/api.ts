import { getClientId } from './clientId'
import { getCustomerToken } from './customerToken'

// เว้นว่าง = เรียก /api บนโดเมนเดียวกัน (Vite dev proxy ส่งต่อไป backend) / Production ตั้ง VITE_API_URL เป็น URL ของ backend
const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export const errorMessage = (e: unknown) => (e instanceof ApiError ? e.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function once<T>(method: string, path: string, body?: unknown, extra?: Record<string, string>): Promise<T> {
  const ctrl = new AbortController()
  // เผื่อเซิร์ฟเวอร์ฟรีที่เพิ่งตื่นจากการพัก (อาจช้าเกือบนาที)
  const timer = setTimeout(() => ctrl.abort(), 60000)
  let res: Response
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': getClientId(),
        ...(getCustomerToken() && !['/auth/login', '/auth/register'].includes(path)
          ? { Authorization: `Bearer ${getCustomerToken()}` }
          : {}),
        ...extra,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    })
  } catch {
    throw new ApiError(0, 'NETWORK', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง')
  } finally {
    clearTimeout(timer)
  }
  let data: unknown = null
  try { data = await res.json() } catch { /* ไม่มีเนื้อหา */ }
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error
    throw new ApiError(res.status, err?.code ?? `HTTP_${res.status}`, err?.message ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
  }
  return data as T
}

// GET ลองซ้ำ 1 ครั้งเมื่อเครือข่ายสะดุด/ฐานข้อมูลกำลังตื่น (การเขียนข้อมูลไม่ลองซ้ำเอง กันทำรายการซ้ำ)
async function get<T>(path: string, extra?: Record<string, string>): Promise<T> {
  try {
    return await once<T>('GET', path, undefined, extra)
  } catch (e) {
    if (e instanceof ApiError && (e.status === 0 || e.status === 503)) {
      await sleep(1200)
      return once<T>('GET', path, undefined, extra)
    }
    throw e
  }
}

async function getBlob(path: string): Promise<Blob> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 60000)

  try {
    const res = await fetch(`${BASE}/api${path}`, {
      method: 'GET',
      headers: {
        'X-Client-Id': getClientId(),
        ...(getCustomerToken() ? { Authorization: `Bearer ${getCustomerToken()}` } : {}),
      },
      signal: ctrl.signal,
    })

    if (!res.ok) {
      let data: unknown = null
      try { data = await res.json() } catch {}
      const err = (data as { error?: { code?: string; message?: string } } | null)?.error
      throw new ApiError(
        res.status,
        err?.code ?? `HTTP_${res.status}`,
        err?.message ?? 'ไม่สามารถโหลดรูปสลิปได้',
      )
    }

    return await res.blob()
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw new ApiError(0, 'NETWORK', 'เชื่อมต่อเซิร์ฟเวอร์เพื่อโหลดรูปสลิปไม่ได้')
  } finally {
    clearTimeout(timer)
  }
}


async function upload<T>(path: string, file: File): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 60000)
  const form = new FormData()
  form.append('slip', file)

  try {
    const res = await fetch(`${BASE}/api${path}`, {
      method: 'POST',
      headers: {
        'X-Client-Id': getClientId(),
        ...(getCustomerToken() ? { Authorization: `Bearer ${getCustomerToken()}` } : {}),
      },
      body: form,
      signal: ctrl.signal,
    })
    let data: unknown = null
    try { data = await res.json() } catch {}
    if (!res.ok) {
      const err = (data as { error?: { code?: string; message?: string } } | null)?.error
      throw new ApiError(res.status, err?.code ?? `HTTP_${res.status}`, err?.message ?? 'อัปโหลดไม่สำเร็จ')
    }
    return data as T
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw new ApiError(0, 'NETWORK', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองอีกครั้ง')
  } finally {
    clearTimeout(timer)
  }
}

export const api = {
  upload,
  get,
  getBlob,
  post: <T>(path: string, body?: unknown, extra?: Record<string, string>) => once<T>('POST', path, body ?? {}, extra),
  patch: <T>(path: string, body: unknown, extra?: Record<string, string>) => once<T>('PATCH', path, body, extra),
  put: <T>(path: string, body: unknown, extra?: Record<string, string>) => once<T>('PUT', path, body, extra),
  del: <T>(path: string, extra?: Record<string, string>) => once<T>('DELETE', path, undefined, extra),
}
