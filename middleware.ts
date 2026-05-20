import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_PATHS = ['/dashboard']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next()
  }

  const session = request.cookies.get('evict_session')
  if (!session?.value) {
    const login = new URL('/api/auth/login', request.url)
    login.searchParams.set('returnTo', pathname)
    return NextResponse.redirect(login)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
