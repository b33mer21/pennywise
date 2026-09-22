# Pennywise

A private, offline expense tracker that installs on an iPhone from Safari. No account, no server, no cost.
All data stays on the device (browser storage).

## Put it on your iPhone (free)

The app must be served over HTTPS to be installable. GitHub Pages does this for free.

1. Create a free account at github.com and make a **new public repository** (e.g. `pennywise`).
2. Click **Add file → Upload files**, drag in everything from this folder
   (`index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.webmanifest`, and the `icons` folder), then **Commit**.
3. Go to **Settings → Pages**, set **Source: Deploy from a branch**, branch **main**, folder **/ (root)**, and Save.
4. After a minute your app is live at `https://<your-username>.github.io/pennywise/`.
5. On the iPhone, open that link in **Safari**, tap **Share → Add to Home Screen**.
   It now opens full-screen like a native app and works offline.

Netlify Drop (app.netlify.com/drop) also works: drag the folder in and claim the site with a free account.

## Features

- **Multiple accounts** (e.g. one bank for spending, one for savings), each with its own
  currency, running balance and monthly budget
- Add, edit and delete income or expenses (amount, category, date, note); undo after delete
- Monthly summary, running balance, optional budget bar and daily average
- Stats: category donut chart, breakdown, comparison with last month, 6-month trend
- Search across all months
- Custom categories, per-account currency
- Export to CSV, back up and restore as JSON
- Light and dark mode; works offline
- **Automatic transaction logging from bank SMS alerts**, with live currency conversion
  for foreign-currency purchases (below) — no typing needed
- **Home-screen widget** showing balance and monthly spend (via Shortcuts, see below)

## Auto-logging bank SMS as transactions

**How it works:** a bank SMS arrives (COMBANK, NTB, or any bank) → an iOS Shortcut
automation (silent, no tap) parses it and posts it to a free Google Sheet, tagged with
which bank it came from → Pennywise pulls in anything new the next time you open the app,
routing each transaction to the matching account. The capture itself is instant and silent;
Pennywise catching up happens on next open, because an iPhone home-screen web app isn't
allowed to run in the background — nothing free or paid changes that on iOS.

One Google Sheet + one Apps Script deployment handles **every account** — each Shortcut
just tags its posts with an account name (`combank`, `ntb`, ...) that you set once per
account in Pennywise (Settings → Accounts → Edit → **Sync tag**).

### 1. Deploy the free backend (one-time, ~5 minutes)

Follow the instructions at the top of [`backend/Code.gs.txt`](backend/Code.gs.txt):
create a Google Sheet, paste that code into its Apps Script editor, set your own secret,
and deploy it as a Web App. You'll end up with two values:
- a **Web app URL** (ends in `/exec`)
- your **secret** (a random string only you know)

Paste both into Pennywise → Settings → **Automatic sync**.

### 2. Set each account's Sync tag

Settings → tap **Edit** on an account → **Sync tag** → e.g. `combank` for your Commercial
Bank account, `ntb` for Nations Trust Bank. This has to exactly match the `account` value
the Shortcut below sends, or synced transactions won't know where to go (they'll still be
logged in the Sheet, and Pennywise will warn you when a tag doesn't match anything).

### 3. Build the COMBANK Shortcut (one-time)

This is written from your actual SMS screenshots, so the regex matches real messages like:

> *Dear Cardholder, Purchase at UBER 852 LK for LKR 350.00 on 18/09/26 01:03 PM has been
> authorised on your debit card ending #7326.*
> *Credit for Rs. 590.00 to 8013822855 at 19:53 at DIGITAL BANKING DIVISION*
> *YOUR TRANSACTION AT UBER ON YOUR CARD ENDING WITH 7326 HAS BEEN CANCELLED.*

1. **Shortcuts app → Automation → + → Create Personal Automation → Message.**
   Choose **Any Contact**, turn on **Message Contains**, type `COMBANK`. If COMBANK's
   sender shows up as a selectable contact instead, pick that — it's a cleaner filter than
   text-matching.
