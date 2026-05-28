/**
 * ZK Bridge — pulls attendance from AiFace Magnum / ZKTeco device
 * and pushes it to your HRMS on Vercel.
 *
 * First run:  node sync.js --full    (pulls ALL records, resets direction tracking)
 * Normal run: node sync.js           (pulls only new records since last sync)
 */

const ZKLib = require('zklib')
const https = require('https')
const http  = require('http')
const fs    = require('fs')
const path  = require('path')

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const DEVICE_IP     = '192.168.1.201'
const DEVICE_PORT   = 4370
const DEVICE_SERIAL = 'TDBD241101376'          // must match Settings → Biometric Devices
const HRMS_URL      = 'https://hrms.axiotta.com' // no trailing slash
const BATCH_SIZE    = 50                         // records per request
const FROM_DATE     = new Date('2025-12-31T18:30:00.000Z') // 1 Jan 2026 00:00 IST
// ─────────────────────────────────────────────────────────────────────────────

const LAST_SYNC_FILE    = path.join(__dirname, '.last_sync')
const PUNCH_COUNTS_FILE = path.join(__dirname, '.punch_counts.json')
const LOG_FILE          = path.join(__dirname, 'sync.log')
const fullSync          = process.argv.includes('--full')
const sleep             = ms => new Promise(r => setTimeout(r, ms))

function writeLog (message) {
  const ts   = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  const line = `[${ts}] ${message}\n`
  process.stdout.write(line)
  try {
    let existing = ''
    if (fs.existsSync(LOG_FILE)) {
      existing = fs.readFileSync(LOG_FILE, 'utf8')
      const lines = existing.split('\n').filter(Boolean)
      if (lines.length > 500) existing = lines.slice(-500).join('\n') + '\n'
    }
    fs.writeFileSync(LOG_FILE, existing + line)
  } catch {}
}

function connectDevice () {
  return new Promise((resolve, reject) => {
    const device = new ZKLib({ ip: DEVICE_IP, port: DEVICE_PORT, inport: 5200, timeout: 180000 })
    device.connect(err => err ? reject(err) : resolve(device))
  })
}
function disableDevice (device) {
  return new Promise(resolve => { try { device.disableDevice(() => resolve()) } catch { resolve() } })
}
function enableDevice (device) {
  return new Promise(resolve => { try { device.enableDevice(() => resolve()) } catch { resolve() } })
}
function getAttendance (device) {
  return new Promise((resolve, reject) => {
    device.getAttendance(function (err, data) {
      if (err) return reject(err)
      const records = Array.isArray(data) ? data : (data && data.data ? data.data : [])
      resolve(records)
    })
  })
}
function disconnectDevice (device) {
  return new Promise(resolve => { try { device.disconnect(resolve) } catch { resolve() } })
}

/**
 * Returns IST date string "YYYY-MM-DD" for a Date object.
 * Used as the per-day key in punchCounts so IST midnight is the day boundary.
 */
function toISTDate (d) {
  const istMs = d.getTime() + 5.5 * 60 * 60 * 1000
  return new Date(istMs).toISOString().slice(0, 10)
}

/**
 * Assign IN/OUT direction per employee per day using CUMULATIVE punch counts.
 *
 * AiFace devices send every punch as state=15 (no direction).
 * We alternate: position 0,2,4… = IN,  position 1,3,5… = OUT.
 * The key fix: in incremental mode we need to know how many punches were
 * ALREADY sent for each employee+day in previous runs so the global
 * position is correct, not just the batch-local index.
 *
 * punchCounts  { "empId_YYYY-MM-DD": totalSentSoFar }
 * Returns      { sorted, dirMap, newCounts }
 */
