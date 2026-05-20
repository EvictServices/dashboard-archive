import { NextRequest, NextResponse } from 'next/server'
import {
  clearLegacySessionCookie,
  clearSessionCookie,
  destroySession,
  oauthStateCookieClear,
} from '@/lib/auth/session'

export async function GET(req: NextRequest) {
  await destroySession()
  const res = NextResponse.redirect(new URL('/', req.url))
  res.cookies.set(clearSessionCookie())
  const legacy = clearLegacySessionCookie()
  if (legacy) res.cookies.set(legacy)
  res.cookies.set(oauthStateCookieClear())
  return res
}
