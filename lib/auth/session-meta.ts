export const SESSION_COOKIE =
  process.env.NODE_ENV === 'production' ? '__Host-session' : 'session'

export const SESSION_ID_HEX_RE = /^[a-f0-9]{64}$/
