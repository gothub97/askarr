# askarr

## 0.2.0

### Minor Changes

- [`b18f0a9`](https://github.com/gothub97/askarr/commit/b18f0a98f288381c752520a9c7ded44afdcd602d) Thanks [@gothub97](https://github.com/gothub97)! - Rebuild the back office in the \*arr interface language.

  Askarr sat next to Radarr looking like a different product. The palette,
  spacing and component shapes now come from Radarr and Sonarr's own theme CSS:
  a three-value grey chrome, a fixed 60px bar over a fixed 210px sidebar with
  full-bleed content, type that stops at 16px with no uppercase or tracking, and
  2px corners on labels with 4px everywhere else.

  Two components carry the vocabulary — the square colour-coded status label, and
  the progress bar with the family's dual-layer caption so the text stays
  readable over both halves of the fill. Buttons are filled by kind, because in a
  table of forty rows the colour is how you tell an approve from a delete.

  Where the source palette fails WCAG AA it is corrected in value and never in
  hue, and every foreground/background pair in both themes is verified against
  the rendered DOM.

  The Telegram Mini App keeps Telegram's own palette and takes only the shapes:
  its reader has never seen Radarr.

- [`b18f0a9`](https://github.com/gothub97/askarr/commit/b18f0a98f288381c752520a9c7ded44afdcd602d) Thanks [@gothub97](https://github.com/gothub97)! - Publish a prebuilt image, so installing Askarr no longer means building it.

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
