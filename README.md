# Evict Dashboard

Server settings UI and guild API for [evict.bot](https://evict.bot). Fully separate from the marketing site in `/root/elira`.

## What's here

- `app/dashboard/` — UI routes (`/dashboard`, `/dashboard/:guildId/:tab`)
- `app/api/guilds/` — Guild settings REST API
- `components/` — Dashboard UI, settings panels, layout
- `lib/settings/` — Settings business logic (DB, Redis, cluster)
- `lib/` — Dashboard helpers (`guilds`, `bundle-client`, `sidebar-touch`)
- `app/styles/dashboard.css` — Dashboard-only styles

Shared infrastructure (auth, DB, Discord, marketing globals) is imported from `@elira/*` → `/root/elira`.

## Development

Run both apps:

```bash
# Terminal 1 — marketing site + auth (port 3000)
cd /root/elira && npm run dev

# Terminal 2 — dashboard UI + guild API (port 3001)
cd /root/dashboard && npm run dev
```

Use **http://localhost:3000/dashboard**. Elira proxies `/dashboard` and `/api/guilds` to the dashboard app. Auth (`/api/auth/*`) stays on elira.

## Environment

Dashboard needs the same env as elira for DB/Redis/session (load from `../elira/.env` or copy locally). Set `ELIRA_ORIGIN=http://localhost:3000` in dashboard if auth proxy target differs.
