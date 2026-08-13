---
name: Askarr
description: The request desk of an *arr stack, wearing that stack's interface language.
colors:
  page-ground: "#202020"
  chrome: "#2a2a2a"
  panel: "#333333"
  foreground: "#cccccc"
  muted-foreground: "#9b9d9e"
  border: "#3a3a3a"
  border-strong: "#585858"
  sidebar-foreground: "#e1e2e3"
  brand-amber: "#ff8c2b"
  brand-amber-on-light: "#9a5000"
  primary-link: "#6fa8ee"
  primary-link-on-light: "#2c6cb8"
  primary-fill: "#3273c8"
  positive: "#27c24c"
  positive-on-light: "#1a7a34"
  warning-gold: "#f9be03"
  warning-ink-on-light: "#8a6a00"
  destructive: "#f05050"
  destructive-on-light: "#c32828"
  queue-purple: "#7a43b6"
  queue-ink: "#b58ce0"
  queue-ink-on-light: "#6b3aa0"
  near-black-ink: "#202020"
  white-ink: "#ffffff"
  field-focus-blue: "#66afe9"
  light-page: "#f5f7fa"
  light-surface: "#ffffff"
  light-panel: "#ffffff"
  light-foreground: "#515253"
  light-muted-foreground: "#6b6d70"
  light-border: "#e5e5e5"
  light-border-strong: "#c8c8c8"
  light-row-hover: "#fafbfc"
typography:
  title:
    fontFamily: "Lato, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: "1.5rem"
    letterSpacing: "normal"
  heading:
    fontFamily: "Lato, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: "1.375rem"
    letterSpacing: "normal"
  subheading:
    fontFamily: "Lato, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: "1.25rem"
    letterSpacing: "normal"
  body:
    fontFamily: "Lato, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
    letterSpacing: "normal"
  small:
    fontFamily: "Lato, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1.125rem"
    letterSpacing: "normal"
  micro:
    fontFamily: "Lato, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: "1rem"
    letterSpacing: "normal"
  data:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1.125rem"
    fontFeature: "tabular-nums"
rounded:
  label: "2px"
  sm: "2px"
  md: "4px"
  lg: "4px"
  xl: "4px"
spacing:
  hair: "2px"
  xs: "4px"
  sm: "6px"
  base: "8px"
  md: "12px"
  lg: "20px"
  header: "60px"
  sidebar: "210px"
components:
  label-filled-warning:
    backgroundColor: "{colors.warning-gold}"
    textColor: "{colors.near-black-ink}"
    rounded: "{rounded.label}"
    padding: "2px 5px"
    typography: "{typography.small}"
  label-filled-queue:
    backgroundColor: "{colors.queue-purple}"
    textColor: "{colors.white-ink}"
    rounded: "{rounded.label}"
    padding: "2px 5px"
    typography: "{typography.small}"
  label-outline-warning:
    backgroundColor: "transparent"
    textColor: "{colors.warning-gold}"
    rounded: "{rounded.label}"
    padding: "2px 5px"
    typography: "{typography.small}"
  button-primary:
    backgroundColor: "{colors.primary-fill}"
    textColor: "{colors.white-ink}"
    rounded: "{rounded.md}"
    padding: "6px 16px"
    typography: "{typography.body}"
  button-outline:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "6px 16px"
    typography: "{typography.body}"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.near-black-ink}"
    rounded: "{rounded.md}"
    padding: "6px 16px"
    typography: "{typography.body}"
  button-sm:
    backgroundColor: "{colors.primary-fill}"
    textColor: "{colors.white-ink}"
    rounded: "{rounded.md}"
    padding: "1px 5px"
    typography: "{typography.small}"
  input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "6px 8px"
    typography: "{typography.body}"
  input-focus:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
  panel:
    backgroundColor: "{colors.chrome}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "12px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.sidebar-foreground}"
    padding: "12px 16px 12px 21px"
    typography: "{typography.body}"
    width: "210px"
  nav-item-active:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.white-ink}"
    padding: "12px 16px 12px 21px"
    typography: "{typography.body}"
  table-cell:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    padding: "8px"
    typography: "{typography.body}"
  progress-track:
    backgroundColor: "#2f2f2f"
    rounded: "{rounded.md}"
    height: "15px"
