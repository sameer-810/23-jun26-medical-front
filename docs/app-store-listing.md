# Plusveda — App Store listing

Everything App Store Connect asks for, ready to paste. Lengths are checked
against Apple's limits. Written 16 Sep 2026 for version 1.0.

**No prices anywhere on iOS.** Plusveda is sold on the website, which Apple
allows for a free companion app (guideline 3.1.3(f)) only while the app and its
listing contain no prices and no call to action to buy. This text is the Play
description with that removed, plus two corrections: the Play text claimed
Plusveda "does not store patient records or prescriptions", but the app now has
a prescription register, and it listed only Android and the browser.

## App Information

| Field | Value | Length |
| --- | --- | --- |
| Name | Plusveda: Pharmacy Billing | 26/30 |
| Subtitle | GST billing, stock & expiry | 27/30 |
| Primary category | Business | |
| Secondary category | Productivity | |
| Bundle ID | com.medstock.app | |
| SKU | plusveda-ios | |

## Version page

**Promotional text** (136/170)

```
Bill customers in seconds, read a distributor's bill from a photo, and sell the nearest expiry first. Built for medical stores in India.
```

**Keywords** (86/100)

```
pharmacy,medical store,chemist,GST billing,inventory,expiry,batch,invoice,stock,retail
```

| Field | Value |
| --- | --- |
| Support URL | https://portal.plusveda.online/privacy-policy.html |
| Marketing URL | leave empty (plusveda.app did not resolve on 16 Sep 2026) |
| Privacy Policy URL | https://portal.plusveda.online/privacy-policy.html |
| Copyright | 2026 FiveM Infotech Private Limited |

**Description** (2100/4000)

```
Plusveda is billing and stock software for medical stores and pharmacies.

Ring up a sale in seconds, know exactly what is on the shelf, and stop losing money to expired stock.

BILLING
• Scan a pack or search by medicine name or salt
• GST worked out for you: CGST/SGST for local supply, IGST for outside the state
• Cash, card, UPI or credit
• Print or share the invoice, with your shop's signature or stamp on it

STOCK, BATCH AND EXPIRY
• Every medicine tracked by batch, expiry date and shelf location
• Nearest expiry is sold first, automatically
• Expiry report so short-dated stock goes back to the supplier while it still has value
• Damage and write-offs recorded with a reason

PURCHASE
• Photograph the distributor's bill and Plusveda reads it: product, batch, expiry, quantity, rate, MRP, discount and GST
• Goods-received note laid out like the bill itself, matching it to the paisa
• Purchase returns recorded against the original bill
• Supplier records and a cheque / PDC register

PRESCRIPTION MEDICINES
• Schedule H and H1 medicines flagged on every product
• Record the doctor and prescription at the till before a scheduled medicine is sold

REORDERING
• ShortBook builds your reorder list from what you actually sell
• Add any medicine to it in one tap while billing
• Turn the list into a purchase order

MEDICINE LOOKUP
• Search a catalogue of over two lakh medicines by brand, salt or manufacturer
• Find a same-salt substitute when something is out of stock

REPORTS
• Sales, expiry, warehouse and staff activity
• Export to Excel or PDF

YOUR TEAM
• Add staff and choose exactly what each person can see and do
• Full audit trail of who did what, and when
• Limit how many devices one account can be signed in on

Plusveda runs on iPhone, iPad, Android and in any browser, so the counter, the back office and the owner's phone all see the same stock.

A Plusveda account is required. New pharmacies can request access from the sign-in screen, and our team sets up each workspace. You can delete your account at any time from Profile.

Questions or help: 5fivempvt@gmail.com
```

## Screenshots

Upload in this order. All are real captures of the current app, no alpha.

- iPhone 6.5-inch, 1284x2778: `store-assets/app-store/iphone-6.5/01…08`
- iPad 13-inch, 2064x2752: `store-assets/app-store/ipad-13/01…08`

1. `01-dashboard.png`
2. `02-sale.png`
3. `03-products.png`
4. `04-inventory.png`
5. `05-expiry.png`
6. `06-shortbook.png`
7. `07-receive.png`
8. `08-reports.png`

Regenerate: seed the backend into a local database, run
`npx expo start --web --port 8085` against it, then
`node scripts/captureStoreScreens.mjs --targets=ios65,ipad13` and
`node scripts/makeStoreScreenshots.mjs --only=ios65,ipad13`.

## App Review notes

Sign-in required: reset the reviewer login first with
`node scripts/createReviewer.mjs --password '<new password>'` in the backend,
and enter it only in App Store Connect.

```
Plusveda is billing and inventory software for pharmacies in India: GST invoices, stock by batch and expiry, purchase entry, cheques and reports.

This login is an Admin of a demo pharmacy loaded with sample products, stock and invoices. No real business data.

Plusveda is a business service. Pharmacies subscribe on our website, and our team activates each workspace. The iOS app is a free companion to that service: it contains no purchasing and no prices or links to buy, consistent with guideline 3.1.3(f). A new sign-up in the app creates a request that our team reviews, which is why a ready-made demo login is provided.

Account deletion: Profile > Delete account, at the bottom.

Photos of bills, medicine packs and cheques are read by Google Gemini to fill in forms. The app asks for permission before the first photo is sent.
```
