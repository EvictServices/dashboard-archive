import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@elira/lib/auth/session'
import { hasGuildAdmin } from '@elira/lib/discord/api'
import {
  isInvokeActionType,
  listInvokeTemplates,
  upsertInvokeTemplate,
  deleteInvokeTemplate,
} from '@/lib/settings/invoke'
import { recordDashboardAudit } from '@/lib/settings/dashboard-audit'

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

  const templates = await listInvokeTemplates(id)
  return NextResponse.json(
    { templates },
    { headers: { 'Cache-Control': 'private, max-age=5, stale-while-revalidate=30' } }
  )
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

  if (!(await hasGuildAdmin(session.accessToken, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const actionType = body?.actionType
  const template = body?.template

  if (typeof actionType !== 'string' || !isInvokeActionType(actionType)) {
    return NextResponse.json({ error: 'Invalid or missing actionType' }, { status: 400 })
  }
  if (typeof template !== 'string') {
    return NextResponse.json({ error: 'Missing template' }, { status: 400 })
  }

  try {
    await upsertInvokeTemplate(id, actionType, template)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Save failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  recordDashboardAudit(session, id, 'invoke.template.upsert', { action_type: actionType })
  const templates = await listInvokeTemplates(id)
  return NextResponse.json({ templates })
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

  const actionType = req.nextUrl.searchParams.get('actionType')
  if (!actionType || !isInvokeActionType(actionType)) {
    return NextResponse.json({ error: 'Invalid or missing actionType query' }, { status: 400 })
  }

  try {
    await deleteInvokeTemplate(id, actionType)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Delete failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  recordDashboardAudit(session, id, 'invoke.template.delete', { action_type: actionType })
  const templates = await listInvokeTemplates(id)
  return NextResponse.json({ templates })
}
