/**
 * Pulls the employee list from the AiFace / ZKTeco device.
 * Run this to see which Device ID belongs to which employee name.
 * Then update the Employee Code in HRMS to match the Device ID.
 *
 * Usage: node getusers.js
 */

const ZKLib = require('zklib')

const DEVICE_IP   = '192.168.1.201'
const DEVICE_PORT = 4370

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main () {
  console.log('\n Connecting to device...')
  const device = new ZKLib({ ip: DEVICE_IP, port: DEVICE_PORT, inport: 5200, timeout: 30000 })

  await new Promise((resolve, reject) => device.connect(err => err ? reject(err) : resolve()))
  console.log(' Connected!\n')
  await sleep(500)

  await new Promise(resolve => { try { device.disableDevice(() => resolve()) } catch { resolve() } })

  console.log(' Pulling user list from device...\n')

  await new Promise((resolve, reject) => {
    device.getUser(function (err, data) {
      if (err) return reject(err)

      const users = Array.isArray(data) ? data : (data && data.data ? data.data : [])
      console.log(` Found ${users.length} enrolled users:\n`)
      console.log(' Device ID  | Name')
      console.log(' -----------|----------------------')
      users.forEach(u => {
        const id   = String(u.userId || u.id || u.uid || '?').padEnd(10)
        const name = u.name || u.userName || '(no name)'
        console.log(` ${id} | ${name}`)
      })
      console.log('\n Go to HRMS → Employees → edit each employee')
      console.log(' and set their Employee Code to match the Device ID above.\n')
      resolve()
    })
  })

  try { device.enableDevice(() => {}) } catch {}
  try { device.disconnect() } catch {}
}

main().catch(err => {
  console.error('\n ERROR:', err.message || err)
  process.exit(1)
})
