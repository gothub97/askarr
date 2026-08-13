# Askarr

An *arr for the people who watch, not the person who runs the server.

Askarr lets a private circle request movies and TV shows from a Telegram group and pushes those requests straight into Radarr and Sonarr. It does not replace them, and it never talks to indexers or download clients. It owns who is allowed to request, what was requested, which instance it goes to, and who to notify when it lands.

No Overseerr, no Jellyseerr, no Ombi, no Plex. Metadata comes from the Radarr and Sonarr `lookup` endpoints.

## Three surfaces

- **The Telegram bot** — the request surface, usable only from explicitly allowed groups.
- **The Telegram Mini App** — browsing and request tracking, opened from the bot.
- **The web back office** — administration, behind local authentication.

The Mini App and the back office are the same Next.js application with two separate authentication systems: Telegram `initData` validation on one side, better-auth on the other.

## Stack

Next.js (App Router, strict TypeScript) · shadcn/ui + Tailwind · better-auth · PostgreSQL + Prisma · grammY (long polling) · Zod · Docker Compose.

Everything runs on a LAN with no outbound access beyond Telegram and your Radarr/Sonarr instances.

## Running it

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Where the app is reachable |
| `NEXT_PUBLIC_APP_URL` | Same, inlined into the client at build time |
| `TELEGRAM_BOT_TOKEN` | From BotFather |
| `TELEGRAM_MINIAPP_URL` | `<app url>/miniapp` |

Then:

```bash
docker compose up -d --build
```

Open the app and the first-run wizard takes it from there: administrator account, first instance, Telegram group. Steps two and three are skippable — Askarr starts fine with nothing configured and tells you what to do next.

### Development

```bash
npm install
docker compose up -d postgres
npm run db:push
npm run dev      # web
npm run dev:bot  # bot, in a second terminal
```

| Script | |
|---|---|
| `npm run dev` / `dev:bot` | the two processes |
| `npm run build` / `start` | production web |
| `npm run start:bot` | production bot |
| `npm run db:migrate` | apply migrations |
| `npm run typecheck` | strict TypeScript |
| `npm test` | unit tests |

## Setting up the bot

1. Create a bot with [@BotFather](https://t.me/botfather) and copy the token into `TELEGRAM_BOT_TOKEN`.
2. **Leave privacy mode on.** The whole design relies on the bot only seeing commands and replies to its own messages.
3. Add the bot to your group. It appears live in onboarding step three with an **Allow** button.

A message from a group that has not been allowed produces no response at all — not an error, not a refusal. Askarr never confirms to a stranger that it exists.

### Commands

| | |
|---|---|
| `/movie <title>` | Search for a movie |
| `/series <title>` | Search for a TV show |
| `/requests` | Your ten most recent requests |
| `/app` | Open the Mini App |
| `/help` | Command reminder |
| `/admin` | Approval queue, admins only |

## Connecting Radarr and Sonarr

Add an instance in the back office, hit **Test connection**, and pick a quality profile and root folder from what the instance reports. Then copy the webhook URL shown on the instance card into **Settings → Connect → Webhook** on the Radarr/Sonarr side, ticking On Grab, On Import, and On Movie Added / On Series Add.

Two things worth knowing:

- **Path prefixes work.** An instance at `https://host/admin/radarr` is joined correctly rather than having its prefix stripped.
- **Self-signed certificates** are handled per instance, through a dedicated dispatcher. Askarr never disables TLS validation process-wide.

## Who can request what

| Role | |
|---|---|
| `BLOCKED` | No reaction at all |
| `GUEST` | Every request waits for approval |
| `TRUSTED` | Auto-approved while inside the rolling 30-day quota |
| `ADMIN` | Auto-approved, no quota |

A full series always goes through review, even for a trusted user, because it can trigger hundreds of grabs. A single season does not.

Quota counts requests over a rolling 30-day window, not bytes, and not calendar months.

## How a request travels

Two people asking for the same film on the same instance produce **one** `MediaItem` and **two** `Subscription` rows. Both get notified; the film is added once. A title already in the library is recorded as such and nothing is sent to Radarr at all.

Notifications arrive as a reply to the message that asked. If that message has been deleted, Askarr falls back to a plain message carrying an inline mention — built as a `tg://user` link, because not every member has a `@username`. A completed season produces one notification, never one per episode.

## Licence

Personal project. Do what you like with it.