2. Turn **off** "Ask Before Running" (also shown as "Notify When Run") so it fires silently.
3. **Add Action**, name the shortcut **"Log COMBANK SMS"**, and build:
   1. **Match Text** — Text: `Shortcut Input`. Regular Expression:
      ```
      (Purchase at|Credit for Rs\.|CANCELLED)
      ```
      This just detects which of the three message shapes it is; the branches below
      re-match with a shape-specific pattern to pull out the real fields.
   2. **If** `Matches has any value` → otherwise **Stop This Shortcut**.
   3. Inside the If, branch again on which keyword matched (three **If** blocks, or one
      with "Or" conditions per branch):

      **A. Purchase (debit):** Match Text again with
      ```
      Purchase at (.+?) for ([A-Z]{3}) ([\d,]+\.\d{2}) on (\d{2})/(\d{2})/(\d{2})
      ```
      Groups: 1 = merchant, 2 = currency, 3 = amount, 4/5/6 = day/month/year.
      - **Replace Text**: strip commas from Group 3 → `amount`.
      - **Text**: build the date as `20{Group 6}-{Group 5}-{Group 4}` (e.g. `2026-09-18`).
      - **Dictionary**: `secret`, `account`:`combank`, `type`:`debit`, `amount` (Number),
        `currency`: Group 2, `merchant`: Group 1, `date`, `raw`: `Shortcut Input`.
      - **Get Contents of URL** → your Apps Script URL, POST, JSON body = the Dictionary.

      **B. Credit:** Match Text again with
      ```
      Credit for Rs\. ([\d,]+\.\d{2})
      ```
      - Strip commas from Group 1 → `amount`.
      - **Dictionary**: `secret`, `account`:`combank`, `type`:`credit`, `amount` (Number),
        `currency`:`LKR`, `merchant`:*(leave blank)*, `date`:*(leave blank — the backend
        fills in today)*, `raw`: `Shortcut Input`.
      - **Get Contents of URL**, same as above.

      **C. Cancelled:** Match Text again with `AT (.+?) ON YOUR CARD` to grab the merchant.
      - **Dictionary**: `secret`, `account`:`combank`, `type`:`cancelled`, `amount`:`1`
        *(required by the backend but unused for this type)*, `merchant`: the match,
        `raw`: `Shortcut Input`.
      - **Get Contents of URL**, same as above.
4. Send yourself a test text containing one of the three phrases to confirm it reaches
   the Sheet (open the Sheet — a new row should appear within a few seconds), then open
   Pennywise and tap Settings → **Sync now**.

I built this from your screenshots but have no device to test the Shortcut itself on, so
**if a step doesn't match what you see, tell me and I'll adjust it.**

### 4. Build the NTB Shortcut

Good news — NTB's SMS are one consistent template for every transaction type, so this
Shortcut is simpler than COMBANK's. From your screenshots:

> *ONLINE FUND TRF VIA CEFTS was performed on your Account No. 2005xxxx9353 for LKR
> 55000.00 CR. Current Bal LKR 61196.57 Call 0114711411 for any inquiry.*
> *Other Bank Transfer (CEFTS) was performed on your Account No. 2005xxxx9353 for LKR
> 21800.00 DR. Current Bal LKR 39396.57 Call 0114711411 for any inquiry.*

(`CR` = money in, `DR` = money out — a single regex reads both cases directly, and it
already correctly ignores NTB's separate "Funds successfully transferred!" confirmation
message, since that one doesn't match the pattern and would otherwise double-count the
same transfer. I checked this against your exact messages before writing it, not just in theory.)

1. **Shortcuts app → Automation → + → Create Personal Automation → Message.**
   Choose **Any Contact**, turn on **Message Contains**, type `was performed on your Account`.
   If "NationsSMS" shows up as a selectable contact instead, pick that.
2. Turn **off** "Ask Before Running" so it fires silently.
3. **Add Action**, name the shortcut **"Log NTB SMS"**, and build:
   1. **Match Text** — Text: `Shortcut Input`. Regular Expression:
      ```
      (.+?) was performed on your Account No\. \S+ for LKR ([\d,]+\.\d{2}) (CR|DR)\. Current Bal LKR ([\d,]+\.\d{2})
      ```
      Groups: 1 = description, 2 = amount, 3 = `CR`/`DR`, 4 = current balance.
   2. **If** `Matches has any value` → otherwise **Stop This Shortcut**.
   3. **Replace Text**: strip commas from Group 2 → `amount`. Do the same for Group 4 → `balance`.
   4. **If** Group 3 is `CR` → set variable `type` to `credit`; **Otherwise** set it to `debit`.
   5. **Dictionary**: `secret`, `account`:`ntb`, `type` (the variable), `amount` (Number),
      `currency`:`LKR`, `merchant`: Group 1, `date`:*(leave blank)*, `raw`: `Shortcut Input`,
      `balance` (Number): the `balance` variable — this last one is optional; it's just
      logged in the Sheet so you can eyeball it against what Pennywise computes, it doesn't
      feed into the app directly.
   6. **Get Contents of URL** → your Apps Script `/exec` URL, POST, JSON body = the Dictionary.
