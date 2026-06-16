# Evict Dashboard

Server settings UI and guild API for [evict.bot](https://evict.bot). Fully separate from the marketing site in `/root/elira`.

## What's here

- `app/dashboard/` — UI routes (`/dashboard`, `/dashboard/:guildId/:tab`)
- `app/api/guilds/` — Guild settings REST API
- `components/` — Dashboard UI, settings panels, layout
- `lib/settings/` — Settings business logic (DB, Redis, cluster)
- `lib/` — Dashboard helpers (`guilds`, `bundle-client`, `sidebar-touch`, `routes`)
- `lib/embeds/` — Embed script types, parser, preview (settings modals)
- `lib/commands/` — Command catalog types/parser (disabled commands UI)
- `lib/guild/` — Discord channel type helpers
- `components/embeds/` — Embed editor/preview used by settings panels
- `app/styles/dashboard.css` — Dashboard-only styles

- `lib/auth/` — Discord OAuth, sessions (Redis), rate limits
- `app/api/auth/` — Login, callback, logout, `/me`

Shared infrastructure (DB, Discord API, cluster) is imported from `@elira/*` → `/root/elira`.

## Development

Run both apps:

```bash
# Terminal 1 — marketing site + auth (port 3000)
cd /root/elira && npm run dev

# Terminal 2 — dashboard UI + guild API (port 3001)
cd /root/dashboard && npm run dev
```

Use **http://localhost:3000/dashboard**. Elira proxies `/dashboard`, `/api/guilds`, and `/api/auth` to the dashboard app (same-origin cookies).

## Environment

Dashboard needs the same env as elira for DB/Redis/session (load from `../elira/.env` or copy locally). Set `ELIRA_ORIGIN=http://localhost:3000` in dashboard if auth proxy target differs.
