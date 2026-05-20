import { prisma } from '@/lib/prisma'

type NotificationType = 'info' | 'success' | 'warning' | 'error' | string

interface CreateNotificationParams {
  org_id:   string
  user_id:  string
  title:    string
  message:  string
  type?:    NotificationType
  link?:    string
}

export async function createNotification(params: CreateNotificationParams) {
  return prisma.notification.create({
    data: {
      org_id:   params.org_id,
      user_id:  params.user_id,
      title:    params.title,
      message:  params.message,
      type:     params.type ?? 'info',
      link:     params.link,
    },
  })
}

/** Notify all active HR admin users in an org. */
export async function notifyHRAdmins(
  org_id:  string,
  title:   string,
  message: string,
  type:    NotificationType = 'info',
  link?:   string
) {
  const hrAdmins = await prisma.user.findMany({
    where: { org_id, role: 'hr_admin', is_active: true },
    select: { id: true },
  })

  if (hrAdmins.length === 0) return

  await prisma.notification.createMany({
    data: hrAdmins.map((admin) => ({
      org_id,
      user_id: admin.id,
      title,
      message,
      type,
      link,
    })),
    skipDuplicates: true,
  })
}

/** Notify a specific user (manager) by their User.id. */
export async function notifyManager(
  org_id:     string,
  manager_id: string,   // User.id of the manager
  title:      string,
  message:    string,
  type:       NotificationType = 'info',
  link?:      string
) {
  return prisma.notification.create({
    data: { org_id, user_id: manager_id, title, message, type, link },
  })
}

/**
 * Notify the direct manager of an employee (looked up by employee_id).
 * Falls back to HR admins when the employee has no manager.
 */
export async function notifyEmployeeManager(
  org_id:      string,
  employee_id: string,
  title:       string,
  message:     string,
  type:        NotificationType = 'info',
  link?:       string
): Promise<void> {
  const employee = await prisma.employee.findFirst({
    where: { id: employee_id, org_id },
    select: { manager_id: true },
  })

  if (!employee?.manager_id) {
    return notifyHRAdmins(org_id, title, message, type, link)
  }

  // manager_id on Employee is the Employee.id of the manager, not a User.id
  const managerUser = await prisma.user.findFirst({
    where: { org_id, employee_id: employee.manager_id, is_active: true },
    select: { id: true },
  })

  if (!managerUser) {
    return notifyHRAdmins(org_id, title, message, type, link)
  }

  await prisma.notification.create({
    data: { org_id, user_id: managerUser.id, title, message, type, link },
  })
}

/**
 * Deduplication guard — returns true if a notification of the given type
 * containing `messageFragment` was already sent within the last N minutes.
 */
export async function wasRecentlyNotified(
  org_id:          string,
  type:            string,
  messageFragment: string,
  withinMinutes:   number = 60
): Promise<boolean> {
  const since = new Date(Date.now() - withinMinutes * 60_000)
  const existing = await prisma.notification.findFirst({
    where: {
      org_id,
      type,
      message:    { contains: messageFragment },
      created_at: { gte: since },
    },
    select: { id: true },
  })
  return Boolean(existing)
}

/**
 * Fire-and-forget late arrival notification.
 * Called from punch-processor without blocking the device response.
 */
export async function notifyLateArrival(
  org_id:        string,
  employee_id:   string,
  lateByMinutes: number
): Promise<void> {
  try {
    // Respect org notification preference
    const org = await prisma.organisation.findFirst({
      where:  { id: org_id },
      select: { settings: true },
    })
    const settings     = (org?.settings ?? {}) as Record<string, unknown>
    const notifPrefs   = (settings.notifications ?? {}) as Record<string, unknown>
    if (notifPrefs.late_arrival === false) return

    const employee = await prisma.employee.findFirst({
      where:  { id: employee_id, org_id },
      select: { first_name: true, last_name: true, emp_code: true },
    })
    if (!employee) return

    const name = `${employee.first_name} ${employee.last_name}`

    // Dedup: one late-arrival notification per employee per day
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)
    const alreadySent = await prisma.notification.findFirst({
      where: {
        org_id,
        type:       'late_arrival',
        message:    { contains: employee.emp_code },
        created_at: { gte: todayStart },
      },
      select: { id: true },
    })
    if (alreadySent) return

    await notifyEmployeeManager(
      org_id,
      employee_id,
      'Late Arrival',
      `${name} (${employee.emp_code}) arrived ${lateByMinutes} minute${lateByMinutes !== 1 ? 's' : ''} late today.`,
      'late_arrival',
      '/attendance/live'
    )
  } catch {
    // Never throw from a fire-and-forget path
  }
}
