import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@elira/lib/auth/session'
import { isAntinukeAdmin } from '@/lib/settings/antinuke'
import { fetchUserInfoBatch } from '@elira/lib/cluster/fetch-users'

const SNOWFLAKE_RE = /^\d{17,20}$/

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { guildId: id } = await params

  if (!(await isAntinukeAdmin(id, session.userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const ids = (body as { ids?: unknown }).ids
  if (!Array.isArray(ids)) {
    return NextResponse.json({ error: 'ids must be an array' }, { status: 400 })
  }

  const filtered = ids.filter(
    (v): v is string => typeof v === 'string' && SNOWFLAKE_RE.test(v.trim())
  )

  const batch = await fetchUserInfoBatch(filtered)
  const users: Record<
    string,
    {
      user_id: string
      username: string
      display_name: string | null
      avatar: string | null
    }
  > = {}
  for (const id of filtered) {
    const info = batch.get(id)
    if (!info) continue
    users[id] = {
      user_id: id,
      username: info.username?.trim() || 'Unknown user',
      display_name: info.display_name?.trim() || null,
      avatar: info.avatar?.trim() ? info.avatar.trim() : null,
    }
  }
  return NextResponse.json({ users })
}
