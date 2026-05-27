/**
 * ZK Bridge — pulls attendance from AiFace Magnum / ZKTeco device
 * and pushes it to your HRMS on Vercel.
 *
 * First run:  node sync.js --full    (pulls ALL records from device)
 * Normal run: node sync.js           (pulls only new records since last sync)
 *
 * Schedule with Windows Task Scheduler to run every 5 minutes.
 */

const ZKLib  = require('node-zklib')
const https  = require('https')
const http   = require('http')
const fs     = require('fs')
const path   = require('path')

// ─── CONFIG — edit these two values ────────────────────────────────────────
const DEVICE_IP     = '192.168.1.201'
const DEVICE_PORT   = 4370
const DEVICE_SERIAL = 'YOUR_DEVICE_SERIAL'   // must match Settings → Biometric Devices in HRMS
const HRMS_URL      = 'https://YOUR-APP.vercel.app'  // your Vercel app URL, no trailing slash
// ────────────────────────────────────────────────────────────────────────────

const LAST_SYNC_FILE = path.join(__dirname, '.last_sync')
const fullSync       = process.argv.includes('--full')

async function main () {
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  console.log(`\n========================================`)
  console.log(`  ZK Bridge  —  ${timestamp}`)
  console.log(`========================================`)

  if (!DEVICE_SERIAL || DEVICE_SERIAL === 'YOUR_DEVICE_SERIAL') {
    console.error('\n ERROR: Set DEVICE_SERIAL at the top of sync.js first.\n')
    process.exit(1)
  }
  if (HRMS_URL.includes('YOUR-APP')) {
    console.error('\n ERROR: Set HRMS_URL at the top of sync.js first.\n')
    process.exit(1)
  }

  console.log(`\n Device : ${DEVICE_IP}:${DEVICE_PORT}`)
  console.log(` HRMS   : ${HRMS_URL}`)
  console.log(` Serial : ${DEVICE_SERIAL}`)

  // ── Connect to device ──────────────────────────────────────────────────
  console.log('\n Connecting to device...')
  const zk = new ZKLib(DEVICE_IP, DEVICE_PORT, 10, 4000)

  try {
    await zk.createSocket()
    console.log(' Connected!')

    // ── Pull attendance logs ───────────────────────────────────────────
    let lastSync = null
    if (!fullSync && fs.existsSync(LAST_SYNC_FILE)) {
      lastSync = new Date(fs.readFileSync(LAST_SYNC_FILE, 'utf8').trim())
      console.log(` Last sync: ${lastSync.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`)
    } else {
      console.log(fullSync ? ' Mode: FULL sync (all records)' : ' Mode: First run — pulling all records')
    }

    process.stdout.write(' Pulling logs from device')
    const result  = await zk.getAttendances(() => process.stdout.write('.'))
    const records = result.data || []
    console.log(`\n Total records on device: ${records.length}`)

    // Filter to only new records
    const toSync = lastSync
      ? records.filter(r => new Date(r.attTime) > lastSync)
      : records

    if (toSync.length === 0) {
      console.log(' Nothing new to sync. Already up to date.')
      return
    }
    console.log(` New records to sync: ${toSync.length}`)

    // ── Format as ZKTeco ADMS and POST ────────────────────────────────
    const lines = toSync.map(r => {
      const d   = new Date(r.attTime)
      const pad = n => String(n).padStart(2, '0')
      const dt  = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
      return `${r.deviceUserId}\t${dt}\t${r.inOutStatus}\t${r.verifyMethod}`
    })

    const body    = `data=${encodeURIComponent(lines.join('\r\n'))}`
    const pushUrl = `${HRMS_URL}/iclock/cdata?SN=${encodeURIComponent(DEVICE_SERIAL)}&table=ATTLOG`

    console.log(` Sending to HRMS...`)
    const response = await postData(pushUrl, body)
    console.log(` HRMS response: ${response.trim()}`)

    if (response.trim().startsWith('OK')) {
      // Save latest punch time as last sync marker
      const latestMs = Math.max(...toSync.map(r => new Date(r.attTime).getTime()))
      const latestDt = new Date(latestMs)
      fs.writeFileSync(LAST_SYNC_FILE, latestDt.toISOString())

      const processed = parseInt(response.trim().split(':')[1] ?? '0', 10)
      console.log(`\n ✓ Sync complete — ${processed} records processed`)
      console.log(` Next sync will only pull records after ${latestDt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`)
    } else {
      console.error('\n Unexpected response — sync may have failed. Check your HRMS URL and serial.')
    }

  } catch (err) {
    console.error('\n ERROR:', err.message)
    if (err.message.includes('ECONNREFUSED')) {
      console.error(' → Cannot reach device. Make sure this PC is on the same WiFi/LAN as the device.')
    }
    if (err.message.includes('ETIMEDOUT')) {
      console.error(' → Device not responding. Check the IP address and that the device is on.')
    }
    process.exit(1)
  } finally {
    try { await zk.disconnect() } catch {}
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
      let data = ''
      res.on('data',  chunk => data += chunk)
      res.on('end',   ()    => resolve(data))
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('HRMS request timed out')) })
    req.write(body)
    req.end()
  })
}

main()
