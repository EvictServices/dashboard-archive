import { NextRequest, NextResponse } from 'next/server'
import { getSession, type Session } from '@elira/lib/auth/session'
import { hasGuildAdmin } from '@elira/lib/discord/api'
import { listMessages } from '@/lib/settings/script-messages'
import { getAutoroleSettings } from '@/lib/settings/autorole'
import { getLoggingSettings } from '@/lib/settings/logging'
import { getTicketSettings } from '@/lib/settings/tickets'
import {
  getConfiguration as getVoicemasterConfiguration,
  getEnrichedChannels as getVoicemasterChannels,
} from '@/lib/settings/voicemaster'
import { fetchGuildChannels, fetchGuildRoles, fetchGuildMember } from '@elira/lib/cluster/client'

interface ResourceLoader {
  load: (id: string, session: Session) => Promise<unknown>
  fallback: unknown
}

const RESOURCES: Record<string, ResourceLoader> = {
  system: {
    load: async (id) => ({ messages: await listMessages('welcome', id) }),
    fallback: { messages: [], unavailable: true },
  },
  boost: {
    load: async (id) => ({ messages: await listMessages('boost', id) }),
    fallback: { messages: [], unavailable: true },
  },
  goodbye: {
    load: async (id) => ({ messages: await listMessages('goodbye', id) }),
    fallback: { messages: [], unavailable: true },
  },
  channels: {
    load: async (id) => {
      const channels = await fetchGuildChannels(id)
      return [...channels].sort((a, b) => a.position - b.position)
    },
    fallback: [],
  },
  autorole: {
    load: async (id) => getAutoroleSettings(id),
    fallback: null,
  },
  roles: {
    load: async (id) => {
      const roles = await fetchGuildRoles(id)
      return roles
        .filter(
          (r) =>
            !r.is_default &&
            !r.is_bot_managed &&
            !r.is_premium_subscriber &&
            !r.is_integration
        )
        .sort((a, b) => b.position - a.position)
    },
    fallback: [],
  },
  me: {
    load: async (id, session) => (await fetchGuildMember(id, session.userId)) ?? null,
    fallback: null,
  },
  logging: {
    load: async (id) => getLoggingSettings(id),
    fallback: null,
  },
  tickets: {
    load: async (id) => getTicketSettings(id),
    fallback: null,
  },
  voicemaster: {
    load: async (id) => ({ configuration: await getVoicemasterConfiguration(id) }),
    fallback: { configuration: null },
  },
  voicemaster_channels: {
    load: async (id) => ({ channels: await getVoicemasterChannels(id) }),
    fallback: { channels: [] },
  },
}

export async function GET(
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

  const include = (req.nextUrl.searchParams.get('include') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s in RESOURCES)

  if (include.length === 0) {
    return NextResponse.json(
      { error: 'No valid resources specified' },
      { status: 400 }
    )
  }

  const results: Record<string, unknown> = {}

  await Promise.all(
    include.map(async (resource) => {
      const cfg = RESOURCES[resource]
      try {
        results[resource] = await cfg.load(id, session)
      } catch {
        results[resource] = cfg.fallback
      }
    })
  )

  return NextResponse.json(results, {
    headers: { 'Cache-Control': 'private, max-age=5, stale-while-revalidate=30' },
  })
}
