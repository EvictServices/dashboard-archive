import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { oauthStateCookieSet } from '@/lib/auth/session'
import { authRateLimitLogin, clientIpFromRequest } from '@/lib/auth/ratelimit'
import { buildDiscordAuthorizeUrl } from '@elira/lib/discord/api'

export async function GET(req: NextRequest) {
  const ip = clientIpFromRequest(req)
  if (!(await authRateLimitLogin(ip))) {
    return NextResponse.redirect(new URL('/?error=rate_limit', req.url))
  }

  const state = randomBytes(24).toString('hex')
  const res = NextResponse.redirect(buildDiscordAuthorizeUrl(state))
  res.cookies.set(oauthStateCookieSet(state))
  return res
}
