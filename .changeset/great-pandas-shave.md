---
"askarr": minor
---

Rebuild the back office in the \*arr interface language.

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
