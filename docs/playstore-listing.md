# Plusveda — Play Console copy-paste pack

Every field the Play Console asks for, ready to paste. Fields are in the order
you meet them. Character limits are noted and every value below is inside them.

Written to match what the app actually does. Play rejects listings that promise
features the app lacks, and overpromising earns refunds and one-star reviews.

---

## 0. Values you must confirm first

| Field | Value used here | Check |
| --- | --- | --- |
| Developer / company | FiveM Infotech | taken from the AshShifa launch doc |
| Public support email | `5fivempvt@gmail.com` | same source |
| Privacy policy URL | `https://23-jun26-medical-front.vercel.app/privacy-policy.html` | live after the next Vercel deploy |
| Data deletion URL | `https://23-jun26-medical-front.vercel.app/delete-account.html` | same |
| Package name | `com.medstock.app` | locked forever once uploaded |
| Reviewer login | `play.reviewer@plusveda.app` / `PlusvedaReview#2026` | created and tested — see §5 |

---

## 1. Create app

| Field | Paste |
| --- | --- |
| App name (max 30) | `Plusveda: Pharmacy & Billing` |
| Default language | `English (India) – en-IN` |
| App or game | App |
| Free or paid | Free |

---

## 2. Store listing → App details

**App name** (max 30 — this is 28)

```
Plusveda: Pharmacy & Billing
```

**Short description** (max 80 — this is 65)

```
GST billing, batch & expiry stock control for your medical store.
```

**Full description** (max 4000 — this is ~2050)

```
Plusveda is billing and stock software for medical stores and pharmacies.

Ring up a sale in seconds, know exactly what is on the shelf, and stop losing money to expired stock.

BILLING
• Scan a pack or search by medicine name or salt
• GST worked out for you — CGST/SGST for local supply, IGST for outside the state
• Cash, card, UPI or credit
• Print or share the invoice, with your shop's signature or stamp on it

STOCK, BATCH AND EXPIRY
• Every medicine tracked by batch, expiry date and shelf location
• Nearest expiry is sold first, automatically
• Expiry report so short-dated stock goes back to the supplier while it still has value
• Damage and write-offs recorded with a reason

PURCHASE
• Photograph the distributor's bill and Plusveda reads it — product, batch, expiry, quantity, rate, MRP, discount and GST
• Goods-received note laid out like the bill itself, matching it to the paisa
• Purchase returns recorded against the original bill
• Supplier records and a cheque / PDC register

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

Plusveda runs on Android and in any browser, so the counter, the back office and the owner's phone all see the same stock.

Plusveda does not store patient records or prescriptions. It records what your pharmacy bought and sold.

Questions or help: 5fivempvt@gmail.com
```

**Graphics** — all in `store-assets/`

| Slot | File |
| --- | --- |
| App icon | `play-icon-512.png` |
| Feature graphic | `feature-graphic-1024x500.png` |
| Phone screenshots | `screenshots/01…08` |
| 7-inch tablet | `screenshots-tablet7/01…08` |
| 10-inch tablet | `screenshots-tablet10/01…08` |

---

## 3. Store settings

| Field | Value |
| --- | --- |
| App category | Business |
| Tags | Business tools, Finance & accounting |
| Email address | `5fivempvt@gmail.com` |
| Website (optional) | `https://23-jun26-medical-front.vercel.app` |
| External marketing | Leave unticked unless you plan Google Ads |

---

## 4. Policy → App content

### Privacy policy

```
https://23-jun26-medical-front.vercel.app/privacy-policy.html
```

### Ads

**No**, this app does not contain ads.

### App access

Choose **"All or some functionality is restricted"**, add one instruction set:

| Field | Paste |
| --- | --- |
| Name | `Full app access` |
| Username | `play.reviewer@plusveda.app` |
| Password | `PlusvedaReview#2026` |
| Any other instructions | see below |

```
Plusveda is business software for pharmacies, so all functionality is behind a login.

Sign in with the credentials above to reach the full app: billing, inventory, batch and expiry tracking, purchase entry, reports and team management. The account is a demo pharmacy pre-loaded with sample products, stock and invoices — no real customer or business data.

To try the bill-scanning feature: Receive Stock > Scan bill > From gallery, and choose any photograph of a pharmaceutical distributor's invoice.
```

> ⚠️ **This is the single most common reason a login-only app is rejected.**
> Test the credentials in a private browser window before submitting, and make
> sure the account is not at its signed-in-device limit.

### Content ratings

