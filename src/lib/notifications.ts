import { prisma } from '@/lib/prisma'

type NotificationType = 'info' | 'success' | 'warning' | 'error'

interface CreateNotificationParams {
  org_id: string
  user_id: string
  title: string
  message: string
  type?: NotificationType
  link?: string
}

export async function createNotification(params: CreateNotificationParams) {
  return prisma.notification.create({
    data: {
      org_id: params.org_id,
      user_id: params.user_id,
      title: params.title,
      message: params.message,
      type: params.type ?? 'info',
      link: params.link,
    },
  })
}

// Create notification for all HR admins in an org
export async function notifyHRAdmins(
  org_id: string,
  title: string,
  message: string,
  type: NotificationType = 'info',
  link?: string
) {
  const hrAdmins = await prisma.user.findMany({
    where: { org_id, role: 'hr_admin', is_active: true },
    select: { id: true },
  })

  await prisma.notification.createMany({
    data: hrAdmins.map((admin: { id: any }) => ({
      org_id,
      user_id: admin.id,
      title,
      message,
      type,
      link,
    })),
  })
}

// Create notification for a manager
export async function notifyManager(
  org_id: string,
  manager_id: string,
  title: string,
  message: string,
  type: NotificationType = 'info',
  link?: string
) {
  return prisma.notification.create({
    data: {
      org_id,
      user_id: manager_id,
      title,
      message,
      type,
      link,
    },
  })
}