---

# Design System: Askarr

## Overview

**Creative North Star: "The Next Tab Over"**

Askarr is built to be mistaken, for the first half-second, for the app already
open in the adjacent browser tab. Radarr and Sonarr are one design system
differing in a single hue, and this is a third member of it: the same
three-value grey chrome, the same dense borderless tables, the same near-square
colour-coded chip, the same 14px body on a 20px line. The recognition is the
product's first argument, so nothing here is invented where the family already
has an answer.

The register is console, not dashboard. There is no display face and no display
size — a page title is body text one step up, in bold. There are no hero-metric
cards; the dashboard's three counts ride in the page header as chips, because
three big numbers on three panels spends the top third of a screen saying what
one line says. Content is full-bleed against a fixed 210px sidebar and a fixed
60px header; nothing is centred in a max-width column, because a queue of forty
titles should use the whole window. Density is the point: 8px table cells put a
row at roughly 36px so a full queue is one screen.

Depth is a stack of background values rather than a shadow system. Page, chrome,
panel — three greys, one hairline border between them, nothing floating except
the things that genuinely float. Colour is rationed: two accents with strictly
separated jobs, and a six-term semantic vocabulary (`default`, `primary`,
`success`, `warning`, `danger`, `queue`) that the label, the progress bar and
the button all consume identically, so a status looks the same everywhere it
appears.

One surface deliberately breaks the palette. The Telegram Mini App keeps
Telegram's own colours and takes only Askarr's shapes: its reader is a requester
inside a chat client who has never seen Radarr, so it wears their client's
clothes rather than the operator's.

**Key Characteristics:**
- Three-value grey chrome (`#202020` page / `#2a2a2a` chrome / `#333` panel), no floating in-flow surfaces
- Two-tone accenting: amber is chrome, blue is action, and they never swap
- 14px body on a 20px line, five sizes total, no uppercase, no letter-spacing
- Square: 2px on chips, 4px on everything else, full stop
- Dense rows, not cards; full-bleed, not a centred column
- Dark by default; the chrome stays dark in both themes

## Colors

Three greys carry the structure, and exactly two accent hues carry meaning on
top of them — an amber that only ever marks chrome, and a blue that only ever
marks action. Everything else in the palette is a status.

### Primary

- **Action Blue** (`#3273c8` as fill, `#6fa8ee` as ink in dark, `#2c6cb8` as ink in light): the interactive colour. Filled buttons, switch-on, filled `primary` chips and the `primary` progress fill take the darker fill value; links, outline chips and `link` buttons take the lighter ink value. The split exists because one value cannot do both: the ink at `#6fa8ee` clears 4.5:1 as text on a `#333` panel but is only 2.7:1 as a fill under white.

### Secondary

- **Chrome Amber** (`#ff8c2b` in dark and in all chrome, `#9a5000` for content areas of the light theme): the brand hue. It appears on the active nav item's 3px left border, on nav hover, on the logo mark, and as the focus ring. It never fills a surface and never carries a label. The light-theme content value is darkened because the full-strength amber cannot carry text on a pale ground; the chrome keeps `#ff8c2b` in both themes because it sits on a dark sidebar in both.

### Tertiary

- **Queue Purple** (`#7a43b6`, ink `#b58ce0` in dark / `#6b3aa0` in light): the family's "known about, not here yet" colour. Carries `QUEUED` requests and `MovieAdded` / `SeriesAdd` events. It is the one fill dark enough to genuinely take white text, and too dark to work as text itself — hence the separate lifted ink for the outline variant.
- **Signal Gold** (`#f9be03`, ink `#8a6a00` in light): warning. Pending approvals, the sidebar's waiting count, the `warning` button.
- **Go Green** (`#27c24c` dark / `#1a7a34` light): `AVAILABLE` and `ALREADY_HAVE`, reachable instances, the success button.
- **Stop Red** (`#f05050` dark / `#c32828` light): `REJECTED` and `FAILED`, unreachable instances, destructive buttons, inline error copy.
- **Field Focus Blue** (`#66afe9`): the Bootstrap-lineage focus colour the *arr forms use. It replaces the amber ring on text fields, textareas, select triggers and the header search, paired with a soft `0 0 6px rgba(102,175,233,0.6)` glow.

