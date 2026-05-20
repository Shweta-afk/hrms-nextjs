/**
 * ZKTeco/ESSL device SDK wrapper.
 * When MOCK_DEVICE=true, returns realistic fake data for development.
 * When false, connects to real devices via the zklib npm package.
 * All operations enforce a 10-second timeout.
 */

export interface ZKAttendanceLog {
  uid: number
  id: string      // emp_code on the device
  state: number   // 0=check-in, 1=check-out, 4=OT-in, 5=OT-out
  timestamp: Date
}

export interface ZKUser {
  uid: number
  userId: string  // emp_code
  name: string
  password: string
  role: number    // 0=user, 14=admin
}

export interface ZKDeviceInfo {
  serialNumber: string
  platform: string
  firmware: string
  workCode: string
  mac: string
}

export interface ZKDevice {
  ip: string
  port: number
  // internal handle — callers don't touch this
  _handle: unknown
}

// ── Timeout helper ──────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms = 10_000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Device operation timed out after ${ms}ms`)), ms)
    ),
  ])
}

// ── Mock implementation ─────────────────────────────────────────────────────

const MOCK_SERIAL = 'MOCK-SN-12345'

function makeMockDevice(ip: string, port: number): ZKDevice {
  return { ip, port, _handle: { mock: true } }
}

async function mockGetAttendanceLogs(since?: Date): Promise<ZKAttendanceLog[]> {
  const now = new Date()
  const logs: ZKAttendanceLog[] = []
  const codes = ['EMP0001', 'EMP0002', 'EMP0003']
  // Generate fake punches for the last 7 days
  for (let d = 0; d < 7; d++) {
    const day = new Date(now)
    day.setDate(day.getDate() - d)
    if (day.getDay() === 0 || day.getDay() === 6) continue // skip weekends
    for (const [i, code] of codes.entries()) {
      const inTime = new Date(day)
      inTime.setHours(8 + i, 45 + Math.floor(Math.random() * 30), 0, 0)
      const outTime = new Date(day)
      outTime.setHours(17 + i, 30 + Math.floor(Math.random() * 30), 0, 0)
      if (!since || inTime > since) {
        logs.push({ uid: i + 1, id: code, state: 0, timestamp: inTime })
        logs.push({ uid: i + 1, id: code, state: 1, timestamp: outTime })
      }
    }
  }
  return logs
}

// ── Real implementation (zklib) ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ZKLibInstance = any

async function realConnect(ip: string, port: number): Promise<ZKLibInstance> {
  // Dynamically import so the server still starts if zklib is not installed
  let ZKLib: new (opts: { ip: string; port: number; inport: number; timeout: number }) => ZKLibInstance
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ZKLib = require('zklib')
  } catch {
    throw new Error('zklib is not installed. Run: npm install zklib')
  }

  const device = new ZKLib({ ip, port, inport: 4000, timeout: 10000 })
  await withTimeout(
    new Promise<void>((resolve, reject) => {
      device.connect((err: Error | null) => {
        if (err) reject(new Error(`Cannot connect to device at ${ip}:${port} — ${err.message}`))
        else resolve()
      })
    })
  )
  return device
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function connectToDevice(ip: string, port: number): Promise<ZKDevice> {
  if (process.env.MOCK_DEVICE === 'true') {
    return makeMockDevice(ip, port)
  }
  const handle = await withTimeout(realConnect(ip, port))
  return { ip, port, _handle: handle }
}

export async function getAttendanceLogs(
  device: ZKDevice,
  since?: Date
): Promise<ZKAttendanceLog[]> {
  if (process.env.MOCK_DEVICE === 'true') {
    return mockGetAttendanceLogs(since)
  }

  const handle = device._handle as ZKLibInstance
  const result = await withTimeout(
    new Promise<ZKAttendanceLog[]>((resolve, reject) => {
      handle.getAttendance((err: Error | null, data: { data: ZKAttendanceLog[] }) => {
        if (err) reject(err)
        else {
          const logs = (data?.data ?? []).map((r) => ({
            uid: r.uid,
            id: String(r.id),
            state: r.state,
            timestamp: new Date(r.timestamp),
          }))
          resolve(since ? logs.filter((l) => l.timestamp > since) : logs)
        }
      })
    })
  )
  return result
}

