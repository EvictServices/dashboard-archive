import { createHash, randomBytes } from 'crypto'
import { cookies, headers } from 'next/headers'
import redis from '@elira/lib/infra/redis'
import { exchangeRefreshToken } from '@elira/lib/discord/api'
import { SESSION_COOKIE } from '@/lib/auth/session-meta'
import {
  getSessionSecret,
  parseSignedSessionCookie,
  sessionCookieBase,
  signSessionCookieValue,
} from '@/lib/auth/session-cookie-node'

const SESSION_MAX_AGE = 60 * 60 * 24 * 7
const SESSION_KEY_PREFIX = 'sess:'
const REFRESH_BUFFER_MS = 5 * 60 * 1000

type StoredSession = {
  userId: string
  username: string
  avatar: string | null
  discriminator: string
  email: string | null
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: number
  uaFingerprint: string
}

export interface Session {
  userId: string
  username: string
  avatar: string | null
  discriminator: string
  accessToken: string
  email: string | null
}

export type SessionCreateInput = Session & {
  refreshToken: string
  expiresIn: number
  userAgent: string | null
}

function sessionKey(id: string) {
  return `${SESSION_KEY_PREFIX}${id}`
}

function hashUserAgent(ua: string | null): string {
  return createHash('sha256').update(ua ?? '', 'utf8').digest('hex')
}

export async function createSession(data: SessionCreateInput): Promise<string> {
  const id = randomBytes(32).toString('hex')
  const accessTokenExpiresAt = Date.now() + data.expiresIn * 1000
  const stored: StoredSession = {
    userId: data.userId,
    username: data.username,
    avatar: data.avatar,
    discriminator: data.discriminator,
    email: data.email,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    accessTokenExpiresAt,
    uaFingerprint: hashUserAgent(data.userAgent),
  }
  await redis.set(sessionKey(id), JSON.stringify(stored), 'EX', SESSION_MAX_AGE)
  return id
}

async function persistSession(id: string, stored: StoredSession) {
  await redis.set(sessionKey(id), JSON.stringify(stored), 'EX', SESSION_MAX_AGE)
}

async function loadAndMaybeRefresh(id: string): Promise<StoredSession | null> {
  const raw = await redis.get(sessionKey(id))
  if (!raw) return null

  let stored: StoredSession
  try {
    stored = JSON.parse(raw) as StoredSession
  } catch {
    await redis.del(sessionKey(id))
    return null
  }

  if (!stored.uaFingerprint) {
    stored.uaFingerprint = ''
  }

  const needsRefresh =
    typeof stored.accessTokenExpiresAt !== 'number' ||
    Date.now() + REFRESH_BUFFER_MS >= stored.accessTokenExpiresAt

  if (needsRefresh) {
    try {
      const tok = await exchangeRefreshToken(stored.refreshToken)
      stored.accessToken = tok.access_token
      if (tok.refresh_token) {
        stored.refreshToken = tok.refresh_token
      }
      stored.accessTokenExpiresAt = Date.now() + tok.expires_in * 1000
      await persistSession(id, stored)
    } catch {
      await redis.del(sessionKey(id))
      return null
    }
  } else {
    await redis.expire(sessionKey(id), SESSION_MAX_AGE)
  }

  return stored
}

function tryParseSessionCookie(raw: string | undefined | null): string | null {
  try {
    const secret = getSessionSecret()
    return parseSignedSessionCookie(raw, secret)
  } catch {
    return null
  }
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(SESSION_COOKIE)?.value
  const sid = tryParseSessionCookie(raw)
  if (!sid) return null

  try {
    const stored = await loadAndMaybeRefresh(sid)
    if (!stored) return null

    if (stored.uaFingerprint) {
      const h = await headers()
      const current = hashUserAgent(h.get('user-agent'))
      if (current !== stored.uaFingerprint) {
        try {
          await redis.del(sessionKey(sid))
        } catch {}
        return null
      }
    }

    return {
      userId: stored.userId,
      username: stored.username,
      avatar: stored.avatar,
      discriminator: stored.discriminator,
      accessToken: stored.accessToken,
      email: stored.email,
    }
  } catch {
    return null
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(SESSION_COOKIE)?.value
  const sid = tryParseSessionCookie(raw)
  if (!sid) return
  try {
    await redis.del(sessionKey(sid))
  } catch {
  }
}

export function sessionCookieOptions(rawSessionId: string) {
  const secret = getSessionSecret()
  const value = signSessionCookieValue(rawSessionId, secret)
  return {
    ...sessionCookieBase(),
    value,
    maxAge: SESSION_MAX_AGE,
  }
}

export function clearSessionCookie() {
  return {
    ...sessionCookieBase(),
    value: '',
    maxAge: 0,
  }
}

export function clearLegacySessionCookie() {
  if (process.env.NODE_ENV !== 'production') return null
  return {
    name: 'session',
    value: '',
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  }
}

export const OAUTH_STATE_COOKIE = 'oauth_state'
const OAUTH_STATE_MAX_AGE = 600

export function oauthStateCookieSet(value: string) {
  return {
    name: OAUTH_STATE_COOKIE,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: OAUTH_STATE_MAX_AGE,
  }
}

export function oauthStateCookieClear() {
  return {
    name: OAUTH_STATE_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  }
}
