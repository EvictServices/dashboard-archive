import { createHmac, timingSafeEqual } from 'crypto'
import { SESSION_COOKIE, SESSION_ID_HEX_RE } from '@/lib/auth/session-meta'

export function getSessionSecret(): string {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET must be set and at least 32 characters')
  }
  return s
}

export function signSessionCookieValue(sessionId: string, secret: string): string {
  if (!SESSION_ID_HEX_RE.test(sessionId)) {
    throw new Error('Invalid session id')
  }
  const sig = createHmac('sha256', secret).update(sessionId, 'utf8').digest('base64url')
  return `${sessionId}.${sig}`
}

export function parseSignedSessionCookie(raw: string | undefined | null, secret: string): string | null {
  if (!raw || raw.length < 66 || raw[64] !== '.') return null
  const id = raw.slice(0, 64)
  const sig = raw.slice(65)
  if (!SESSION_ID_HEX_RE.test(id)) return null
  const expected = createHmac('sha256', secret).update(id, 'utf8').digest('base64url')
  try {
    const a = Buffer.from(sig, 'utf8')
    const b = Buffer.from(expected, 'utf8')
    if (a.length !== b.length) return null
    if (!timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  return id
}

export function sessionCookieBase() {
  const prod = process.env.NODE_ENV === 'production'
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    secure: prod,
    sameSite: 'lax' as const,
    path: '/',
  }
}