### Neutral

- **Page Ground** (`#202020` dark / `#f5f7fa` light): the body behind everything.
- **Chrome Grey** (`#2a2a2a`): header, sidebar, mobile drawer, popovers, and the `surface` a table panel sits on. Theme-independent for the header/sidebar/drawer; the light theme's content `surface` is `#ffffff`.
- **Panel Grey** (`#333333` dark / `#ffffff` light): cards, form fields, the active nav row.
- **Body Ink** (`#cccccc` dark / `#515253` light) and **Quiet Ink** (`#9b9d9e` dark / `#6b6d70` light): primary and secondary text. Quiet ink carries descriptions, timestamps, requester names, and titles nobody actually requested.
- **Hairline** (`#3a3a3a` dark / `#e5e5e5` light) and **Strong Edge** (`#585858` dark / `#c8c8c8` light): the single-pixel border between value steps, and the heavier edge used on form fields and neutral buttons so a control reads as a control.
- **Near-Black Ink** (`#202020`): the text colour on every light-value fill — gold, green, red, and the amber chrome's own foreground.

### Named Rules

**The Two-Tone Rule.** The amber (`--brand`) is chrome only: active nav border,
hover, logo, focus ring. The blue (`--primary` / `--primary-fill`) is action
only: buttons, links, the `primary` status. Neither ever does the other's job.
Wiring one to the other collapses the distinction that makes this app read as a
member of the *arr family rather than a lookalike.

**The Value-Corrected Fill Rule.** The source palette puts white text on
mid-value fills and lands at 2.3–2.7:1. Askarr keeps the source *hue* and
corrects the *value*: light-value fills (amber, gold, green, red) carry near-black
`#202020` text; the purple, dark enough to take it, carries white; blue fills use
`#3273c8` while the lighter `#6fa8ee` stays as link ink. `--warning-ink` and
`--queue-ink` exist precisely because those two fills cannot double as a text
colour.

**The Gold-Not-Orange Rule.** Warning is the *arr selection gold `#f9be03`, not
the family's orange, so it can never be confused with the brand amber. Amber
never fills; gold only ever fills. They do not share an element.

**The Constant Chrome Rule.** Header, sidebar and mobile drawer hold the dark
values in both themes. The amber needs a dark ground to clear 4.5:1, and a
chrome that shifted with the theme would have to drop the accent in one of them.

**The Borrowed-Palette Rule.** Inside the Telegram Mini App the palette comes
from `--tg-theme-*` and wins over everything above; only the shapes carry over.
Its fallbacks are the `--app-*` snapshot of the ambient theme, never a hardcoded
light default — a hardcoded default rendered a white page inside a dark client.

## Typography

**Display Font:** none. There is no display face and no display size.
**Body Font:** Lato (with the sans-serif stack), loaded at 300 / 400 / 700 only — the three cuts that exist, so the browser never synthesises a smeared fake weight.
**Label/Mono Font:** JetBrains Mono, 400 and 500, for technical identifiers only.

**Character:** Small, even, and unstyled to the point of being invisible. Lato at
14px reads as an operator console because nothing is asking to be looked at; the
hierarchy is carried by weight and by one-step size changes, never by scale.

### Hierarchy

- **Title** (700, 16px, 24px line): page titles (`h1`) and the app wordmark. This is the largest text in the product.
- **Heading** (700, 15px, 22px line): section titles (`h2`) inside a page.
- **Subheading** (700, 14px, 20px line): `h3`, table column headers, and emphasised cells such as a film title or instance label.
- **Body** (400, 14px, 20px line): everything else. Table cells, form values, empty-state copy, nav items.
- **Small** (400, 12px, 18px line): descriptions, timestamps, secondary metadata, the `md` chip.
- **Micro** (400, 11px, 16px line): the `sm` chip and the progress-bar caption.
- **Data** (mono 400, 12px, tabular figures): chat IDs, TMDB IDs, API keys, webhook URLs, versions, and the fixed `YYYY-MM-DD HH:MM` timestamp shape. Rendered through the `Data` component or the `.font-data` class.

