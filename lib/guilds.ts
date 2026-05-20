import { fetchMutualGuilds, fetchGuild, type MutualGuild } from '@elira/lib/cluster/client'
import { guildBannerUrl, guildIconUrl } from '@elira/lib/discord/cdn'
import { isDiscordGuildAdmin } from '@elira/lib/discord/admin'
import { fetchDiscordGuilds } from '@elira/lib/discord/api'

export type DashboardListedGuild = {
  id: string
  name: string
  icon_url: string | null
  member_count: number
  banner_url: string | null
}

export type DashboardInviteGuild = {
  id: string
  name: string
  icon_url: string | null
  banner_url: string | null
}

type SessionGuildInput = {
  userId: string
  accessToken: string
}

/**
 * Guilds the bot shares with the user where the user is Discord admin/owner — same list as the dashboard picker.
 */
export async function loadDashboardGuildLists(
  session: SessionGuildInput
): Promise<{ guilds: DashboardListedGuild[]; inviteGuilds: DashboardInviteGuild[] }> {
  const [clusterGuilds, discordGuilds] = await Promise.all([
    fetchMutualGuilds(session.userId).catch(() => [] as MutualGuild[]),
    fetchDiscordGuilds(session.accessToken).catch(() => []),
  ])

  const adminGuildIds = new Set(
    discordGuilds.filter((dg) => isDiscordGuildAdmin(dg)).map((dg) => dg.id)
  )

  const clusterAdminGuilds = clusterGuilds.filter((g) => adminGuildIds.has(g.id))
  const byId = new Map<string, MutualGuild>()
  for (const g of clusterAdminGuilds) {
    const prev = byId.get(g.id)
    if (!prev) {
      byId.set(g.id, g)
    } else {
      const a = g.member_count ?? 0
      const b = prev.member_count ?? 0
      if (a > b) byId.set(g.id, g)
    }
  }
  const confirmed: MutualGuild[] = [...byId.values()]
  const confirmedIds = new Set(confirmed.map((g) => g.id))

  const missingAdminGuilds = discordGuilds.filter(
    (dg) => adminGuildIds.has(dg.id) && !confirmedIds.has(dg.id)
  )
  const probeResults = await Promise.all(
    missingAdminGuilds.map(async (dg) => {
      try {
        const full = await fetchGuild(dg.id)
        const recovered: MutualGuild = {
          id: dg.id,
          name: dg.name,
          icon_url: guildIconUrl(dg.id, dg.icon) ?? null,
          member_count: full.member_count || 0,
        }
        return { mutual: recovered as MutualGuild | null, invite: null as (typeof missingAdminGuilds)[0] | null }
      } catch {
        return { mutual: null as MutualGuild | null, invite: dg as (typeof missingAdminGuilds)[0] | null }
      }
    })
  )

  const recovered: MutualGuild[] = []
  const inviteCandidates: typeof missingAdminGuilds = []
  for (const r of probeResults) {
    if (r.mutual) recovered.push(r.mutual)
    else if (r.invite) inviteCandidates.push(r.invite)
  }

  const enriched = await Promise.all(
    confirmed.map(async (g) => {
      if (g.member_count > 0) return g
      try {
        const full = await fetchGuild(g.id)
        return { ...g, member_count: full.member_count || 0 }
      } catch {
        return g
      }
    })
  )

  const bannerByGuildId = new Map<string, string>()
  for (const dg of discordGuilds) {
    const url = guildBannerUrl(dg.id, dg.banner)
    if (url) bannerByGuildId.set(dg.id, url)
  }

  const guilds: DashboardListedGuild[] = [...enriched, ...recovered].map((g) => ({
    ...g,
    banner_url: bannerByGuildId.get(g.id) ?? null,
  }))

  const inviteGuilds: DashboardInviteGuild[] = inviteCandidates.map((dg) => ({
    id: dg.id,
    name: dg.name,
    icon_url: dg.icon
      ? `https://cdn.discordapp.com/icons/${dg.id}/${dg.icon}.webp?size=128`
      : null,
    banner_url: bannerByGuildId.get(dg.id) ?? null,
  }))

  return { guilds, inviteGuilds }
}
