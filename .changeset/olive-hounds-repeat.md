---
"askarr": minor
---

Publish a prebuilt image, so installing Askarr no longer means building it.

`ghcr.io/gothub97/askarr` is built for `linux/amd64` and `linux/arm64` with an
SBOM and a provenance attestation. `docker compose up -d` pulls it.

This needed the app URL to stop being a build-time value. It was
`NEXT_PUBLIC_APP_URL`, and Next inlines that prefix into the bundle at build
time — which would have frozen one installation's URL into every copy of the
published image. It is `APP_URL` now, read at run time, with the old name still
honoured for existing installs.

Also adds `scripts/reset-password.ts`. Askarr has no mail server and therefore
no forgot-password flow, and losing the only administrator password should not
mean editing the database by hand.