### Named Rules

**The One-Step Rule.** A page title is body text one step up, in bold. 16 over
14. Anything larger belongs to a different product, and the restraint is a large
part of why an *arr screen reads as a console rather than a marketing page.

**The Flat Case Rule.** No uppercase, no letter-spacing, anywhere. An uppercase
tracked-out micro label is a dashboard habit this family does not have.

**The Data Face Rule.** If a machine produced the string and a person will copy
it rather than read it, it goes in the mono face with tabular figures. Prose
never does.

**The Five-Size Rule.** The scale is 11 / 12 / 14 / 15 / 16 and it stops there.
Adding a size is a system change, not a styling choice.

## Layout

The back office is a fixed 60px header (`--spacing-header`) spanning the full
width, over a fixed 210px sidebar (`--spacing-sidebar`) pinned below it, with
content full-bleed beside them. Both dimensions come from the *arr family's own
`dimensions.js`. Main content is offset by `pt-header md:pl-sidebar` and padded
`10px` on small screens, `20px` from the `sm` breakpoint up. Nothing is centred
and nothing is capped — the only max-width in the app is on the two signed-out
pages (`max-w-lg`) and the Mini App frame (`max-w-lg`), where a single form or a
phone column is the whole content.

Vertical rhythm inside a page is a 20px gap between sections and an 8px gap
between a section title and its panel. Within a panel, table cells are a flat
8px on all sides — no vertical/horizontal split — which puts a row at roughly
36px. The general spacing rhythm is Tailwind's 4px base used sparingly: 6px and
8px dominate inline gaps, 12px is the card's internal unit, 20px is the page
gutter and section gap.

Responsive behaviour, in the order the breakpoints fire:

- **360px floor.** Every page is usable at 360px with no page-level horizontal overflow. Tables scroll inside their own `overflow-x-auto` container rather than pushing the page sideways.
- **≤480px.** Inputs, selects and textareas bump to 16px so iOS does not zoom the page on focus.
- **`sm` (640px).** Page padding goes 10px → 20px; the header's title search appears; the page header's action row moves from stacked to inline.
- **`md` (768px).** The sidebar appears. Below it the same nav list lives in a modal drawer opened from a hamburger in the header — Escape closes it, focus moves in and returns to the trigger, and the page behind cannot scroll.
- **`lg` (1024px).** The signed-in email appears in the header.

The Mini App is phone-first and does not use the shell above: a sticky top bar,
a scrolling main with 112px of bottom padding, and a fixed bottom tab bar that
respects `env(safe-area-inset-bottom)`.

### Named Rules

**The Full-Bleed Rule.** The back office has no centred max-width column. A
queue of requests uses the whole window, the way Radarr's does.

**The Rows-Not-Cards Rule.** Lists of records are tables. Cards are for a single
composite object, not for repeating a record forty times.

**The Counts-In-The-Header Rule.** Summary numbers ride in the page header as
chips beside the title, not as a row of hero panels. The work starts immediately
underneath.

## Elevation & Depth

This system is tonal, not lifted. In-flow depth is a stack of background values
— `#202020` page, `#2a2a2a` chrome and panel-container, `#333` panel — separated
by a single 1px hairline border. No in-flow surface has a shadow, no surface has
a gradient, and nothing has a hover lift.

Shadow is reserved for three narrow jobs, all of which are genuinely about
something not being in the flow:

### Shadow Vocabulary

