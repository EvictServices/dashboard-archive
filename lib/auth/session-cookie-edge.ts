import { SESSION_ID_HEX_RE } from '@/lib/auth/session-meta'

function base64UrlToBytes(s: string): Uint8Array {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4
  if (pad) b64 += '='.repeat(4 - pad)
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

function timingSafeEqualU8(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false
  let d = 0
  for (let i = 0; i < a.byteLength; i++) d |= a[i] ^ b[i]
  return d === 0
}

export async function parseSignedSessionCookieEdge(
  raw: string | undefined | null,
  secret: string
): Promise<string | null> {
  if (!raw || secret.length < 32 || raw.length < 66 || raw[64] !== '.') return null
  const id = raw.slice(0, 64)
  const sigB64Url = raw.slice(65)
  if (!SESSION_ID_HEX_RE.test(id)) return null

  const enc = new TextEncoder()
  let key: CryptoKey
  try {
    key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
  } catch {
    return null
  }

  let expectedBuf: ArrayBuffer
  try {
    expectedBuf = await crypto.subtle.sign('HMAC', key, enc.encode(id))
  } catch {
    return null
  }

  let claimedBytes: Uint8Array
  try {
    claimedBytes = base64UrlToBytes(sigB64Url)
  } catch {
    return null
  }

  if (!timingSafeEqualU8(new Uint8Array(expectedBuf), claimedBytes)) return null
  return id
}
