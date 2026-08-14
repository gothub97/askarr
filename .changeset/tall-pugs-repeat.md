---
"askarr": patch
---

Fix the Proxmox LXC container refusing to start.

The all-in-one image shipped in 0.5.0 would not boot on Proxmox unless
`APP_URL` was set before the first start, and Proxmox showed none of the
reason. An application container has no console, so the entrypoint's
explanation went nowhere and the operator saw only `unable to get PID for CT
107 (not running?)`.

Refusing to start was the wrong call on this platform for a second reason: with
DHCP there is no address to put in `APP_URL` until the container has booted at
least once, so refusing to boot made the right value impossible to learn.

Askarr now takes its own address and uses `http://<that>:3000`, saying so in
the log. On an ordinary LAN that is exactly what Radarr and Sonarr can reach.
Setting `APP_URL` yourself still wins, and is still what you want behind a
domain or a reverse proxy.

The entrypoint also no longer depends on the image's environment surviving.
Proxmox keeps that environment in the container config, and its `env:` key
replaces the list rather than adding to it, so setting `APP_URL` with
`pct set --env` used to drop `PATH`, `NODE_ENV`, `PORT` and the rest and break
the container a second way while fixing the first. Everything the entrypoint
needs is now set by the entrypoint, including an absolute `#!/bin/bash` rather
than one resolved through `PATH`.

Only the LXC image is affected. The compose install never had either problem.