- **Overlay** (`box-shadow: var(--shadow-md)` plus `ring-1 ring-foreground/10`): dropdown menus and select popups, which really do float over the page. Submenus go one step to `--shadow-lg`.
- **Focus glow** (`box-shadow: 0 0 6px rgba(102, 175, 233, 0.6)`): the focused text field, textarea and select trigger. The invalid counterpart is the same 6px glow in `color-mix(in srgb, var(--destructive), transparent 40%)`.
- **Inset track** (`box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2)`): the progress bar's empty track, the one place the system models a recess rather than a lift.

Motion is likewise minimal: 100ms fade-and-scale on popovers, a 500ms
`ease-out` width transition on the progress fill, `animate-pulse` skeletons, and
colour-only transitions everywhere else. A global
`prefers-reduced-motion: reduce` block collapses every animation and transition
to 0.01ms and disables smooth scrolling.

### Named Rules

**The Stacked-Grey Rule.** Depth between in-flow surfaces is a background value
step and a hairline. If a surface is not literally floating over the page, it
does not get a shadow.

## Shapes

Two radii and no third. Chips and thumbnails take 2px (`--radius-sm`,
`--radius-label`); everything else takes 4px. `--radius-md`, `--radius-lg` and
`--radius-xl` all resolve to the same 4px on purpose, so the many `rounded-lg`
and `rounded-xl` call sites inherited from shadcn land on the right corner
instead of drifting into softness. There is nothing round in this product except
the switch track, which is a capsule because a switch that is not a capsule does
not read as a switch.

Borders do the work that shadows do elsewhere: every panel, card, field, chip
and button carries a 1px border, and its colour is the component's own semantic
colour rather than a neutral. A filled `warning` chip is bordered in gold; a
filled `destructive` button is bordered in red. The neutral edge (`border-strong`)
appears on form fields and neutral buttons so a control is distinguishable from
the panel behind it.

The Askarr mark is a flat single-colour speech bubble with a play triangle
knocked out of it via `fill-rule="evenodd"`, so it works on any ground and
inherits `currentColor`. No gradient, no second shape, drawn to read at 20–22px
in the sidebar.

### Named Rules

**The Square Chip Rule.** A chip is near-square at 2px, never a capsule. A
rounded pill here reads as a different product.

**The One Corner Rule.** 4px is the corner of this world. If a value other than
2px or 4px appears, it is a mistake.

**The Coloured Border Rule.** A component's border is its own colour, not a
neutral. That 1px line is why a filled control still has an edge on a flat
surface.

## Components

### Buttons

- **Character:** solid and colour-coded. Askarr briefly carried primary actions as outline ink on the theory that a console should stay flat; the family does the opposite, and colour is how you tell an approve from a delete at a glance in a table of forty rows.
- **Shape:** 4px corners, 1px border in the fill's own colour.
- **Sizes:** default `6px 16px` at 14px; `sm` `1px 5px` at 12px (the size used inside tables and empty states); `lg` `10px 20px` at 16px; square icon buttons at 24 / 28 / 32px.
- **Default (primary):** blue fill `#3273c8` with white text.
- **Outline:** the family's neutral button — a panel-coloured block with a strong edge, not a ghost. Hover goes to the secondary grey.
- **Secondary / Ghost:** grey block, and transparent-until-hover respectively.
- **Destructive / Success / Warning:** the status fill with its matched ink.
- **Link:** borderless, `primary` ink, underline on hover.
- **Hover:** every filled variant darkens by `color-mix(in srgb, <fill>, black 12%)` on both fill and border. No lift, no shadow.
- **Focus:** `2px solid var(--ring)` (amber) at 1px offset.
- **Disabled:** 65% opacity, pointer events off.
- **ButtonGroup:** buttons welded with shared edges — inner corners squared, a single 1px line between neighbours, the hovered/focused member raised in stacking order.

### Chips

Two components, one shape. `Label` (in `status-label.tsx`) is the real one and
carries the `kind` vocabulary; `Badge` is the shadcn primitive kept only so
imported primitives type-check. New code uses `Label`.

