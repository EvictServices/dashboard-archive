import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { loadDashboardGuildLists } from '@/lib/guilds'
import DashboardView from '@/components/views/dashboard-view'

export const metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/api/auth/login')

  const { guilds, inviteGuilds } = await loadDashboardGuildLists(session)

  return (
    <DashboardView
      user={{
        id: session.userId,
        username: session.username,
        avatar: session.avatar,
      }}
      guilds={guilds}
      inviteGuilds={inviteGuilds}
    />
  )
}
