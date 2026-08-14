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

## Verifying a change

`node tools/shootRedesign.mjs` photographs 12 screens at 1440×900 and 390×844
into `ui-audit/redesign/` (needs the web build on :8085 and `DEMO_PASSWORD` in
the environment). The pre-redesign baseline the client reacted to is in
`ui-audit/` for comparison.

Run `npm run validate` (tsc + eslint) before shipping.