- **Style:** 2px corners, 1px border in the kind's colour, `line-height: 1` so the box hugs the text, and `whitespace-nowrap` always.
- **Sizes:** `sm` `1px 3px` at 11px, `md` `2px 5px` at 12px, `lg` `3px 7px` at 14px bold.
- **Filled:** the kind colour as a block with the foreground chosen for it (near-black on gold/green/red/blue, white on purple).
- **Outline:** the kind colour as ink and border on nothing. `warning` and `queue` swap to their dedicated ink tokens here, because the gold that reads as a fill is unreadable as text on white and the purple that reads as a fill is unreadable as text on black.
- **Kinds:** `default`, `primary`, `success`, `warning`, `danger`, `queue`, plus `disabled` for a muted non-status chip.

### Cards / Containers

- **Panel** (the container this app actually uses): `overflow-hidden`, 4px corners, 1px hairline border, `surface` background. It exists to hold a table.
- **Card** (the composite object): 4px corners, hairline border, `card` background, 12px internal spacing (8px at `size="sm"`), a footer that sits on `surface` behind a top border, and a first-child image that bleeds to the top corners.
- **Shadow Strategy:** none. See Elevation & Depth.

### Inputs / Fields

- **Style:** a filled well, not an outlined transparent box — the field sits on `--input`, a value step up from the panel behind it, inside a 1px `border-strong` edge at 4px corners, padded `6px 8px`.
- **Focus:** the field's amber outline is suppressed in favour of the family's Bootstrap-lineage treatment: border to `#66afe9` plus a `0 0 6px rgba(102,175,233,0.6)` glow. Text inputs, textareas, select triggers and the header search all share this.
- **Invalid:** `aria-invalid` swaps the border to `destructive` and the glow to a 40%-transparent destructive mix.
- **Disabled:** 65% opacity, `not-allowed` cursor.
- **Textarea:** identical, with `field-sizing-content` and a 64px floor.
- **Select:** the same trigger styling; the popup is a floating 4px panel on `popover` with an overlay shadow and a hairline ring.
- **Switch:** the one capsule in the system — 32×18px (24×14 at `sm`), `primary-fill` when checked, `border-strong` when not, with an invisible expanded hit area.

### Tables

- **Character:** dense, borderless headers, no zebra, hover as the only row highlight.
- **Header:** bold body-size text, left-aligned, bottom-aligned, on a single bottom hairline. No fill, no uppercase.
- **Cells:** 8px on all sides, top-aligned, and they **wrap** — the shadcn original forced `whitespace-nowrap`, which every table then had to undo cell by cell, because the content here is film titles and sentences rather than figures.
- **Rows:** 1px bottom hairline, last row borderless, `row-hover` on hover and on an expanded or selected state.
- **Container:** always wrapped in `overflow-x-auto`, which is what keeps the page itself from scrolling sideways at 360px.
- **Column widths** are set at the call site with `min-w-*` per column and `w-px` on a shrink-to-fit action or state column.

### Navigation

- **Sidebar:** a 210px column on the chrome grey, items at 12px vertical / 24px effective horizontal with a 7px gap between an 18px icon and its 14px label.
- **Active:** a 3px left border in the brand amber, with the row itself a value step lighter (`sidebar-accent`) and its text pure white. This is the family's one piece of nav decoration and the single most recognisable thing about the chrome.
- **Hover (inactive):** text goes amber. The border stays transparent; no fill appears.
- **Badge:** the Requests item carries a `warning` chip with the pending count, pushed right, whenever the count is non-zero.
- **Mobile:** below `md` the same list becomes a modal left drawer over a 60% black scrim, with the mark and a close button in a 60px head.
- **Header search:** a 224px field on `bg-black/25` with a leading icon, hidden below `sm`. It submits to the filtered request list.

### Progress Bar (signature component)

The *arr dual-layer caption bar. A caption centred over a partly-filled bar sits
on two backgrounds at once and no single text colour is readable on both, so the
caption is rendered **twice** — once over the empty track in quiet ink, once over
the fill in that fill's matched foreground — with the second copy clipped to
exactly the filled width. Whichever side of the boundary a glyph falls on, it is
drawn in the colour that suits that side. Both copies share size and weight so
the boundary never shows as a jump mid-word; the duplicate is `aria-hidden` so
the caption is announced once.