4. Send yourself a test text or wait for a real one, check the Sheet for a new row, then
   Pennywise → Settings → **Sync now**. I ran this exact regex against your three real
   message samples and it matched every one correctly with the right amount and direction,
   so this should work as-is — tell me if anything doesn't land right.

### Currency conversion (COMBANK-only, approximate)

If a purchase isn't in LKR (e.g. `NETFLIX.COM ... for USD 3.99`), the Apps Script backend
converts it using **COMBANK's current published rate** at
[combank.lk/rates-tariff](https://www.combank.lk/rates-tariff#exchange-rates) — fetched
live, at the moment the SMS is synced or you manually add a foreign-currency entry.
That page only ever shows **today's** rate, with no historical lookup by date, so this is
always an approximation of what a past transaction actually cost, not the exact rate on
its own transaction date. A currency not listed on that page (Malaysian Ringgit, for one)
is stored unconverted and flagged with a ⚠ in the app so you can fix it manually.
For a manual entry, tap **"Different currency?"** in the add-entry sheet.

### Notes on the sync

- Categories are guessed from the merchant/SMS text (e.g. "Cargills" → Groceries, "KFC" →
  Food & Dining); anything unrecognized lands in "Other" — tap any entry to fix it.
- Auto-added entries show an "Auto · SMS" tag so you can tell them apart.
- A **cancelled** transaction (see COMBANK's "HAS BEEN CANCELLED" text) is logged in the
  Sheet for your own reference but never auto-added or auto-removed — Pennywise just
  surfaces a warning naming the merchant so you can delete the matching entry yourself,
  since there's no shared ID between COMBANK's messages to match them automatically.
- The Google Sheet is also a plain, human-readable backup of every transaction.
- Treat the Sync URL + secret like a password: anyone with both can write fake entries
  or read your transaction history. A JSON backup exported from Settings includes the
  secret, so keep backup files private too.

## Home-screen widget (balance + monthly spend)

A web app can't create a real iOS home-screen widget — that needs Xcode, which isn't free.
The workaround: Apple's own **Shortcuts widget**, which can run a shortcut and show its
text result on your home screen, at no extra cost and no extra app.

1. In Shortcuts, create a new shortcut named **"Pennywise Summary"**:
   - **Get Contents of URL** → GET →
     `<your Apps Script URL>?secret=<your secret>&action=summary&account=combank&startingBalance=<your account's starting balance, e.g. 50000>&startingDate=<its as-of date, e.g. 2026-09-01>`
     (use the same starting balance/date you entered for that account in Pennywise's
     Settings — the widget can't read Pennywise's own storage, so it's told separately;
     update both places if you ever change it).
   - **Get Dictionary Value** → Key: `text`, from the URL's response.
   - **Text** → set to that value (this is what the widget will display).
2. Long-press your home screen → **+** → search **Shortcuts** → add the small or medium
   widget → tap it → choose **"Pennywise Summary"**.
3. The widget refreshes on Apple's own schedule (not instantly), and shows something like:
   ```
   combank
   Balance: LKR 118,450.00
   Spent this month: LKR 45,230.00
   ```
   Repeat with a second widget + a second shortcut (`account=ntb`, its own starting values)
   for the other account.

## Notes

- **Back up regularly** (Settings → Back up). Clearing Safari website data or deleting the app removes everything.
- Data is per device. To move to a new phone: back up, then restore.
- After changing any file, bump `CACHE` in `sw.js` (e.g. `pennywise-v3`) so devices pick up the update.

## Run locally

```
python -m http.server 5173
```

Then open http://localhost:5173.
