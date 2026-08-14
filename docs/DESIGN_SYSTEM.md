# Plusveda design system — "quiet premium"

_Rev. 2026-08-14. Supersedes the ServRx-aligned system. Source of truth is
`src/shared/designSystem.ts`; this file explains the reasoning so the next
person doesn't undo it by accident._

## Why this exists

The client's verdict on the previous UI was "so much big card, looks like it was
made by juniors — make it like the big companies." That is a vague brief with a
precise cause. Measured against the running app:

| Thing       | Was                                                                     | Now                                                          |
| ----------- | ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| KPI card    | 104px tall, 18px padding, 26px number, coloured cap, tinted icon bubble | one shared panel, 68px cells, 21px number, hairline dividers |
| Page gutter | 24px everywhere                                                         | 24px desktop / 16px phone                                    |
| Page header | overline + 23px title + subtitle + 20px gap (~250px on a phone)         | title + optional subtitle, 14px gap; overline desktop-only   |
| Body text   | 14.5px                                                                  | 14px (13px in tables)                                        |
| Buttons     | 44 / 48 / 54px, with a shadow                                           | 28–40px desktop, 34–48px phone, flat                         |
| Inputs      | 50px                                                                    | 38px desktop / 46px phone                                    |
| Product row | 118px floating card                                                     | 44px desktop / 60px phone row on a shared surface            |
| Sidebar row | 48px                                                                    | 36px                                                         |
| Typefaces   | Poppins + Inter                                                         | Inter only                                                   |
| Empty state | 76px icon circle, 64px from the top                                     | 36px mark, 28px padding, inside its container                |

The dashboard's gradient "What would you like to do?" banner is gone. So are all
ten free-floating metric cards.

## The rules

**1. One typeface, three weights.** Inter at 400 / 500 / 600. Nothing is 700+.
A geometric display face (Poppins) beside data type is the single clearest
"consumer app" tell; Stripe, Linear, Shopify and Vercel all ship one grotesque
and get hierarchy from size and colour.

