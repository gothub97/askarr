---
"askarr": minor
---

Remove the Telegram Mini App.

Askarr had three surfaces and used two. The Mini App was a second client for
searching, tracking and approving, reachable through `/app`, and it duplicated
everything the bot already does with slash commands and inline search.

It was not free to keep. About 2,900 lines across 21 files: a whole Next.js
client, seven API routes that served nobody else, a second authentication
system built on HMAC validation of Telegram `initData`, a palette bridge in
`globals.css` so it could borrow Telegram's colours, and a `next.config.ts`
block whose only purpose was letting it load through a tunnel in development.
Every change to requests, approvals or search had to be made twice, and the
second copy was the one nobody opened.

Nothing about how people ask for things changes. `/movie`, `/series`,
`/requests`, `/admin` and inline search are untouched. `/app` is gone from the
command list, and the bot pushes the shorter list to Telegram on its next start.

`TELEGRAM_MINIAPP_URL` is no longer read. An install that still sets it is not
harmed; the variable is simply ignored.
