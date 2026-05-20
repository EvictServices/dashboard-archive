/** Dashboard page paths and API routes (same-origin via elira proxy). */
export const routes = {
  home: '/',
  dashboard: '/dashboard',
  guild: (guildId: string, tab = 'general') =>
    `/dashboard/${guildId}/${tab}` as const,
} as const

/** Build `/api/guilds/:guildId/...` paths. */
export function apiGuild(guildId: string, ...segments: string[]): string {
  const tail = segments.filter(Boolean).join('/')
  return tail ? `/api/guilds/${guildId}/${tail}` : `/api/guilds/${guildId}`
}

export const api = {
  auth: {
    me: '/api/auth/me',
    login: '/api/auth/login',
    logout: '/api/auth/logout',
  },
  guilds: '/api/guilds',
  guildsTop: '/api/guilds/top',
  guildLeaderboard: (guildId: string) => apiGuild(guildId, 'leaderboard'),
  cluster: {
    health: '/api/cluster/health',
    status: '/api/cluster/status',
    commands: '/api/cluster/commands',
  },
} as const
