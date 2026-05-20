import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@elira/lib/auth/session'
import {
  enrichAntinukeSettingsForClient,
  fetchGuildOwnerId,
  getAntinukeSettings,
  trustedAdminsWithOwner,
  whitelistWithOwner,
  updateAntinukeModule,
  updateAntinukeBotToggle,
  updateAntinukeWhitelist,
  updateAntinukeTrustedAdmins,
  isAntinukeAdmin,
} from '@/lib/settings/antinuke'
import { recordDashboardAudit } from '@/lib/settings/dashboard-audit'

const SNOWFLAKE_RE = /^\d{17,20}$/

function parseSnowflakeIdArray(arr: unknown): string[] | { error: string } {
  if (!Array.isArray(arr)) return { error: 'Expected an array of user IDs' }
  const out: string[] = []
  const seen = new Set<string>()
  for (const v of arr) {
    if (typeof v !== 'string') {
      return { error: 'Each user ID must be sent as a string (Discord snowflake)' }
    }
    const t = v.trim()
    if (!SNOWFLAKE_RE.test(t)) {
      return { error: 'Each user ID must be a 17–20 digit Discord snowflake' }
    }
    if (seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { guildId: id } = await params

  if (!(await isAntinukeAdmin(id, session.userId))) {
    return NextResponse.json({ error: 'You must be a trusted admin or the server owner to access antinuke settings' }, { status: 403 })
  }

  const settings = await enrichAntinukeSettingsForClient(id, await getAntinukeSettings(id))
  return NextResponse.json(settings, {
    headers: { 'Cache-Control': 'private, max-age=5, stale-while-revalidate=30' },
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { guildId: id } = await params

  if (!(await isAntinukeAdmin(id, session.userId))) {
    return NextResponse.json({ error: 'You must be a trusted admin or the server owner to modify antinuke settings' }, { status: 403 })
  }

  const body = await req.json()

  if (body.module && typeof body.module === 'string') {
    const config = body.config ?? null
    try {
      await updateAntinukeModule(id, body.module, config)
    } catch (err) {
      return NextResponse.json(
        { error: (err as Error).message },
        { status: 400 }
      )
    }
    recordDashboardAudit(session, id, 'antinuke.module.update', {
      module: body.module,
    })
    const updated = await enrichAntinukeSettingsForClient(id, await getAntinukeSettings(id))
    return NextResponse.json(updated)
  }

  if (typeof body.bot === 'boolean') {
    await updateAntinukeBotToggle(id, body.bot)
    recordDashboardAudit(session, id, 'antinuke.bot_toggle', { enabled: body.bot })
    const updated = await enrichAntinukeSettingsForClient(id, await getAntinukeSettings(id))
    return NextResponse.json(updated)
  }

  if (body.whitelist !== undefined) {
    const parsed = parseSnowflakeIdArray(body.whitelist)
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const ownerId = await fetchGuildOwnerId(id)
    if (ownerId && !parsed.includes(ownerId)) {
      return NextResponse.json(
        { error: 'The server owner cannot be removed from the whitelist.' },
        { status: 400 }
      )
    }
    const current = await getAntinukeSettings(id)
    if (current.whitelist.includes(session.userId) && !parsed.includes(session.userId)) {
      return NextResponse.json(
        { error: 'You cannot remove yourself from the whitelist.' },
        { status: 400 }
      )
    }
    await updateAntinukeWhitelist(id, whitelistWithOwner(parsed, ownerId))
    recordDashboardAudit(session, id, 'antinuke.whitelist.update', {
      count: parsed.length,
    })
    const updated = await enrichAntinukeSettingsForClient(id, await getAntinukeSettings(id))
    return NextResponse.json(updated)
  }

  if (body.trusted_admins !== undefined) {
    const parsed = parseSnowflakeIdArray(body.trusted_admins)
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const ownerId = await fetchGuildOwnerId(id)
    if (ownerId && !parsed.includes(ownerId)) {
      return NextResponse.json(
        { error: 'The server owner cannot be removed from trusted admins.' },
        { status: 400 }
      )
    }
    const current = await getAntinukeSettings(id)
    if (
      current.trusted_admins.includes(session.userId) &&
      !parsed.includes(session.userId)
    ) {
      return NextResponse.json(
        { error: 'You cannot remove yourself from trusted admins.' },
        { status: 400 }
      )
    }
    await updateAntinukeTrustedAdmins(id, trustedAdminsWithOwner(parsed, ownerId))
    recordDashboardAudit(session, id, 'antinuke.trusted_admins.update', {
      count: parsed.length,
    })
    const updated = await enrichAntinukeSettingsForClient(id, await getAntinukeSettings(id))
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
}