export async function getDeviceUsers(device: ZKDevice): Promise<ZKUser[]> {
  if (process.env.MOCK_DEVICE === 'true') {
    return [
      { uid: 1, userId: 'EMP0001', name: 'Demo Employee', password: '', role: 0 },
    ]
  }

  const handle = device._handle as ZKLibInstance
  return withTimeout(
    new Promise<ZKUser[]>((resolve, reject) => {
      handle.getUser((err: Error | null, data: { data: ZKUser[] }) => {
        if (err) reject(err)
        else resolve(data?.data ?? [])
      })
    })
  )
}

export async function pushEmployee(
  device: ZKDevice,
  employee: { emp_code: string; first_name: string; last_name: string }
): Promise<boolean> {
  if (process.env.MOCK_DEVICE === 'true') {
    return true
  }

  const handle = device._handle as ZKLibInstance
  const uid = parseInt(employee.emp_code.replace(/\D/g, ''), 10) || 1
  const name = `${employee.first_name} ${employee.last_name}`.slice(0, 24)

  return withTimeout(
    new Promise<boolean>((resolve, reject) => {
      handle.setUser(uid, employee.emp_code, name, '', 0, 0, (err: Error | null) => {
        if (err) reject(err)
        else resolve(true)
      })
    })
  )
}

export async function deleteEmployee(device: ZKDevice, emp_code: string): Promise<boolean> {
  if (process.env.MOCK_DEVICE === 'true') {
    return true
  }

  const handle = device._handle as ZKLibInstance
  const uid = parseInt(emp_code.replace(/\D/g, ''), 10) || 1

  return withTimeout(
    new Promise<boolean>((resolve, reject) => {
      handle.deleteUser(uid, (err: Error | null) => {
        if (err) reject(err)
        else resolve(true)
      })
    })
  )
}

export async function getDeviceInfo(device: ZKDevice): Promise<ZKDeviceInfo> {
  if (process.env.MOCK_DEVICE === 'true') {
    return {
      serialNumber: MOCK_SERIAL,
      platform: 'ZEM800',
      firmware: '6.60',
      workCode: '0',
      mac: '00:00:00:00:00:00',
    }
  }

  const handle = device._handle as ZKLibInstance
  const [sn, platform, firmware] = await Promise.all([
    withTimeout(
      new Promise<string>((res, rej) =>
        handle.serialNumber((err: Error | null, sn: string) => (err ? rej(err) : res(sn)))
      )
    ),
    withTimeout(
      new Promise<string>((res, rej) =>
        handle.version((err: Error | null, p: string) => (err ? rej(err) : res(p)))
      )
    ),
    withTimeout(
      new Promise<string>((res, rej) =>
        handle.version((err: Error | null, f: string) => (err ? rej(err) : res(f)))
      )
    ),
  ])

  return { serialNumber: sn, platform, firmware, workCode: '0', mac: '' }
}

export async function clearAttendanceLogs(device: ZKDevice): Promise<boolean> {
  if (process.env.MOCK_DEVICE === 'true') {
    return true
  }

  const handle = device._handle as ZKLibInstance
  return withTimeout(
    new Promise<boolean>((resolve, reject) => {
      handle.clearAttendanceLog((err: Error | null) => {
        if (err) reject(err)
        else resolve(true)
      })
    })
  )
}

/** Alias for getDeviceUsers — matches spec function name */
export const getEmployees = getDeviceUsers

export async function disconnect(device: ZKDevice): Promise<void> {
  if (process.env.MOCK_DEVICE === 'true') {
    return
  }
  const handle = device._handle as ZKLibInstance
  try {
    await withTimeout(
      new Promise<void>((resolve) => {
        handle.disconnect()
        resolve()
      }),
      3000
    )
  } catch {
    // Ignore disconnect errors
  }
}
