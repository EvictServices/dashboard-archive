import { getSession } from '@elira/lib/auth/session'
import { redirect } from 'next/navigation'
import { fetchGuild, fetchMutualGuilds } from '@elira/lib/cluster/client'
import { isAntinukeAdmin } from '@/lib/settings/antinuke'
import { hasGuildAdmin } from '@elira/lib/discord/api'
import ServerSettingsView from '@/components/views/server-settings-view'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const guild = await fetchGuild(id)
    return { title: guild.name }
  } catch {
    return { title: 'Server Settings' }
  }
}

export default async function ServerSettingsPage({ params }: { params: Promise<{ id: string; tab: string }> }) {
  const { id, tab } = await params

  if (tab === 'overview' || tab === 'prefix') {
    redirect(`/dashboard/${id}/general`)
  }

  const [session, guild] = await Promise.all([
    getSession(),
    fetchGuild(id).catch(() => null),
  ])

  if (!session) redirect('/api/auth/login')
  if (!guild) redirect('/dashboard')

  if (!(await hasGuildAdmin(session.accessToken, id))) {
    redirect('/dashboard')
  }

  const [canAccessAntinuke, serverCount] = await Promise.all([
    isAntinukeAdmin(id, session.userId),
    fetchMutualGuilds(session.userId).then((g) => g.length).catch(() => 0),
  ])

  return (
    <ServerSettingsView
      guild={guild}
      activeTab={tab}
      canAccessAntinuke={canAccessAntinuke}
      user={{
        id: session.userId,
        username: session.username,
        avatar: session.avatar,
        email: session.email ?? null,
        serverCount,
      }}
    />
  )
}
