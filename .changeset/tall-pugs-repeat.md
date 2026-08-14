---
"askarr": patch
---

Fix the Proxmox LXC container refusing to start, and the back office answering
500 once it did.

Three things were wrong with the all-in-one image shipped in 0.5.0, and all
three were hit in order by the first person to install it.

**It would not start without `APP_URL`.** The entrypoint refused and exited,
which was the wrong call here: with DHCP there is no address to put in
`APP_URL` until the container has booted at least once, so refusing to boot
made the right value impossible to learn. Askarr now takes its own address and
uses `http://<that>:3000`, saying so. On an ordinary LAN that is exactly what
Radarr and Sonarr can reach. Setting `APP_URL` yourself still wins.

**Setting `APP_URL` broke it a second way.** Proxmox keeps the image's
environment in the container config, and its `env:` key replaces that list
rather than adding to it, so `pct set --env APP_URL=...` dropped `PATH`,
`NODE_ENV`, `PORT` and the rest. Everything the entrypoint needs is now set by
the entrypoint, including an absolute `#!/bin/bash` rather than one resolved
through `PATH`.

**A plausible `APP_URL` crashed every page.** `192.168.1.251` is what a person
types into a form asking for an address, and it is not a URL. It reached
better-auth as its base URL and threw on render, so the wizard answered "a
server error occurred" and the reason was four frames deep in a chunk file.
The entrypoint now reads it before anything else does: a missing scheme is
added, a bare address gets the port, a trailing slash goes, and a value that
cannot be salvaged stops the container with one line naming it. A hostname
with no port is left alone, since that is what somebody behind a reverse proxy
meant.

The README was also wrong to say application containers have no console. The
Console tab shows what Askarr prints, which is the first place to look, and it
now says so.

Only the LXC image is affected. The compose install never had any of this.
