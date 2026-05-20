import redis from '@elira/lib/infra/redis'

const LOGIN_LIMIT = 40
const LOGIN_WINDOW_SEC = 3600
const CALLBACK_LIMIT = 80
const CALLBACK_WINDOW_SEC = 3600

export function clientIpFromRequest(req: { headers: Headers }): string {
  const xf = req.headers.get('x-forwarded-for')
  if (xf) {
    const first = xf.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = req.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  return 'unknown'
}

async function allow(key: string, limit: number, windowSec: number): Promise<boolean> {
  try {
    const n = await redis.incr(key)
    if (n === 1) await redis.expire(key, windowSec)
    return n <= limit
  } catch {
    return true
  }
}

export function authRateLimitLogin(ip: string): Promise<boolean> {
  return allow(`rl:auth:login:${ip}`, LOGIN_LIMIT, LOGIN_WINDOW_SEC)
}

export function authRateLimitCallback(ip: string): Promise<boolean> {
  return allow(`rl:auth:cb:${ip}`, CALLBACK_LIMIT, CALLBACK_WINDOW_SEC)
}