- **Sizes:** 5px (no caption — no room), 15px (default), 20px.
- **Track:** `muted`, 4px corners, inset recess shadow.
- **Fill:** the status kind's colour, width transitioned over 500ms `ease-out`.
- **Semantics:** a real `role="progressbar"` with `aria-valuenow` and an accessible name.

### Empty States

A bordered `surface` panel at 4px corners, padded `20px 16px`, left-aligned:
title in body ink, an optional hint in quiet ink, and an optional action button.
It names the situation and offers the next move rather than shrugging. The Mini
App deliberately does not reuse it — there, an empty pane is centred and
borderless, because it is the only thing on the screen rather than one panel
among several.

### Poster

A 2px-cornered thumbnail on `muted`, `object-cover`, lazily loaded, with `alt=""`
because the title always sits beside it as real text. When there is no image it
still renders the box with a centred film glyph, so a row of posters keeps its
column instead of closing up around the gap.

### Mini App Pieces

Same shapes, borrowed palette. Chips are 2px squares that use the (Telegram-mapped)
brand as border, 10% tint and ink when active. The segmented control is a single
4px-cornered bordered strip with hairline dividers and a `secondary` fill on the
selected segment. The bottom sheet is the one exception to the corner rule in
spirit but not in value: it is `rounded-t-xl`, which resolves to the same 4px.
The bottom tab bar marks the active tab with a 2px top border and the accent as
text colour — never a filled background.

## Do's and Don'ts

### Do:

- **Do** keep amber on chrome and blue on action. Nav border, hover, logo, focus ring are amber; buttons, links and the `primary` status are blue.
- **Do** put near-black `#202020` text on every light-value fill (amber, gold, green, red) and white only on the purple. Every foreground/background pair in this system is verified at AA in both themes; a new pair must be measured, not assumed.
- **Do** reach for `--warning-ink` and `--queue-ink` when the gold or the purple has to be *text* rather than a fill.
- **Do** route every new status through `statusKind()` in `src/lib/status.ts` so the label, the chip and the progress bar agree.
- **Do** use `Label` from `status-label.tsx` for chips; `Badge` exists only for imported shadcn primitives.
- **Do** wrap every table in its own `overflow-x-auto` container and give columns `min-w-*`, so the page never scrolls horizontally at 360px.
- **Do** render machine strings — IDs, keys, URLs, versions, timestamps — in the mono `Data` component with tabular figures, in the fixed `YYYY-MM-DD HH:MM` shape.
- **Do** keep the header, sidebar and drawer on their dark values in both themes.
- **Do** give every control a visible focus treatment: the amber `2px solid var(--ring)` for buttons, links and chips; the blue border-and-glow for text fields.
- **Do** let the Mini App take its colours from `--tg-theme-*`, falling back to the `--app-*` snapshot of the ambient theme.

### Don't:

- **Don't** fill anything with the brand amber, and don't put a link or a button in it. It is chrome.
- **Don't** introduce the *arr orange as a warning colour; warning is the gold `#f9be03`, specifically so it cannot be read as the brand.
- **Don't** add a sixth type size, a display face, uppercase, or letter-spacing. A page title is 16px bold and that is the ceiling.
- **Don't** ask for a weight Lato does not ship. Only 400 and 700 are loaded; `font-medium` and `font-semibold` have no cut behind them and resolve silently to 400.
- **Don't** add a radius that is not 2px or 4px, and don't reintroduce pill-shaped chips or buttons.
- **Don't** put a shadow, gradient or hover-lift on an in-flow surface. Depth is a background value step plus a hairline.
- **Don't** centre the back office in a max-width column or cap its width.
- **Don't** build a row of hero-metric cards. Counts ride in the page header as chips.
- **Don't** render a list of records as cards. Records are table rows.
- **Don't** hardcode a colour in a component. Every colour in the build goes through a token, the field focus blue included (`--focus-field`); there are no exceptions left to copy.
- **Don't** set `whitespace-nowrap` on table cells; the content is titles and sentences, and wrapping is the default on purpose.
