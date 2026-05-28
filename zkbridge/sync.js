/**
 * ZK Bridge — pulls attendance from AiFace Magnum / ZKTeco device
 * and pushes it to your HRMS on Vercel.
 *
 * First run:  node sync.js --full    (pulls ALL records from device)
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
const DEVICE_SERIAL = 'YOUR_DEVICE_SERIAL'          // must match Settings → Biometric Devices in HRMS
const HRMS_URL      = 'https://YOUR-APP.vercel.app' // your Vercel URL, no trailing slash
const BATCH_SIZE    = 50                             // records per request (keep under Vercel timeout)
const FROM_DATE     = new Date('2025-12-31T18:30:00.000Z') // 1 Jan 2026 00:00 IST — ignore older records
// ─────────────────────────────────────────────────────────────────────────────

const LAST_SYNC_FILE = path.join(__dirname, '.last_sync')
const LOG_FILE       = path.join(__dirname, 'sync.log')
const fullSync       = process.argv.includes('--full')
const sleep          = ms => new Promise(r => setTimeout(r, ms))

function writeLog (message) {
  const ts   = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  const line = `[${ts}] ${message}\n`
  process.stdout.write(line)
  try {
    // Keep last 500 lines only
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

/** Assign IN/OUT direction per employee per day (alternating).
 *  AiFace devices don't track direction — every punch is state 15.
 *  Strategy: within each employee+day, first punch = IN, next = OUT, next = IN... */
function assignDirections (records) {
  // Sort by time first
  const sorted = [...records].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  // Group by empId + date
  const dayMap = {}
  for (const r of sorted) {
    const empId = String(r.id || r.uid)
    const date  = new Date(r.timestamp).toISOString().slice(0, 10)
    const key   = `${empId}_${date}`
    if (!dayMap[key]) dayMap[key] = []
    dayMap[key].push(r)
  }

  // Assign direction index for each record
  const dirMap = new Map()
  for (const [, group] of Object.entries(dayMap)) {
    group.forEach((r, idx) => {
      dirMap.set(r, idx % 2 === 0 ? 0 : 1) // 0 = IN, 1 = OUT
    })
  }
  return { sorted, dirMap }
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
      console.log(fullSync ? ' Mode: FULL sync (all records)' : ` Mode: Syncing from ${FROM_DATE.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} onwards`)
    }

    // Pull
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

    // Assign IN/OUT directions (device sends state=15 for all — no direction info)
    console.log(' Calculating IN/OUT direction per employee per day...')
    const { sorted, dirMap } = assignDirections(toSync)

    // Show sample
    console.log('\n Sample (first 3):')
    sorted.slice(0, 3).forEach(r => {
      const dir = dirMap.get(r) === 0 ? 'IN' : 'OUT'
      console.log(`   EmpID=${r.id}  Time=${new Date(r.timestamp).toLocaleString('en-IN')}  Direction=${dir}`)
    })

    // Batch and send
    const batches    = Math.ceil(sorted.length / BATCH_SIZE)
    let totalProcessed = 0
    let totalSkipped   = 0

    console.log(`\n Sending in ${batches} batches of ${BATCH_SIZE}...\n`)

    for (let i = 0; i < batches; i++) {
      const batch = sorted.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
      const lines = batch.map(r => {
        const empId  = String(r.id || r.uid)
        const d      = new Date(r.timestamp)
        const pad    = n => String(n).padStart(2, '0')
        const dt     = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
        const state  = dirMap.get(r) ?? 0    // 0=IN, 1=OUT
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

      // Small pause to avoid overwhelming the server
      if (i < batches - 1) await sleep(200)
    }

    // Save last sync time
    const latestMs = Math.max(...sorted.map(r => new Date(r.timestamp).getTime()))
    fs.writeFileSync(LAST_SYNC_FILE, new Date(latestMs).toISOString())

    writeLog(`✓ Sent: ${sorted.length}, Matched: ${totalProcessed}, Skipped: ${totalSkipped}`)
    if (totalProcessed === 0 && sorted.length > 0) {
      writeLog(`NOTE: 0 matched — device EmpID (e.g. ${sorted[0] ? String(sorted[0].id) : '?'}) must match Employee Code in HRMS`)
    }

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

function postData (url, body) {
  return new Promise((resolve, reject) => {
    const u    = new URL(url)
    const lib  = u.protocol === 'https:' ? https : http
    const opts = {
      hostname : u.hostname,
      port     : u.port || (u.protocol === 'https:' ? 443 : 80),
      path     : u.pathname + u.search,
      method   : 'POST',
      headers  : {
        'Content-Type'  : 'application/x-www-form-urlencoded',
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
