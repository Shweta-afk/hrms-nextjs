/**
 * Quick diagnostic — run this first to see what methods are available.
 * node test.js
 */
const ZKLib = require('zklib')

const DEVICE_IP   = '192.168.1.201'
const DEVICE_PORT = 4370

console.log('\n Connecting to', DEVICE_IP + ':' + DEVICE_PORT, '...')

const device = new ZKLib({ ip: DEVICE_IP, port: DEVICE_PORT, inport: 5200, timeout: 10000 })

device.connect(function (err) {
  if (err) {
    console.error(' Connection FAILED:', err)
    process.exit(1)
  }

  console.log(' Connected!\n')
  console.log(' Available methods on device object:')

  const methods = []
  let obj = device
  while (obj && obj !== Object.prototype) {
    Object.getOwnPropertyNames(obj).forEach(name => {
      if (typeof device[name] === 'function' && name !== 'constructor' && !methods.includes(name)) {
        methods.push(name)
      }
    })
    obj = Object.getPrototypeOf(obj)
  }

  methods.sort().forEach(m => console.log('   -', m))
  console.log('\n Paste these method names so we can fix sync.js\n')

  try { device.disconnect() } catch {}
})
