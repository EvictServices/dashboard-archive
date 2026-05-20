import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { hasGuildAdmin } from '@elira/lib/discord/api'
import { fetchGuildRoles, type GuildRole } from '@elira/lib/cluster/client'
import { normalizeCommand, normalizeSnowflakeList } from '@/lib/settings/command-mgmt'
import {
  addRestrictionRows,
  listCommandRestrictions,
  removeRestrictionRows,
} from '@/lib/settings/command-restrict'
import { recordDashboardAudit } from '@/lib/settings/dashboard-audit'

function assignableRoleIds(roles: GuildRole[]): Set<string> {
  const set = new Set<string>()
  for (const r of roles) {
    if (r.is_default || r.is_bot_managed) continue
    set.add(r.id)
  }
  return set
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

  if (!(await hasGuildAdmin(session.accessToken, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const entries = await listCommandRestrictions(id)
  return NextResponse.json({ entries }, {
    headers: { 'Cache-Control': 'private, max-age=5, stale-while-revalidate=30' },
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { guildId: id } = await params

  if (!(await hasGuildAdmin(session.accessToken, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const command = normalizeCommand(body?.command)
  const roleIds = normalizeSnowflakeList(body?.roleIds)

  if (!command) {
    return NextResponse.json(
      {
        error:
          'Invalid command name. Use the command’s qualified name (letters, numbers, spaces, hyphens). The `command` group cannot be changed here.',
      },
      { status: 400 }
    )
  }

  if (!roleIds || roleIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one role.' }, { status: 400 })
  }

  let roles: GuildRole[] = []
  try {
    roles = await fetchGuildRoles(id)
  } catch {
    return NextResponse.json({ error: 'Could not load server roles.' }, { status: 502 })
  }

  const allowed = assignableRoleIds(roles)
  for (const rid of roleIds) {
    if (!allowed.has(rid)) {
      return NextResponse.json(
        { error: 'One or more roles are not valid for restrictions in this server.' },
        { status: 400 }
      )
    }
  }

  await addRestrictionRows(id, command, roleIds)
  recordDashboardAudit(session, id, 'commands.restrict.add', {
    command,
    role_ids: roleIds,
    count: roleIds.length,
  })

  const entries = await listCommandRestrictions(id)
  return NextResponse.json({ entries })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { guildId: id } = await params

  if (!(await hasGuildAdmin(session.accessToken, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const command = normalizeCommand(body?.command)
  const roleIds = normalizeSnowflakeList(body?.roleIds)

  if (!command) {
    return NextResponse.json({ error: 'Invalid command name.' }, { status: 400 })
  }

  if (!roleIds || roleIds.length === 0) {
    return NextResponse.json({ error: 'roleIds required.' }, { status: 400 })
  }

  await removeRestrictionRows(id, command, roleIds)
  recordDashboardAudit(session, id, 'commands.restrict.remove', {
    command,
    role_ids: roleIds,
    count: roleIds.length,
  })

  const entries = await listCommandRestrictions(id)
  return NextResponse.json({ entries })
}
