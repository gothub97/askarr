---
"askarr": minor
---

Install Askarr as a single Proxmox LXC.

Proxmox VE 9.1 can pull an OCI image straight from a registry and run it as a
container, so Askarr can now sit in the CT list next to Radarr and Sonarr
instead of inside a Docker daemon nested in a container. What was missing was
an image shaped for it: Proxmox has no compose equivalent, and an LXC runs one
image, so pointing it at the ordinary Askarr image gets you a web process with
no database and no bot.

There is now a second published image, `:latest-lxc`, carrying Postgres, the
web app and the bot together. Pull it, create an unprivileged container with a
mount point at `/data`, set `APP_URL`, and the usual seven-step wizard takes
over. The session secret and the database password are generated on first boot
and kept in `/data`, so `APP_URL` is the only thing to set. Setting
`DATABASE_URL` yourself is honoured and skips the bundled Postgres.

An LXC has no `docker pull`, so upgrading means creating a new container from
the newer image and attaching the same `/data`. Migrations therefore run on
every start rather than only the first, which is what lets the new container
pick the old database up and carry on.

The compose install is unchanged and stays the primary one.

Releases are also stricter now. Merging the `chore(release): version packages`
PR is the only thing that builds an image, so every published tag names a
version with a changelog entry. `:edge`, which followed `main`, is gone. CI
builds both Dockerfiles on every pull request without pushing them, so a broken
Dockerfile is still caught the day it lands rather than on release day.
