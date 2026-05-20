import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { hasGuildAdmin } from '@elira/lib/discord/api'
import { fetchGuildChannels, fetchGuildMember, type GuildChannel } from '@elira/lib/cluster/client'
import { normalizeSnowflake } from '@/lib/settings/command-mgmt'
import { addIgnoreTarget, listIgnoredTargets, removeIgnoreTarget } from '@/lib/settings/command-ignore'
import { recordDashboardAudit } from '@/lib/settings/dashboard-audit'

function channelIdsSet(channels: GuildChannel[]): Set<string> {
  return new Set(channels.map((c) => String(c.id).trim()).filter(Boolean))
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

  const targetIds = await listIgnoredTargets(id)
  return NextResponse.json({ targetIds }, {
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
  const targetId = normalizeSnowflake(body?.targetId)

  if (!targetId) {
    return NextResponse.json({ error: 'A valid 17–20 digit channel or user ID is required.' }, { status: 400 })
  }

  let channels: GuildChannel[] = []
  try {
    channels = (await fetchGuildChannels(id)) as GuildChannel[]
  } catch {
    return NextResponse.json({ error: 'Could not load server channels.' }, { status: 502 })
  }

  const chIds = channelIdsSet(channels)
  const isChannel = chIds.has(targetId)
  const member = isChannel ? null : await fetchGuildMember(id, targetId)

  if (!isChannel && !member) {
    return NextResponse.json(
      { error: 'That ID is not a channel in this server or a member currently in this server.' },
      { status: 400 }
    )
  }

  const added = await addIgnoreTarget(id, targetId)
  if (!added) {
    return NextResponse.json({ error: 'That target is already ignored.' }, { status: 409 })
  }

  recordDashboardAudit(session, id, 'commands.ignore.add', { target_id: targetId })
  const targetIds = await listIgnoredTargets(id)
  return NextResponse.json({ targetIds })
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
  const targetId = normalizeSnowflake(body?.targetId)

  if (!targetId) {
    return NextResponse.json({ error: 'targetId required.' }, { status: 400 })
  }

  const removed = await removeIgnoreTarget(id, targetId)
  if (!removed) {
    return NextResponse.json({ error: 'That target was not on the ignore list.' }, { status: 404 })
  }

  recordDashboardAudit(session, id, 'commands.ignore.remove', { target_id: targetId })
  const targetIds = await listIgnoredTargets(id)
  return NextResponse.json({ targetIds })
}
