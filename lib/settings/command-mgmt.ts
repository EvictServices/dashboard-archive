import { SNOWFLAKE_RE } from '@elira/lib/discord/snowflakes'

const CMD_MAX = 96
const CMD_RE = /^[a-z0-9][a-z0-9 _-]*$/i

/** Commands that cannot be channel-disabled (qualified name, case-insensitive). */
const NON_DISABLEABLE_COMMANDS = new Set(['help'])

export function canDisableCommand(command: string): boolean {
  const normalized = normalizeCommand(command)
  if (!normalized) return false
  return !NON_DISABLEABLE_COMMANDS.has(normalized.toLowerCase())
}

export function nonDisableableCommandMessage(command: string): string | null {
  if (canDisableCommand(command)) return null
  const normalized = normalizeCommand(command)
  if (!normalized) return null
  if (NON_DISABLEABLE_COMMANDS.has(normalized.toLowerCase())) {
    return 'The help command cannot be disabled.'
  }
  return 'This command cannot be disabled.'
}

export function normalizeCommand(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim().replace(/\s+/g, ' ')
  if (s.length < 1 || s.length > CMD_MAX) return null
  if (!CMD_RE.test(s)) return null
  if (/^command(\s|$)/i.test(s)) return null
  return s
}

export function normalizeSnowflakeList(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null
  const out: string[] = []
  for (const x of raw) {
    if (typeof x !== 'string' && typeof x !== 'number') return null
    const id = String(x).trim()
    if (!SNOWFLAKE_RE.test(id)) return null
    out.push(id)
  }
  return [...new Set(out)]
}

export function normalizeSnowflake(raw: unknown): string | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null
  const id = String(raw).trim()
  if (!/^\d{17,20}$/.test(id)) return null
  return id
}
