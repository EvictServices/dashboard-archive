import pool from '@elira/lib/infra/db'
import {
  MAX_TAG_REWARD_ROLES,
  type TagRewardsState,
  type VanityRewardsState,
} from '@/lib/settings/rewards-types'

export type { TagRewardsState, VanityRewardsState } from '@/lib/settings/rewards-types'

const MAX_TEMPLATE_LEN = 12000

function snowflakeOrNull(v: unknown): string | null {
  if (v == null || v === '') return null
  const s = String(v).trim()
  if (!/^\d{17,20}$/.test(s)) return null
  return s
}

function snowflakeList(v: unknown): string[] {
  if (v == null) return []
  if (Array.isArray(v)) {
    const out: string[] = []
    for (const x of v) {
      const s = snowflakeOrNull(x)
      if (s) out.push(s)
    }
    return [...new Set(out)].slice(0, MAX_TAG_REWARD_ROLES)
  }
  return []
}

export async function getTagRewards(guildId: string): Promise<TagRewardsState> {
  const res = await pool.query<{
    channel_id: unknown
    role_ids: unknown
    template: unknown
  }>('SELECT channel_id, role_ids, template FROM tag WHERE guild_id = $1', [guildId])
  if (res.rows.length === 0) {
    return { channel_id: null, role_ids: [], template: null }
  }
  const row = res.rows[0]
  return {
    channel_id: snowflakeOrNull(row.channel_id),
    role_ids: snowflakeList(row.role_ids),
    template: row.template != null && String(row.template).length > 0 ? String(row.template) : null,
  }
}

export async function patchTagRewards(
  guildId: string,
  patch: Partial<{ channel_id: string | null; role_ids: string[]; template: string | null }>
): Promise<TagRewardsState> {
  const cur = await getTagRewards(guildId)
  let channel_id = cur.channel_id
  if ('channel_id' in patch) {
    channel_id = patch.channel_id === null || patch.channel_id === '' ? null : snowflakeOrNull(patch.channel_id)
    if (patch.channel_id != null && patch.channel_id !== '' && !channel_id) {
      throw new Error('Invalid channel id')
    }
  }
  let role_ids = cur.role_ids
  if (patch.role_ids !== undefined) {
    role_ids = [...new Set(patch.role_ids.map((id) => snowflakeOrNull(id)).filter(Boolean) as string[])].slice(
      0,
      MAX_TAG_REWARD_ROLES
    )
  }
  let template = cur.template
  if ('template' in patch) {
    if (patch.template === null || patch.template === '') {
      template = null
    } else {
      const t = String(patch.template).trim()
      if (t.length > MAX_TEMPLATE_LEN) {
        throw new Error(`Template must be at most ${MAX_TEMPLATE_LEN} characters`)
      }
      template = t
    }
  }

  const next: TagRewardsState = { channel_id, role_ids, template }
  await pool.query(
    `INSERT INTO tag (guild_id, channel_id, role_ids, template)
     VALUES ($1, $2, $3::bigint[], $4)
     ON CONFLICT (guild_id) DO UPDATE SET
       channel_id = EXCLUDED.channel_id,
       role_ids = EXCLUDED.role_ids,
       template = EXCLUDED.template`,
    [guildId, next.channel_id, next.role_ids, next.template]
  )
  return next
}

export async function getVanityRewards(guildId: string): Promise<VanityRewardsState> {
  const res = await pool.query<{
    channel_id: unknown
    role_id: unknown
    template: unknown
  }>('SELECT channel_id, role_id, template FROM vanity WHERE guild_id = $1', [guildId])
  if (res.rows.length === 0) {
    return { channel_id: null, role_id: null, template: null }
  }
  const row = res.rows[0]
  return {
    channel_id: snowflakeOrNull(row.channel_id),
    role_id: snowflakeOrNull(row.role_id),
    template: row.template != null && String(row.template).length > 0 ? String(row.template) : null,
  }
}

export async function patchVanityRewards(
  guildId: string,
  patch: Partial<{ channel_id: string | null; role_id: string | null; template: string | null }>
): Promise<VanityRewardsState> {
  const cur = await getVanityRewards(guildId)
  let channel_id = cur.channel_id
  if ('channel_id' in patch) {
    channel_id = patch.channel_id === null || patch.channel_id === '' ? null : snowflakeOrNull(patch.channel_id)
    if (patch.channel_id != null && patch.channel_id !== '' && !channel_id) {
      throw new Error('Invalid channel id')
    }
  }
  let role_id = cur.role_id
  if ('role_id' in patch) {
    role_id = patch.role_id === null || patch.role_id === '' ? null : snowflakeOrNull(patch.role_id)
    if (patch.role_id != null && patch.role_id !== '' && !role_id) {
      throw new Error('Invalid role id')
    }
  }
  let template = cur.template
  if ('template' in patch) {
    if (patch.template === null || patch.template === '') {
      template = null
    } else {
      const t = String(patch.template).trim()
      if (t.length > MAX_TEMPLATE_LEN) {
        throw new Error(`Template must be at most ${MAX_TEMPLATE_LEN} characters`)
      }
      template = t
    }
  }

  const next: VanityRewardsState = { channel_id, role_id, template }
  await pool.query(
    `INSERT INTO vanity (guild_id, channel_id, role_id, template)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (guild_id) DO UPDATE SET
       channel_id = EXCLUDED.channel_id,
       role_id = EXCLUDED.role_id,
       template = EXCLUDED.template`,
    [guildId, next.channel_id, next.role_id, next.template]
  )
  return next
}
