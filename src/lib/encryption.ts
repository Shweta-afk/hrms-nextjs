import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12   // 96-bit IV for GCM
const TAG_LENGTH = 16  // 128-bit auth tag

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) throw new Error('ENCRYPTION_KEY environment variable is not set')
  // Key is stored as 64 hex chars (32 bytes)
  const buf = Buffer.from(key, 'hex')
  if (buf.length !== 32) throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)')
  return buf
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns a colon-separated hex string: iv:tag:ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':')
}

/**
 * Decrypt a value produced by encrypt().
 * Expects colon-separated hex string: iv:tag:ciphertext
 */
export function decrypt(data: string): string {
  const key = getKey()
  const parts = data.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted data format')

  const [ivHex, tagHex, encryptedHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}

/**
 * Safely decrypt — returns null instead of throwing if data is missing or malformed.
 */
export function safeDecrypt(data: string | null | undefined): Record<string, unknown> | null {
  if (!data) return null
  try {
    return JSON.parse(decrypt(data))
  } catch {
    return null
  }
}

/**
 * Safely encrypt a JSON-serialisable object. Returns null if input is null/undefined.
 */
export function safeEncrypt(value: Record<string, unknown> | null | undefined): string | null {
  if (!value) return null
  return encrypt(JSON.stringify(value))
}