**2. Borders, not shadows.** A resting card is a white plane with a 1px hairline
on a tinted canvas (`surface.secondary` #F6F8F8). `elevation="base"` and
`"raised"` are both flat by design. Shadow is only for things that genuinely
float: menus, dialogs, the FAB.

**3. Radii stop at 12.** 4 / 6 / 8 (controls) / 10 (cards) / 12 (dialogs) / pill.
Mixed 14–22px radii on neighbouring surfaces is what makes a screen look
hand-assembled.

**4. The brand green is an accent, not a surface.** It marks the primary action,
the active nav row, links and focus — nothing else. No gradient banners, no
filled metric cards, no brand-tinted icon wells. Target roughly 90% neutral
pixels. Colour that isn't carrying a status meaning is noise.

**5. One primary button per view.** Everything else is `secondary` or `ghost`.

**6. A chip must mean something.** A tinted pill on every row of a 50-row list
is decoration, and it leaves nothing for a real exception to stand out against.
Quantities, prices, GST rates and identifiers are text. "Low stock", "Expired"
and a sale's status are chips.

**7. Numbers are tabular.** Spread the `numeric` token onto any `Text` showing
money or a quantity, or columns of figures wobble.

**8. Density is responsive, not a compromise.** A pointer wants a 32px button
and a 38px field; a thumb wants 44px and 46px. `Button` and `useControlHeight()`
pick per layout rather than shipping one wrong number for both.

## Tokens

```ts
space   4 8 12 16 20 24 32 40 48 64          // xs sm md lg xl 2xl 3xl 4xl 5xl 6xl
radius  xs 4 · sm 6 · md 8 · lg 10 · xl 12 · full
layout  screenPadding 24 · screenPaddingPhone 16 · cardPadding 16
        controlHeight 38 · controlHeightPhone 46
        rowHeight 44 · rowHeightPhone 60 · navRowHeight 36
```

Type scale (`<Text variant>`):

| variant      | size/line | use                          |
| ------------ | --------- | ---------------------------- |
| `display-sm` | 21/26     | KPI figures                  |
| `h1`         | 20/26     | page title                   |
| `h2`         | 17/24     | sub-page title               |
| `h3`         | 15/20     | card & section title         |
| `body`       | 14/20     | default                      |
| `body-sm`    | 13/18     | table cells, secondary lines |
| `label`      | 13/18 600 | row titles, buttons          |
| `caption`    | 12/16     | metric labels, hints         |
| `overline`   | 11/14     | eyebrows (desktop only)      |

## Components to reach for

- **`StatRow`** — headline metrics. One panel, hairline-divided, 2-up on phones.
  Use this instead of a grid of `StatTile`. Pass `accent` only when a metric is
  in a bad state _and_ the value is non-zero, or you get a red "0" every morning.
- **`ListRow` + `ListGroup`** — any list of records. Amount right, identifiers
  joined into `subtitle` with " · ", exceptional status in `right`.
- **`SectionHeader`** — the label above a block. Owns its own rhythm (20 above,
  8 below); don't hand-roll `h3` with margins.
- **`DataTable`** — desktop grids, with `mobileCard` returning a `ListRow`.
- **`Divider`**, **`EmptyState`**, **`Card compact`**.

`GradientHero` still exists for auth/marketing panels but is no longer used on
any product screen. Don't reintroduce it on a working surface.

## Mobile platform rules (2026)

These came out of a standards review, and each one has a reason that isn't taste.

**9. Primary navigation on phones is the bottom bar, not the drawer.** Google
formally deprecated the navigation drawer in Material 3 Expressive (2025) and
puts three to five destinations in a navigation bar at compact width. Nielsen
Norman's hidden-navigation study — reaffirmed June 2025 — found hiding primary
nav roughly halves discoverability. `PhoneTabBar` carries Home / Sell / Stock /
Receive / More; the drawer keeps the other eighteen sections.
_Not_ justified by thumb reachability: that literature traces to a 2013 study of
how people **grip** phones, illustrated by a chart its own data source later
captioned "incorrect". Both Hoober and NN/g point at the screen's **middle** as
most tappable. Bottom placement here is convention and discoverability.

**10. Never a fixed `height` on anything containing text.** RN's `<Text>` scales
with the OS setting by default and React multiplies fonts by up to **3.571×** at
iOS's largest accessibility size — and since RN 0.85, text overflowing a border
radius is _clipped_, so it vanishes rather than looking broken. Use `minHeight`
plus padding. `Text` applies a per-role ceiling (see `MAX_SCALE`); body copy and
page titles are deliberately uncapped so 200% still works for WCAG 1.4.4.

**11. 44pt is the floor for anything tappable on a phone.** The `xs` button
briefly shipped at 34px, which was under both Apple's 44pt and Material's 48dp.
Phone sizes now differ in padding and label size, never in target size.

**12. A status may never be signalled by colour alone.** WCAG 1.4.1 and Apple's
"Differentiate Without Color Alone" label criterion. `StatusChip` puts a glyph
on `danger` and `warning`; `success`/`info` stay bare so healthy rows don't get
decorated.

## Charts

`TrendChart` plots daily sales on the dashboard. The rules it follows, for any
chart added later:

- **Columns for daily totals, not a line.** A line implies a continuous quantity;
  daily sales are a discrete per-day total, and this shop trades on ~1 day in 3.
  A line drawn through genuine zeros invents a shape that isn't in the data.
- **One series → no legend.** The title names what is plotted. A legend box with
  one swatch just restates it.
- **Colour only on the marks; text always in ink tokens.** A value written in the
  series colour is unreadable.
- **Bars capped at 24px** with a 2px surface gap — never fill the slot.
- **Gridlines hairline, solid, recessive.** Never dashed.
- **Label selectively.** Axis endpoints and one readout, never a number per bar.
- **The axis top is not a data point.** `niceMax()` rounds the axis up for clean
  ticks; the readout shows the real peak. These were briefly the same value, and
  the chart advertised a ₹2,000 day the pharmacy never had.
- Touch targets span the full column slot, not the 9px bar.

The colour was checked with the shared palette validator (brand green on white:
lightness band, chroma, and 3:1 contrast all pass).

**The chart needs a backend deploy.** `sales.daily` was added to
`/dashboard/finance` in `23-jun26-medical-back`. The frontend guards on it, so
against an older backend the dashboard just renders without the chart.

## Dark mode — foundation only, switch is OFF

`darkPalette` / `darkAccents` (in `designSystem.ts`) and `useTheme()` /
`makeStyles()` (in `shared/useTheme.ts`) exist and are typechecked, but
`app.json` still pins `userInterfaceStyle: "light"`.

**Do not flip that line until the migration is done.** The app has 622
`palette.*` references across 93 files, and **51 of those files build
`StyleSheet.create` at module scope** — that runs once at import, before any
component mounts, so those styles cannot observe a scheme change. Converting
half of them yields white cards punched into a dark page, which is worse to read
than either theme done properly. `useTheme.ts` documents the per-file recipe;
do `shared/ui/*` first, then screens by traffic.

One finding worth keeping when it does ship: light-on-dark measures _worse_ for
proofreading accuracy in normally-sighted readers (Piepenbrock 2013/2014, via
NN/g). This app shows dosages and batch numbers. Dark mode belongs here as an
option that follows the OS — never as the default.

## Still open

- **Play Store target API 36 by 31 Aug 2026** (extension to 1 Nov via Console).
  API 36 forces edge-to-edge with no opt-out. Verify the built target — it could
  not be confirmed from the managed config in this repo.
- Dark mode migration (above).
- Bottom sheets in place of centre-anchored modals for pickers and forms.
  Note `@gorhom/bottom-sheet` is frozen mid-rewrite; prefer
  `react-native-screens`' `formSheet` for routes.
- Haptics beyond barcode scan. Caution: iOS disables the Taptic Engine while the
  camera is active, so scan feedback needs an audio fallback.

## Verifying a change

`node tools/shootRedesign.mjs` photographs 12 screens at 1440×900 and 390×844
into `ui-audit/redesign/` (needs the web build on :8085 and `DEMO_PASSWORD` in
the environment). The pre-redesign baseline the client reacted to is in
`ui-audit/` for comparison.

Run `npm run validate` (tsc + eslint) before shipping.