Answer the questionnaire. For Plusveda every category is **No** — no violence,
no sexual content, no profanity, no drugs (the questionnaire means recreational
drug *use*, not pharmacy stock), no gambling, no user-to-user communication, no
location sharing, no personal-information sharing between users. Expected
result: **Everyone / PEGI 3**.

Email for the certificate: `5fivempvt@gmail.com`

### Target audience and content

| Field | Value |
| --- | --- |
| Target age groups | **18 and over only** |
| Appeal to children | No |
| Ads/content aimed at children | No |

Do not tick any under-18 band — it pulls the app into the Families policy and
adds requirements you do not want.

### Data safety

**Does your app collect or share any of the required user data types?** → **Yes**
**Is all of the user data collected by your app encrypted in transit?** → **Yes**
**Do you provide a way for users to request that their data is deleted?** → **Yes**

Deletion URL:

```
https://23-jun26-medical-front.vercel.app/delete-account.html
```

Then declare these types. For every one: **Collected = Yes, Shared = No**,
**Processed ephemerally = No**, **Required (not optional)** unless stated,
purpose **App functionality** (plus **Account management** where noted).

| Category | Type | Purpose | Note |
| --- | --- | --- | --- |
| Personal info | Name | App functionality, Account management | |
| Personal info | Email address | App functionality, Account management | |
| Personal info | Phone number | App functionality, Account management | |
| Personal info | User IDs | App functionality, Account management | |
| Personal info | Other info | App functionality | pharmacy GSTIN and drug licence number |
| Financial info | Purchase history | App functionality | sales and purchase invoices |
| Photos and videos | Photos | App functionality | bill / pack / cheque photographs — mark **Optional** |
| App activity | Other actions | App functionality | audit trail of staff actions |
| App info and performance | Crash logs | App functionality | only if you add crash reporting later — otherwise omit |
| Device or other IDs | Device or other IDs | App functionality, Fraud prevention | sign-in session and device limit |

> **Photographs leave your servers.** Bill, pack and cheque images are sent to
> Google's Gemini API to read the printed text. Google acts as a service
> provider, so under Play's definitions this is *processing*, not *sharing* —
> but it is disclosed in §4 of the privacy policy, and it must stay disclosed.

### Government apps / Financial features / Health

| Question | Answer |
| --- | --- |
| Is this a government app? | No |
| Does it provide financial features? | **No** — it records invoices; it does not process payments, lend, or trade |
| Is it a health app? | **No** — no patient records, no prescriptions, no medical advice |

---

## 5. Reviewer account

Created already — `node scripts/createReviewer.mjs` in the backend folder.

```
Email:    play.reviewer@plusveda.app
Password: PlusvedaReview#2026
```

- Role **admin** in the MedStock Demo Pharmacy, so no screen is hidden. A staff
  account would hide Team & Access, Settings and Audit Logs, and a reviewer
  meeting screens that are not there could reasonably call the app broken.
- The pharmacy's **per-member device limit was raised to 20**. Every sign-in is
  a device and the plan allows three; a reviewer using an emulator, then a
  phone, then retrying after a timeout would be locked out by our own security
  feature — and "You're already signed in on 3 devices" reads exactly like a
  broken app to someone seeing it for the first time.
- Verified from a cold browser with `node tools/verifyReviewerLogin.mjs`:
  **10/10** — sign-in plus all nine screens named in the App access note.

Re-run the script any time to reset the password or clear its sessions.

---

## 6. Production release

| Field | Paste |
| --- | --- |
| Release name | `1.0.0` |
| Countries | India (add others later) |
| Rollout | **20%** staged |

**Release notes** (max 500 per language)

```
First release of Plusveda.

• GST billing with barcode and pack scanning
• Batch and expiry tracking, with nearest-expiry-first selling
• Scan a distributor's bill to enter goods received
• ShortBook reorder list built from your own sales
• Sales, expiry, warehouse and staff activity reports
• Staff accounts with per-person permissions
```

Full rollout cannot be undone except by shipping a new version, so start at 20%.

---

## 7. Before you press submit

- [ ] Both URLs deployed and opening the real pages, not the app shell
- [x] `RECORD_AUDIO` / `SYSTEM_ALERT_WINDOW` blocked — the build now fails if either survives the merge
- [ ] Screenshot 02 shows a real bill, not "No items yet"
- [x] Reviewer login tested from a cold browser (10/10)
- [ ] `.aab` built from the `production` profile, not `preview`
- [ ] Upload keystore and `signing.json` backed up somewhere outside the repo
