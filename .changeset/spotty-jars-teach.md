---
"askarr": minor
---

Teach the first-run wizard how to make a bot, instead of assuming one.

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
