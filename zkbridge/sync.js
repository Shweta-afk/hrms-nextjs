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

// ─── CONFIG — edit these values ─────────────────────────────────────────────
const DEVICE_IP     = '192.168.1.201'
const DEVICE_PORT   = 4370
const DEVICE_SERIAL = 'YOUR_DEVICE_SERIAL'          // must match Settings → Biometric Devices in HRMS
const HRMS_URL      = 'https://YOUR-APP.vercel.app' // your Vercel URL, no trailing slash
// ─────────────────────────────────────────────────────────────────────────────

const LAST_SYNC_FILE = path.join(__dirname, '.last_sync')
const fullSync       = process.argv.includes('--full')

function connectDevice () {
  return new Promise((resolve, reject) => {
    const device = new ZKLib({ ip: DEVICE_IP, port: DEVICE_PORT, inport: 5200, timeout: 10000 })
    device.connect(err => err ? reject(err) : resolve(device))
  })
}

function getAttendance (device) {
  return new Promise((resolve, reject) => {
    device.getAttendance(function (err, data) {
      if (err) return reject(err)
      // zklib may return array directly or wrapped in { data: [...] }
      const records = Array.isArray(data) ? data : (data && data.data ? data.data : [])
      resolve(records)
    })
  })
}

function disconnectDevice (device) {
  return new Promise(resolve => { try { device.disconnect(resolve) } catch { resolve() } })
}

async function main () {
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  console.log(`\n========================================`)
  console.log(`  ZK Bridge  —  ${timestamp}`)
  console.log(`========================================`)

  if (DEVICE_SERIAL === 'YOUR_DEVICE_SERIAL') {
    console.error('\n ERROR: Set DEVICE_SERIAL at the top of sync.js first.\n'); process.exit(1)
  }
  if (HRMS_URL.includes('YOUR-APP')) {
    console.error('\n ERROR: Set HRMS_URL at the top of sync.js first.\n'); process.exit(1)
  }

  console.log(`\n Device : ${DEVICE_IP}:${DEVICE_PORT}`)
  console.log(` HRMS   : ${HRMS_URL}`)
  console.log(` Serial : ${DEVICE_SERIAL}`)

  let device = null
  try {
    // ── Connect ────────────────────────────────────────────────────────
    console.log('\n Connecting to device...')
    device = await connectDevice()
    console.log(' Connected!')

    // ── Determine sync window ──────────────────────────────────────────
    let lastSync = null
    if (!fullSync && fs.existsSync(LAST_SYNC_FILE)) {
      lastSync = new Date(fs.readFileSync(LAST_SYNC_FILE, 'utf8').trim())
      console.log(` Last sync : ${lastSync.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`)
    } else {
      console.log(fullSync ? ' Mode: FULL sync (all records)' : ' Mode: First run — pulling all records')
    }

    // ── Pull logs ──────────────────────────────────────────────────────
    console.log(' Pulling attendance logs from device...')
    const records = await getAttendance(device)
    console.log(` Total records on device: ${records.length}`)

    if (records.length === 0) {
      console.log('\n No records found on device.')
      console.log(' Check that employees are enrolled and have punched in/out.')
      return
    }

    // Show first raw record so we can verify field names
    console.log('\n Raw sample record:', JSON.stringify(records[0]))

    // Filter to only new records
    // zklib uses r.time as the timestamp field
    const getTime = r => r.time || r.attTime || r.timestamp
    const toSync  = lastSync
      ? records.filter(r => new Date(getTime(r)) > lastSync)
      : records

    if (toSync.length === 0) {
      console.log(' Nothing new to sync. Already up to date.')
      return
    }
    console.log(` New records to sync: ${toSync.length}`)

    // Show a few samples so user can verify employee IDs
    console.log('\n Sample records (first 3):')
    toSync.slice(0, 3).forEach(r => {
      const empId = r.id || r.userId || r.deviceUserId || r.uid
      const time  = new Date(getTime(r)).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      const state = r.state !== undefined ? r.state : (r.inOutStatus !== undefined ? r.inOutStatus : '?')
      console.log(`   EmpID=${empId}  Time=${time}  State=${state}`)
    })

    // ── Format as ZKTeco ADMS and POST ────────────────────────────────
    const lines = toSync.map(r => {
      const empId  = r.id || r.userId || r.deviceUserId || String(r.uid)
      const d      = new Date(getTime(r))
      const pad    = n => String(n).padStart(2, '0')
      const dt     = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
      const state  = r.state !== undefined ? r.state : (r.inOutStatus || 0)
      const verify = r.type  !== undefined ? r.type  : (r.verifyMethod || 1)
      return `${empId}\t${dt}\t${state}\t${verify}`
    })

    const body    = `data=${encodeURIComponent(lines.join('\r\n'))}`
    const pushUrl = `${HRMS_URL}/iclock/cdata?SN=${encodeURIComponent(DEVICE_SERIAL)}&table=ATTLOG`

    console.log(`\n Sending to HRMS...`)
    const response = await postData(pushUrl, body)
    console.log(` HRMS response: ${response.trim()}`)

    if (response.trim().startsWith('OK')) {
      const processed = parseInt(response.trim().split(':')[1] ?? '0', 10)
      const latestMs  = Math.max(...toSync.map(r => new Date(getTime(r)).getTime()))
      fs.writeFileSync(LAST_SYNC_FILE, new Date(latestMs).toISOString())

      console.log(`\n ✓ Sync complete — ${processed} punch(es) recorded in HRMS`)
      if (processed === 0 && toSync.length > 0) {
        console.log('\n NOTE: Records were sent but 0 matched to employees.')
        console.log(' The EmpID above must match the Employee Code in HRMS.')
        console.log(' Go to HRMS → Employees and check the Employee Code column.')
      }
    } else {
      console.error('\n Unexpected response — check HRMS URL and device serial.')
    }

  } catch (err) {
    const msg = err && err.message ? err.message : String(err)
    console.error('\n ERROR:', msg)
    if (msg.includes('ECONNREFUSED')) console.error(' → Make sure this PC is on the same network as the device.')
    if (msg.includes('ETIMEDOUT'))    console.error(' → Device not responding. Check IP and that device is on.')
    process.exit(1)
  } finally {
    if (device) await disconnectDevice(device)
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
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('HRMS request timed out')) })
    req.write(body); req.end()
  })
}

main()
