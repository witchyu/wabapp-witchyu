import { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { AppError } from '../domain/errors'

const isCode = (error: unknown, code: string) =>
  (error as { code?: string })?.code === code

const notFound = () =>
  new AppError(404, 'QUEUE_ENTRY_NOT_FOUND', 'ไม่พบช่วงเวลาคิวนี้')

const conflict = () =>
  new AppError(409, 'QUEUE_TIME_EXISTS', 'มีเวลานี้ในหมวดคิวแล้ว')

const defaultSettings = {
  id: 1,
  textTitle: 'คิวพิมพ์',
  textDescription: 'จัดการเวลาสำหรับบริการแบบพิมพ์แชต',
  callTitle: 'คิวโทร',
  callDescription: 'จัดการเวลาสำหรับบริการแบบโทร',
  showCall: true,
  imageDesigns: {},
}

export async function getManualQueue(date: string) {
  const [settings, entries] = await Promise.all([
    prisma.manualQueueSetting.findUnique({ where: { id: 1 } }),
    prisma.manualQueueEntry.findMany({
      include: {
        statuses: {
          where: { date },
          select: { status: true },
        },
      },
      orderBy: [{ time: 'asc' }, { type: 'asc' }],
    }),
  ])

  return {
    date,
    settings: {
      ...(settings ?? defaultSettings),
      imageDesigns: settings?.imageDesigns ?? {},
    },
    day: {
      id: null,
      date,
      entries: entries.map(({ statuses, ...entry }) => ({
        ...entry,
        status: statuses[0]?.status ?? 'available',
      })),
    },
  }
}

export async function updateManualQueueSettings(
  patch: Prisma.ManualQueueSettingUpdateInput,
) {
  return prisma.manualQueueSetting.upsert({
    where: { id: 1 },
    update: patch,
    create: {
      id: 1,
      textTitle: typeof patch.textTitle === 'string'
        ? patch.textTitle : defaultSettings.textTitle,
      textDescription: typeof patch.textDescription === 'string'
        ? patch.textDescription : defaultSettings.textDescription,
      callTitle: typeof patch.callTitle === 'string'
        ? patch.callTitle : defaultSettings.callTitle,
      callDescription: typeof patch.callDescription === 'string'
        ? patch.callDescription : defaultSettings.callDescription,
      showCall: typeof patch.showCall === 'boolean'
        ? patch.showCall : defaultSettings.showCall,
      ...(patch.imageDesigns !== undefined
        ? { imageDesigns: patch.imageDesigns }
        : {}),
    },
  })
}

export async function createManualQueueEntry(input: {
  date: string
  type: 'text' | 'call'
  time: string
  detail: string
}) {
  try {
    const entry = await prisma.manualQueueEntry.create({
      data: {
        type: input.type,
        time: input.time,
        detail: input.detail,
      },
    })
    return { ...entry, status: 'available' as const }
  } catch (error) {
    if (isCode(error, 'P2002')) throw conflict()
    throw error
  }
}

export async function updateManualQueueEntry(
  id: string,
  date: string,
  patch: {
    time?: string
    detail?: string
    status?: 'available' | 'full'
  },
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const { status, ...entryPatch } = patch

      let entry
      if (Object.keys(entryPatch).length > 0) {
        entry = await tx.manualQueueEntry.update({
          where: { id },
          data: entryPatch,
        })
      } else {
        entry = await tx.manualQueueEntry.findUnique({ where: { id } })
        if (!entry) throw notFound()
      }

      if (status !== undefined) {
        await tx.manualQueueEntryStatus.upsert({
          where: {
            entryId_date: { entryId: id, date },
          },
          update: { status },
          create: { entryId: id, date, status },
        })
      }

      const dateStatus = await tx.manualQueueEntryStatus.findUnique({
        where: { entryId_date: { entryId: id, date } },
        select: { status: true },
      })

      return { ...entry, status: dateStatus?.status ?? 'available' }
    })
  } catch (error) {
    if (error instanceof AppError) throw error
    if (isCode(error, 'P2025')) throw notFound()
    if (isCode(error, 'P2002')) throw conflict()
    throw error
  }
}

export async function deleteManualQueueEntry(id: string) {
  try {
    await prisma.manualQueueEntry.delete({ where: { id } })
  } catch (error) {
    if (isCode(error, 'P2025')) throw notFound()
    throw error
  }
}
