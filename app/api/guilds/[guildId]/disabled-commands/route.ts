import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@elira/lib/auth/session'
import { hasGuildAdmin } from '@elira/lib/discord/api'
import { fetchGuildChannels, type GuildChannel } from '@elira/lib/cluster/client'
import { isDiscordTextChannel } from '@elira/lib/guild/channel-type'
import {
  canDisableCommand,
  normalizeCommand,
  normalizeSnowflakeList,
  nonDisableableCommandMessage,
} from '@/lib/settings/command-mgmt'
import {
  addDisabledCommandRows,
  listDisabledCommands,
  removeDisabledCommandRows,
} from '@/lib/settings/disabled-commands'
import { recordDashboardAudit } from '@/lib/settings/dashboard-audit'

function textChannelIds(channels: GuildChannel[]): Set<string> {
  const set = new Set<string>()
  for (const c of channels) {
    if (isDiscordTextChannel(c)) set.add(c.id)
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

  const entries = await listDisabledCommands(id)
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
  const channelIds = normalizeSnowflakeList(body?.channelIds)

  if (!command) {
    return NextResponse.json(
      {
        error:
          'Invalid command name. Use the command’s qualified name (letters, numbers, spaces, hyphens). The `command` group cannot be changed here.',
      },
      { status: 400 }
    )
  }

  if (!canDisableCommand(command)) {
    return NextResponse.json(
      { error: nonDisableableCommandMessage(command) ?? 'This command cannot be disabled.' },
      { status: 400 }
    )
  }

  if (!channelIds || channelIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one text channel.' }, { status: 400 })
  }

  let guildChannels: GuildChannel[] = []
  try {
    guildChannels = (await fetchGuildChannels(id)) as GuildChannel[]
  } catch {
    return NextResponse.json({ error: 'Could not load server channels.' }, { status: 502 })
  }

  const allowed = textChannelIds(guildChannels)
  for (const cid of channelIds) {
    if (!allowed.has(cid)) {
      return NextResponse.json(
        { error: 'One or more channel IDs are not valid text channels in this server.' },
        { status: 400 }
      )
    }
  }

  await addDisabledCommandRows(id, command, channelIds)
  recordDashboardAudit(session, id, 'commands.disabled.add', {
    command,
    channel_ids: channelIds,
    count: channelIds.length,
  })

  const entries = await listDisabledCommands(id)
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
  const channelIds = normalizeSnowflakeList(body?.channelIds)

  if (!command) {
    return NextResponse.json({ error: 'Invalid command name.' }, { status: 400 })
  }

  if (!channelIds || channelIds.length === 0) {
    return NextResponse.json({ error: 'channelIds required.' }, { status: 400 })
  }

  await removeDisabledCommandRows(id, command, channelIds)
  recordDashboardAudit(session, id, 'commands.disabled.remove', {
    command,
    channel_ids: channelIds,
    count: channelIds.length,
  })

  const entries = await listDisabledCommands(id)
  return NextResponse.json({ entries })
}
