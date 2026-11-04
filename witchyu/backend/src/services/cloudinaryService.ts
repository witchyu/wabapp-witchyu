import { v2 as cloudinary } from 'cloudinary'
import { randomUUID } from 'node:crypto'
import { AppError } from '../domain/errors'

const FOLDER = 'witchyu/payment-proofs'
const URL_TTL_SECONDS = 5 * 60

let configured = false

function configureCloudinary() {
  if (configured) return

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim()
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim()
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim()

  if (!cloudName || !apiKey || !apiSecret) {
    throw new AppError(
      503,
      'CLOUDINARY_NOT_CONFIGURED',
      'ระบบจัดเก็บสลิปยังไม่ได้ตั้งค่า Cloudinary',
    )
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  })

  configured = true
}

export async function uploadPrivatePaymentProof(
  buffer: Buffer,
  bookingId: string,
  mimeType: string,
) {
  configureCloudinary()

  const publicId = `${FOLDER}/${bookingId}/${randomUUID()}`

  return new Promise<{
    publicId: string
    resourceType: string
    deliveryType: string
    format: string
    bytes: number
  }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: 'image',
        type: 'authenticated',
        format: mimeType === 'image/jpeg'
          ? 'jpg'
          : mimeType === 'image/png'
            ? 'png'
            : 'webp',
        overwrite: false,
        unique_filename: false,
        use_filename: false,
        tags: ['witchyu-payment-proof'],
      },
      (error, result) => {
        if (error || !result) {
          const cloudinaryError = error as {
            name?: string
            message?: string
            http_code?: number
          } | null

          console.error('[Cloudinary] Upload failed:', {
            name: cloudinaryError?.name ?? 'UnknownError',
            http_code: cloudinaryError?.http_code ?? null,
            message: cloudinaryError?.message ?? 'No error details',
          })

          reject(new AppError(
            502,
            'CLOUDINARY_UPLOAD_FAILED',
            'ไม่สามารถจัดเก็บสลิปได้ กรุณาลองใหม่อีกครั้ง',
          ))
          return
        }

        resolve({
          publicId: result.public_id,
          resourceType: result.resource_type,
          deliveryType: result.type,
          format: result.format,
          bytes: result.bytes,
        })
      },
    )

    stream.end(buffer)
  })
}

export async function getPrivatePaymentProofUrl(
  publicId: string,
  mimeType: string,
  resourceType = 'image',
  deliveryType = 'authenticated',
) {
  configureCloudinary()

  const format = mimeType === 'image/jpeg'
    ? 'jpg'
    : mimeType === 'image/png'
      ? 'png'
      : mimeType === 'image/webp'
        ? 'webp'
        : null

  if (
    !format ||
    resourceType !== 'image' ||
    deliveryType !== 'authenticated'
  ) {
    throw new AppError(500, 'INVALID_PROOF_STORAGE', 'ข้อมูลไฟล์สลิปไม่ถูกต้อง')
  }

  return cloudinary.utils.private_download_url(
    publicId,
    format,
    {
      resource_type: 'image',
      type: 'authenticated',
      expires_at: Math.floor(Date.now() / 1000) + URL_TTL_SECONDS,
      attachment: false,
    },
  )
}


export async function downloadPrivatePaymentProof(
  publicId: string,
  mimeType: string,
  resourceType = 'image',
  deliveryType = 'authenticated',
) {
  const url = await getPrivatePaymentProofUrl(
    publicId,
    mimeType,
    resourceType,
    deliveryType,
  )

  let response: Response

  try {
    response = await fetch(url, { signal: AbortSignal.timeout(15000) })
  } catch {
    throw new AppError(
      502,
      'CLOUDINARY_DOWNLOAD_FAILED',
      'ไม่สามารถอ่านไฟล์สลิปจากระบบจัดเก็บได้',
    )
  }

  if (!response.ok) {
    throw new AppError(
      502,
      'CLOUDINARY_DOWNLOAD_FAILED',
      'ไม่สามารถอ่านไฟล์สลิปจากระบบจัดเก็บได้',
    )
  }

  const buffer = Buffer.from(await response.arrayBuffer())

  if (buffer.length === 0 || buffer.length > 2 * 1024 * 1024) {
    throw new AppError(
      502,
      'INVALID_STORED_PROOF',
      'ไฟล์สลิปที่จัดเก็บไม่ถูกต้อง',
    )
  }

  return buffer
}

export async function deletePrivatePaymentProof(
  publicId: string,
  resourceType = 'image',
) {
  configureCloudinary()

  if (resourceType !== 'image') {
    throw new AppError(500, 'INVALID_PROOF_STORAGE', 'ประเภทไฟล์ Cloudinary ไม่ถูกต้อง')
  }

  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: 'image',
    type: 'authenticated',
    invalidate: true,
  })

  if (result.result !== 'ok' && result.result !== 'not found') {
    throw new AppError(
      502,
      'CLOUDINARY_DELETE_FAILED',
      'ไม่สามารถลบไฟล์สลิปจาก Cloudinary ได้',
    )
  }

  return { ok: true }
}
