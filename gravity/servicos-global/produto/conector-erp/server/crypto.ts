import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

// Key must be 32 bytes represented as 64-character hex string
// Source from: process.env.ERP_ENCRYPTION_KEY

export async function encrypt(text: string, key: string): Promise<string> {
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv)

  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  // Format: iv:authTag:encrypted — all in base64
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

export async function decrypt(encryptedText: string, key: string): Promise<string> {
  const parts = encryptedText.split(':')
  if (parts.length !== 3) {
    throw new Error('Formato de credencial inválido')
  }

  const [ivB64, authTagB64, encryptedB64] = parts

  const decipher = createDecipheriv(
    ALGORITHM,
    Buffer.from(key, 'hex'),
    Buffer.from(ivB64, 'base64'),
  )
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'))

  const decrypted =
    decipher.update(Buffer.from(encryptedB64, 'base64')) + decipher.final('utf8')

  return decrypted
}
