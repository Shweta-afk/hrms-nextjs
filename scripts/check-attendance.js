/**
 * Read-only diagnostic: dumps yesterday's + today's punch logs and
 * attendance records (IST calendar days) so you can see exactly what
 * the device actually sent vs. what got recorded.
 *
 * Usage:
 *   1. vercel env pull .env.vercel-prod   (needs `vercel login` first)
 *   2. node scripts/check-attendance.js
 *
 * (Loads .env.vercel-prod itself in Node — don't `source` it in zsh,
 * pulled values can contain characters that break shell quoting.)
 */
const fs = require('fs')
const path = require('path')

function loadEnvFile(file) {
  const full = path.join(__dirname, '..', file)
  if (!fs.existsSync(full)) return
  for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let [, key, val] = m
    val = val.trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}
loadEnvFile('.env.vercel-prod')

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const IST_OFFSET_MS = 5.5 * 60 * 60_000

// Same rule as src/lib/ist-date.ts — IST calendar date, returned as UTC midnight
// (this is how AttendanceRecord.date is stored/compared).
function istDateOnly(dt) {
  const shifted = new Date(dt.getTime() + IST_OFFSET_MS)
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()))
}

// Real UTC instant range covering one IST calendar day — for filtering
// PunchLog.punch_time (a real timestamp, not a calendar-day label).
function istDayRange(labelDate) {
  const start = new Date(labelDate.getTime() - IST_OFFSET_MS)
  const end = new Date(start.getTime() + 86_400_000)
  return { start, end }
}

function fmtIST(d) {
  if (!d) return null
  return new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })
}

async function dumpDay(label, labelDate) {
  const { start, end } = istDayRange(labelDate)

  const punches = await prisma.punchLog.findMany({
    where: { punch_time: { gte: start, lt: end } },
    orderBy: { punch_time: 'asc' },
    select: { emp_code: true, punch_time: true, direction: true, device_id: true, processed: true },
  })

  const records = await prisma.attendanceRecord.findMany({
    where: { date: labelDate },
    orderBy: { employee: { first_name: 'asc' } },
    select: {
      status: true, is_late: true, first_in: true, last_out: true, total_hours: true,
      employee: { select: { first_name: true, last_name: true, emp_code: true } },
    },
  })

  console.log(`\n=== ${label} — IST ${labelDate.toISOString().slice(0, 10)} (punch window ${start.toISOString()} → ${end.toISOString()}) ===`)
  console.log(`-- PunchLog (${punches.length}) --`)
  for (const p of punches) {
    console.log(`  ${fmtIST(p.punch_time)}  emp=${p.emp_code}  dir=${p.direction}  device=${p.device_id}  processed=${p.processed}`)
  }
  console.log(`-- AttendanceRecord (${records.length}) --`)
  for (const r of records) {
    console.log(`  ${r.employee.first_name} ${r.employee.last_name} (${r.employee.emp_code}): status=${r.status} late=${r.is_late} in=${fmtIST(r.first_in)} out=${fmtIST(r.last_out)} hours=${r.total_hours}`)
  }
}

async function main() {
  const todayLabel = istDateOnly(new Date())
  const yesterdayLabel = new Date(todayLabel.getTime() - 86_400_000)

  const devices = await prisma.device.findMany({
    select: { name: true, last_heartbeat: true, status: true },
  })
  console.log('=== Devices ===')
  for (const d of devices) {
    const minsAgo = d.last_heartbeat ? Math.round((Date.now() - new Date(d.last_heartbeat).getTime()) / 60000) : null
    console.log(`  ${d.name}: status=${d.status} last_heartbeat=${fmtIST(d.last_heartbeat)} (${minsAgo}min ago)`)
  }

  await dumpDay('YESTERDAY', yesterdayLabel)
  await dumpDay('TODAY', todayLabel)
}

main().catch(e => console.error('ERR', e)).finally(() => prisma.$disconnect())
