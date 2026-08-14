# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two groups who never meet in the same interface.

**Requesters** — a private circle (household, family, friends) in one Telegram
group. Mixed technical comfort: a few understand the infrastructure, most do
not. They know Telegram and they know how to watch something; "Radarr",
"instance", "monitored" and "tmdbId" mean nothing to them. Their job is to ask
for a film or a show and find out when it is watchable. They never sign in
anywhere and never see the back office.

**Operators** — the person who self-hosts Askarr and owns the Radarr/Sonarr
behind it. They administer through the web back office: instances, who may
request, quotas, the approval queue. Since Askarr is published for others to
install, an operator is a stranger, not the author.

## Product Purpose

Askarr lets a private circle request films and shows from a Telegram group and
pushes those requests into Radarr and Sonarr. It owns who may request, what was
requested, which instance it goes to, and who to tell when it lands.

It does not replace Radarr or Sonarr and never talks to indexers or download
clients. Success is a requester getting what they asked for without learning
anything about the machinery, and an operator never being the bottleneck.

## Positioning

The request surface is a Telegram group people are already in, not a web portal
they must be invited to and sign into. Nothing else has to be running: no
Overseerr, Jellyseerr, Ombi or Plex, and no external metadata account —
metadata comes from the Radarr and Sonarr `lookup` endpoints, so the only
things Askarr talks to are Telegram and the instances it serves.

## Operating Context

- One Telegram group, sometimes converted to a **forum** with topics. Where
  topics exist they carry distinct jobs: requests, approvals, arrivals.
- One or more Radarr and Sonarr instances, told apart by the name the operator
  gave them ("Radarr", "Radarr French"). A kind may have several, or none.
- Radarr/Sonarr report progress by **webhook**; it is the only way Askarr
  learns that something was grabbed or imported.
- Self-hosted. Operators deploy into their own infrastructure, so Askarr cannot
  assume a network shape, a domain, a reverse proxy, or a deployment method.

## Capabilities and Constraints

Confirmed functionality: search and request from the group; deduplication so
several people asking for one title share one request and all get told;
role-based approval with a rolling 30-day quota; instance choice by name;
approval queue in the back office and in Telegram; arrival notifications.

Constraints that are facts of the platforms, not choices:

- The bot runs **BotFather privacy mode on** and sees only commands and replies
  to its own messages. Everything else is invisible to it, deliberately.
- A bot **cannot message someone who never started a private conversation with
  it**. Anything addressed to a requester happens in the group, as a mention.
- Telegram **refuses a reply that points into another forum topic**, so a
  message crossing topics has to mention the person instead.
- The Bot API can create forum topics but offers **no way to list them**.
- **Inline mode is off by default** on a new bot and has to be switched on with
  `/setinline`. Left off, inline search returns nothing and says nothing.
- **Webhooks require Askarr to be reachable from the instance.** An operator on
  a LAN with a remote Radarr has to solve this, and an install where it was
  never solved looks identical to a broken one.
- The bot is a **separate process** from the web app. The back office can talk
  to a running bot but cannot start one.
- Telegram ids exceed 32 bits and are stored as BigInt.

Open decisions: none recorded.

## Brand Commitments

Name: **Askarr**. It is an *arr and sits in that family's naming and
conventions.

Visual world: the **\*arr interface language**, pinned by the user and executed
as convention rather than reinterpreted. **Radarr and Sonarr are the named craft
bar** — an operator has one of them open in the next tab, and Askarr has to look
like it belongs there. That means their three-value grey chrome, their dense
14px register, their square labels, and their two-tone accenting: a brand hue on
nav and hovers, a separate blue on buttons and links.

Askarr's brand hue is **amber `#ff8c2b`** — one accent for the whole product;
Radarr and Sonarr instances are told apart by name, never by colour. Because
amber neighbours the family's warning orange, warning moves to the *arr gold
`#f9be03`, and the brand hue is confined to chrome (nav border, hover, logo,
focus) while warning only ever fills a label or a button.

Typeface: **Lato**, pinned by the user.

Voice: plain language to requesters, technical vocabulary confined to the back
office. Labels in the imperative. Errors say what happened and how to fix it,
without apologising. An action keeps one name through a whole flow.

Everything in the project is in English: code, identifiers, comments, commits,
UI copy, and bot messages.

## Evidence on Hand

One real deployment exists — a private group with roughly a dozen members,
against a live Radarr. It is the author's own and is not publishable proof.

There are no users beyond that, no testimonials, no customers, no benchmarks,
no press, and no third-party deployments yet. Future work must not invent any
of these, nor imply adoption that has not happened.

## Product Principles

1. **Silence to strangers.** An unauthorised chat gets no reply at all, not
   even a refusal. Askarr never confirms to someone outside the circle that it
   exists.
2. **Never claim something is true of the library without asking the
   instance.** A stored status is a snapshot; the instance is the fact. Saying
   "already there, go watch it" about a file that does not exist is worse than
   saying nothing.
3. **A request must mean something.** If honouring it needs the instance
   changed — monitoring resumed, a search started — do that rather than report
   a comfortable no-op.
4. **The install has to succeed without the author present.** Operators are
   strangers with their own infrastructure. Anything a person can forget, and
   that fails silently when forgotten, belongs in the product rather than the
   documentation.
5. **Requesters are told outcomes, operators are told mechanics.** The same
   event is a sentence about a film in the group and a diagnosable state in the
   back office.

## Accessibility & Inclusion

Mixed technical confidence is the norm among requesters, so plain language is
an accessibility requirement rather than a preference.

Interface floor: AA contrast in both themes, visible keyboard focus on every
control, `prefers-reduced-motion` respected, and usable down to 360px wide.
