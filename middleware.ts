import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth/session-meta'
import { parseSignedSessionCookieEdge } from '@/lib/auth/session-cookie-edge'

const PROTECTED_PATHS = ['/dashboard']

function stripSessionCookies(res: NextResponse) {
  const prod = process.env.NODE_ENV === 'production'
  res.cookies.set({
    name: SESSION_COOKIE,
    value: '',
    maxAge: 0,
    path: '/',
    httpOnly: true,
    secure: prod,
    sameSite: 'lax',
  })
  if (prod) {
    res.cookies.set({
      name: 'session',
      value: '',
      maxAge: 0,
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    })
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (!PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next()
  }

  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    const login = new URL('/api/auth/login', req.url)
    login.searchParams.set('returnTo', pathname)
    const res = NextResponse.redirect(login)
    stripSessionCookies(res)
    return res
  }

  const raw = req.cookies.get(SESSION_COOKIE)?.value
  const sid = await parseSignedSessionCookieEdge(raw, secret)
  if (!sid) {
    const login = new URL('/api/auth/login', req.url)
    login.searchParams.set('returnTo', pathname)
    const res = NextResponse.redirect(login)
    stripSessionCookies(res)
    return res
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
