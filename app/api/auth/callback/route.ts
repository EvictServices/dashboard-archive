import { NextRequest, NextResponse } from 'next/server'
import { exchangeCode, fetchDiscordUser } from '@elira/lib/discord/api'
import {
  createSession,
  oauthStateCookieClear,
  sessionCookieOptions,
  OAUTH_STATE_COOKIE,
} from '@/lib/auth/session'
import { authRateLimitCallback, clientIpFromRequest } from '@/lib/auth/ratelimit'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const expected = req.cookies.get(OAUTH_STATE_COOKIE)?.value

  if (!code) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  if (!(await authRateLimitCallback(clientIpFromRequest(req)))) {
    const res = NextResponse.redirect(new URL('/?error=rate_limit', req.url))
    res.cookies.set(oauthStateCookieClear())
    return res
  }

  if (!state || !expected || state !== expected) {
    const res = NextResponse.redirect(new URL('/?error=oauth_state', req.url))
    res.cookies.set(oauthStateCookieClear())
    return res
  }

  try {
    const tokenData = await exchangeCode(code)
    const user = await fetchDiscordUser(tokenData.access_token)

    const sessionId = await createSession({
      userId: user.id,
      username: user.username,
      avatar: user.avatar,
      discriminator: user.discriminator,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      email: user.email ?? null,
      userAgent: req.headers.get('user-agent'),
    })

    const res = NextResponse.redirect(new URL('/dashboard', req.url))
    res.cookies.set(oauthStateCookieClear())
    res.cookies.set(sessionCookieOptions(sessionId))
    return res
  } catch (err) {
    console.error('Auth callback error:', err)
    const res = NextResponse.redirect(new URL('/?error=auth_failed', req.url))
    res.cookies.set(oauthStateCookieClear())
    return res
  }
}