function assignDirections (records, punchCounts) {
  const sorted = [...records].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  // Group by empId + IST date
  const dayMap = {}
  for (const r of sorted) {
    const empId = String(r.id || r.uid)
    const date  = toISTDate(new Date(r.timestamp))
    const key   = `${empId}_${date}`
    if (!dayMap[key]) dayMap[key] = []
    dayMap[key].push(r)
  }

  const dirMap    = new Map()
  const newCounts = {}

  for (const [key, group] of Object.entries(dayMap)) {
    const prevCount = punchCounts[key] || 0   // punches already sent in earlier runs
    group.forEach((r, batchIdx) => {
      const globalPos = prevCount + batchIdx    // true position across all runs
      dirMap.set(r, globalPos % 2 === 0 ? 0 : 1) // 0=IN, 1=OUT
    })
    newCounts[key] = prevCount + group.length   // updated total for this key
  }

  return { sorted, dirMap, newCounts }
}

async function main () {
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  console.log(`\n========================================`)
  console.log(`  ZK Bridge  —  ${timestamp}`)
  console.log(`========================================`)

  if (DEVICE_SERIAL === 'YOUR_DEVICE_SERIAL') {
    console.error('\n ERROR: Set DEVICE_SERIAL in sync.js first.\n'); process.exit(1)
  }
  if (HRMS_URL.includes('YOUR-APP')) {
    console.error('\n ERROR: Set HRMS_URL in sync.js first.\n'); process.exit(1)
  }

  console.log(`\n Device : ${DEVICE_IP}:${DEVICE_PORT}`)
  console.log(` HRMS   : ${HRMS_URL}`)
  console.log(` Serial : ${DEVICE_SERIAL}`)

  // Load cumulative punch counts for correct IN/OUT assignment.
  // --full resets them so directions are re-calculated cleanly from all records.
  let punchCounts = {}
  if (!fullSync) {
    try {
      if (fs.existsSync(PUNCH_COUNTS_FILE)) {
        punchCounts = JSON.parse(fs.readFileSync(PUNCH_COUNTS_FILE, 'utf8'))
      }
    } catch { punchCounts = {} }
  } else {
    console.log(' Full sync: resetting direction tracking...')
  }

  let device = null
  try {
    console.log('\n Connecting to device...')
    device = await connectDevice()
    console.log(' Connected!')
    await sleep(1000)

    console.log(' Disabling device input (required for data pull)...')
    await disableDevice(device)
    await sleep(500)

    // Sync window
    let lastSync = null
    if (!fullSync && fs.existsSync(LAST_SYNC_FILE)) {
      lastSync = new Date(fs.readFileSync(LAST_SYNC_FILE, 'utf8').trim())
      console.log(` Last sync : ${lastSync.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`)
    } else {
      console.log(fullSync
        ? ' Mode: FULL sync (all records)'
        : ` Mode: Syncing from ${FROM_DATE.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} onwards`)
    }

    // Pull all records from device
    console.log(' Pulling attendance logs... (may take 1-3 min for large logs)')
    const allRecords = await getAttendance(device)
    console.log(` Total records on device: ${allRecords.length}`)

    const cutoff = lastSync && lastSync > FROM_DATE ? lastSync : FROM_DATE
    const toSync = allRecords.filter(r => new Date(r.timestamp) > cutoff)

    if (toSync.length === 0) {
      writeLog('Nothing new to sync. Already up to date.')
      return
    }
    console.log(` Records to sync: ${toSync.length}`)

    // Assign IN/OUT — uses cumulative counts so incremental batches get correct direction
    console.log(' Calculating IN/OUT direction per employee per day...')
    const { sorted, dirMap, newCounts } = assignDirections(toSync, punchCounts)

    // Show sample
    console.log('\n Sample (first 3):')
    sorted.slice(0, 3).forEach(r => {
      const dir = dirMap.get(r) === 0 ? 'IN' : 'OUT'
      console.log(`   EmpID=${r.id}  Time=${new Date(r.timestamp).toLocaleString('en-IN')}  Direction=${dir}`)
    })

    // Batch and send
    const batches       = Math.ceil(sorted.length / BATCH_SIZE)
    let totalProcessed  = 0
    let totalSkipped    = 0

    console.log(`\n Sending in ${batches} batches of ${BATCH_SIZE}...\n`)

    for (let i = 0; i < batches; i++) {
      const batch = sorted.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
      const lines = batch.map(r => {
        const empId  = String(r.id || r.uid)
        const d      = new Date(r.timestamp)
        const pad    = n => String(n).padStart(2, '0')
        const dt     = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
        const state  = dirMap.get(r) ?? 0   // 0 = IN, 1 = OUT
        return `${empId}\t${dt}\t${state}\t1`
      })

      const body    = `data=${encodeURIComponent(lines.join('\r\n'))}`
      const pushUrl = `${HRMS_URL}/iclock/cdata?SN=${encodeURIComponent(DEVICE_SERIAL)}&table=ATTLOG`
      const pct     = Math.round(((i + 1) / batches) * 100)

      process.stdout.write(`\r Batch ${i+1}/${batches} (${pct}%)...`)

      try {
        const response = await postData(pushUrl, body)
        const resp     = response.trim()
        if (resp.startsWith('OK')) {
          const n = parseInt(resp.split(':')[1] ?? '0', 10)
          totalProcessed += n
          totalSkipped   += (batch.length - n)
        } else {
          console.error(`\n Batch ${i+1} unexpected response: ${resp}`)
        }
      } catch (e) {
        console.error(`\n Batch ${i+1} error: ${e.message}`)
      }

      if (i < batches - 1) await sleep(300)
    }

    // ── Save .last_sync ────────────────────────────────────────────────────
    const latestMs = Math.max(...sorted.map(r => new Date(r.timestamp).getTime()))
    fs.writeFileSync(LAST_SYNC_FILE, new Date(latestMs).toISOString())

    // ── Save updated .punch_counts.json ────────────────────────────────────
    // Merge new counts into existing, then prune entries older than 14 days
    const updatedCounts = fullSync ? newCounts : { ...punchCounts, ...newCounts }
    const pruneDate = new Date()
    pruneDate.setDate(pruneDate.getDate() - 14)
    const pruneDateStr = toISTDate(pruneDate)
    for (const key of Object.keys(updatedCounts)) {
      const datePart = key.slice(key.lastIndexOf('_') + 1) // "YYYY-MM-DD" at end
      if (datePart < pruneDateStr) delete updatedCounts[key]
    }
    fs.writeFileSync(PUNCH_COUNTS_FILE, JSON.stringify(updatedCounts, null, 2))

    writeLog(`✓ Sent: ${sorted.length}, Matched: ${totalProcessed}, Skipped: ${totalSkipped}`)
    if (totalProcessed === 0 && sorted.length > 0) {
      writeLog(`NOTE: 0 matched — device EmpID (e.g. ${sorted[0] ? String(sorted[0].id) : '?'}) must match Employee Code in HRMS`)
    }

    // Report sync result to HRMS portal (shows in Settings → Biometric Devices)
    postData(
      `${HRMS_URL}/api/devices/sync-report`,
      JSON.stringify({ serial: DEVICE_SERIAL, sent: sorted.length, matched: totalProcessed, skipped: totalSkipped }),
      'application/json'
    ).catch(() => {})

  } catch (err) {
    const msg = err && err.message ? err.message : String(err)
    writeLog(`ERROR: ${msg}`)
    if (msg.includes('ECONNREFUSED')) writeLog('→ Cannot reach device. Make sure this PC is on the same network.')
    if (msg.includes('ETIMEDOUT'))    writeLog('→ Device not responding. Check IP and that device is on.')
    if (msg.includes('Invalid'))      writeLog('→ Device busy. Will retry on next run.')
    process.exit(1)
  } finally {
    if (device) {
      await enableDevice(device)
      await disconnectDevice(device)
    }
    console.log('\n========================================\n')
  }
}

function postData (url, body, contentType) {
  return new Promise((resolve, reject) => {
    const u    = new URL(url)
    const lib  = u.protocol === 'https:' ? https : http
    const opts = {
      hostname : u.hostname,
      port     : u.port || (u.protocol === 'https:' ? 443 : 80),
      path     : u.pathname + u.search,
      method   : 'POST',
      headers  : {
        'Content-Type'  : contentType || 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent'    : 'ZKBridge/1.0',
      },
    }
    const req = lib.request(opts, res => {
      let data = ''; res.on('data', c => data += c); res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('HRMS request timed out')) })
    req.write(body); req.end()
  })
}

main()
