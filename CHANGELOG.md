# askarr

## 0.3.0

### Minor Changes

- [#2](https://github.com/gothub97/askarr/pull/2) [`85392d7`](https://github.com/gothub97/askarr/commit/85392d72964e4f63564c7d04fe82a6c71d51edc7) Thanks [@gothub97](https://github.com/gothub97)! - Teach the first-run wizard how to make a bot, instead of assuming one.

  Setup was four steps and assumed the hard part was done. It looked for a token
  that had to already be in `.env`, and if it was not there it told the operator
  to go and read a file. The BotFather walkthrough lived only in `README.md`, with
  no pictures, outside the product.

  It is seven steps now, and the whole walkthrough is inside it, drawn: five
  plates of the BotFather conversation, one of adding the bot to a group, one of
  the Topics switch. They are SVG rather than screenshots, so they follow the
  theme, weigh about 2 KB each, stay translatable, and cannot go stale the next
  time Telegram restyles its client.

  `/setinline` is in there, which matters more than the rest. Inline mode is off
  by default on every new bot and the command to turn it on appeared nowhere in
  this repo, while the README advertised `@yourbot dune` as a feature. On a fresh
  install that feature silently did nothing, with no error to explain it.

  Two steps now block: the token and the first group. A bot with nowhere to speak
  is not a working install, and someone who finished setup into that state learned
  about Askarr by watching it do nothing. Radarr and Sonarr stay skippable,
  because Askarr has to be installable before Radarr is.

  Blocking only works if leaving is safe, so the wizard is resumable. Every step
  commits as it finishes and the position is read back from the database, not
  remembered by the browser. The two steps that send the operator to Telegram are
  exactly the two where a tab gets closed.

  Step 6 also gained the webhook button that until now lived only on
  `/instances`, which is the step most likely to be put off and then forgotten.

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
