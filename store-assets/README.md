# Store assets

Everything Google Play asks for in the **Main store listing** slot, generated
from real captures of the running app.

| File / folder                | Play Console slot        | Size      | Count |
| ---------------------------- | ------------------------ | --------- | ----- |
| `screenshots/`               | Phone screenshots        | 1080x1920 | 8     |
| `screenshots-tablet7/`       | 7-inch tablet            | 1200x1920 | 8     |
| `screenshots-tablet10/`      | 10-inch tablet           | 1600x2560 | 8     |
| `feature-graphic-1024x500.png` | Feature graphic        | 1024x500  | 1     |
| `play-icon-512.png`          | App icon                 | 512x512   | 1     |

`raw-screens/` and `raw-screens-tablet/` hold the plain device captures the
composers draw from. They are not uploaded.

**Uploading:** Play Console → Grow → Store presence → Main store listing. There
are separate upload slots for phone, 7-inch tablet and 10-inch tablet. Upload
each set in order 01-08.

## Screenshots

| #   | Screen        | Headline                     | Why it's here                                            |
| --- | ------------- | ---------------------------- | -------------------------------------------------------- |
| 01  | Dashboard     | Your pharmacy at a glance    | Most recognisable screen; also shown in search results   |
| 02  | New sale      | Bill a customer in seconds   | The job a pharmacist does 200 times a day                |
| 03  | Scan bill     | Scan the distributor's bill  | The differentiator — nothing in this bracket reads bills |
| 04  | Inventory     | Know exactly what you hold   | Core utility: batch, expiry and value                    |
| 05  | Expiry        | Never sell expired stock     | The pain that costs a pharmacy real money                |
| 06  | ShortBook     | Never run out of a fast mover| Reorder list built from actual sales                     |
| 07  | Receive stock | Goods received, line by line | Proof it reconciles against the supplier's bill          |
| 08  | Reports       | GST reports, ready to file   | Breadth close — the compliance worry                     |

Captured but unused, available in `raw-screens/` to swap in: `invoices`,
`products`.

All three sets are built to Play's rules: 320-3840px per side, longest side no
more than twice the shortest, 24-bit PNG with **no alpha channel** (PNGs with
transparency are rejected — the composer flattens every output), under 8MB.

The tablet sets are **not enlarged phone frames** — Play explicitly warns
against that. They are captures of the app at a real 800x1280 tablet viewport,
so the wider layout is genuinely what a tablet user sees.

### The rules these are built to

From published ASO research (AppFollow, Screenhance, TheAppLaunchpad, 2026):

| Rule                                         | How it's applied                          |
| -------------------------------------------- | ----------------------------------------- |
| ~90% of users never scroll past screenshot 3 | Broadest-appeal screens are 01-03         |
| Screenshot 1 appears in search results       | Dashboard — the most recognisable screen  |
| Headline must be legible at ~200px wide      | 88px type on a 1080px canvas              |
| Headline in the top third                    | Sits at y~180-330 of 1920                 |
| Captions <= 6 words, one message each        | Longest is 6 words                        |
| No empty states — show realistic data        | The till is seeded with a real, priced sale |
| Consistent background/type/palette           | Identical treatment across all eight      |
| Portrait 9:16, 1080px+, at least 4 shots     | 1080x1920, eight shots                    |

**Verify before uploading:** shrink a screenshot to 200px wide. If the headline
isn't instantly readable, the type is too small or the copy too long.

**Keep headlines honest.** Every one of the eight describes only what its screen
actually shows. Listings that overpromise draw refunds and one-star reviews.

## Feature graphic

`feature-graphic-1024x500.png` — built by `scripts/makeFeatureGraphic.mjs`. Run
with `--guides` for a copy with the safe zone and play-button dead zone drawn
on, for checking placement.

- **No alpha.** Play rejects PNGs with transparency in this slot; it is one of
  the two most common rejection causes. The script flattens before writing.
- **Nothing in the play-button dead zone.** If a promo video is attached later,
  Play draws a 96x96 button dead centre (x 464-560, y 202-298). All text sits
  left of x=464, so adding a video can never cover the headline.
- Uses the **same background and headline family as the screenshots**, because
  a feature graphic that looks like a separate ad banner makes the listing read
  as three different products.
- Two real app screens, not stock photography: dashboard in front, **scan bill**
  behind — that is the capability competitors in this bracket don't have, so it
  earns the second slot over inventory.
- The app icon is deliberately not repeated; Play already shows it alongside.

**Rules worth not breaking:** no store badges, no "Download now" or other
call-to-action copy, no price or ranking claims, nothing important within
70-80px of any edge.

## Design notes

- Background is **deep Plusveda green** (`#073C21` → `#0C7942`) with `#39D080`
  as the accent — straight off the app's own teal ramp, `#10A058` being the
  exact logo green.
- Dark on purpose. The app's UI is almost entirely white; on a pale background
  the device floats with nothing separating it. Dark green also reads as a
  serious business tool rather than a consumer utility, which is what a
  pharmacist scanning a search row is choosing between.
- The device is a **real phone body** (dark bezel, side buttons), not a bare
  rounded rectangle. Top-grossing listings all ship framed mockups; an unframed
  export is the mark of a listing nobody has revisited. The frame also gives the
  white app UI a hard edge against the green.
- Device occupies ~73% of the canvas width and bleeds off the bottom edge — it
  reads as depth rather than a floating rectangle.
- Headlines are two lines max. Three lines crowds the device.

## Regenerating

The device screens are real captures, not mockups.

```bash
npx expo start --web --port 8085      # terminal 1
node scripts/captureStoreScreens.mjs  # refreshes raw-screens*/
node scripts/makeStoreScreenshots.mjs # composes all three screenshot sets
node scripts/makeFeatureGraphic.mjs   # feature graphic
node scripts/makePlayIcon.mjs         # 512x512 icon
```

Two traps when refreshing the raw captures:

1. **The phone viewport must be a real phone WIDTH scaled up** — 390x844 at
   `deviceScaleFactor: 3` gives a 1170x2532 image of the *phone* layout.
   Setting the CSS viewport to 1170 renders the **desktop** layout at phone
   proportions, sidebar and all. The first run of this script did exactly that.
2. **Seed the till.** `seedSaleLine` adds an in-stock medicine and sets a
   quantity and price, because the sale screen otherwise shows either "No items
   yet" or a red out-of-stock line totalling ₹0 — neither is usable in a
   listing. It needs a product the demo pharmacy actually holds stock of; set
   `DEMO_PRODUCT` if the seed data changes.

Edit the `SHOTS` array in `makeStoreScreenshots.mjs` to change headlines, order,
or which screens are used.

## Worth doing next

Play Console → **Store listing experiments** — A/B test screenshot sets against
each other. Meaningful results need roughly 1,000 impressions per variant per
day for 14 days, so only start once traffic supports it.
