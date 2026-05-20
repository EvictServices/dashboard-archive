import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@elira/lib/auth/session'
import { hasGuildAdmin } from '@elira/lib/discord/api'
import {
  CHANNEL_SNOWFLAKE,
  resolveScriptTemplateFromBody,
} from '@/lib/settings/script-message-template'
import {
  listMessages,
  upsertMessage,
  deleteMessage,
  type ScriptMessageKind,
} from '@/lib/settings/script-messages'
import { recordDashboardAudit } from '@/lib/settings/dashboard-audit'

const AUDIT_PREFIX: Record<ScriptMessageKind, string> = {
  welcome: 'welcome',
  boost: 'boost',
  goodbye: 'goodbye',
}

const NOT_FOUND_MESSAGE: Record<ScriptMessageKind, string> = {
  welcome: 'No welcome message for that channel',
  boost: 'No boost message for that channel',
  goodbye: 'No leave message for that channel',
}

function parseOptionalDeleteAfter(
  body: Record<string, unknown>
): number | null | undefined | 'invalid' {
  if (!('delete_after' in body)) return undefined
  const v = body.delete_after
  if (v === null) return null
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.trunc(v))
  if (typeof v === 'string' && v.trim()) {
    const n = parseInt(v, 10)
    if (!Number.isNaN(n)) return Math.max(0, n)
    return 'invalid'
  }
  if (typeof v !== 'string' && typeof v !== 'number') return 'invalid'
  return undefined
}

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>

async function authorize(
  ctx: { params: Promise<{ guildId: string }> }
): Promise<{ ok: true; session: Session; guildId: string } | { ok: false; response: NextResponse }> {
  const session = await getSession()
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const { guildId } = await ctx.params
  if (!(await hasGuildAdmin(session.accessToken, guildId))) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { ok: true, session, guildId }
}

async function readJsonBody(
  req: NextRequest
): Promise<Record<string, unknown> | NextResponse> {
  try {
    return (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
}

export async function handleScriptMessagePatch(
  kind: ScriptMessageKind,
  req: NextRequest,
  ctx: { params: Promise<{ guildId: string }> }
): Promise<NextResponse> {
  const auth = await authorize(ctx)
  if (!auth.ok) return auth.response
  const { session, guildId } = auth

  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body

  const channelId = typeof body.channel_id === 'string' ? body.channel_id.trim() : ''
  if (!CHANNEL_SNOWFLAKE.test(channelId)) {
    return NextResponse.json({ error: 'Invalid channel_id' }, { status: 400 })
  }

  const fromRaw = typeof body.from_channel_id === 'string' ? body.from_channel_id.trim() : ''
  const fromChannelId = fromRaw && CHANNEL_SNOWFLAKE.test(fromRaw) ? fromRaw : null

  const resolved = resolveScriptTemplateFromBody(body)
  if ('error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 })
  }

  const deleteAfter = parseOptionalDeleteAfter(body)
  if (deleteAfter === 'invalid') {
    return NextResponse.json({ error: 'Invalid delete_after' }, { status: 400 })
  }

  try {
    await upsertMessage(kind, guildId, channelId, resolved.template, fromChannelId, deleteAfter)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }

  recordDashboardAudit(session, guildId, `${AUDIT_PREFIX[kind]}.upsert`, {
    channel_id: channelId,
    ...(fromChannelId && fromChannelId !== channelId ? { from_channel_id: fromChannelId } : {}),
    ...(deleteAfter !== undefined ? { delete_after: deleteAfter } : {}),
  })
  const messages = await listMessages(kind, guildId)
  return NextResponse.json({ messages })
}

export async function handleScriptMessageDelete(
  kind: ScriptMessageKind,
  req: NextRequest,
  ctx: { params: Promise<{ guildId: string }> }
): Promise<NextResponse> {
  const auth = await authorize(ctx)
  if (!auth.ok) return auth.response
  const { session, guildId } = auth

  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body

  const channelId = typeof body.channel_id === 'string' ? body.channel_id.trim() : ''
  if (!CHANNEL_SNOWFLAKE.test(channelId)) {
    return NextResponse.json({ error: 'Invalid channel_id' }, { status: 400 })
  }

  const removed = await deleteMessage(kind, guildId, channelId)
  if (!removed) {
    return NextResponse.json({ error: NOT_FOUND_MESSAGE[kind] }, { status: 404 })
  }

  recordDashboardAudit(session, guildId, `${AUDIT_PREFIX[kind]}.delete`, { channel_id: channelId })
  const messages = await listMessages(kind, guildId)
  return NextResponse.json({ messages })
}
