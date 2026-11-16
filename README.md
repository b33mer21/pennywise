# Pennywise

A private, offline expense tracker that installs on an iPhone from Safari. No account, no server, no cost.
All data stays on the device (browser storage).

## Your setup

- **Live app:** https://b33mer21.github.io/pennywise/ — already deployed and up to date (confirmed live,
  new icon and black/white theme included).
- **Repo:** https://github.com/b33mer21/pennywise — GitHub Pages is already on, so nothing to configure there.

**On your iPhone:** open the live app link above in **Safari** → **Share** → **Add to Home Screen**.
It then opens full-screen like a native app and works offline. Everything below this point (the SMS
sync backend, the one SMS automation, and the widget) is what's left to set up on the phone.

### Checklist, in order

1. Add to Home Screen (above) — 1 minute.
2. [Deploy the free backend](#1-deploy-the-free-backend-one-time-5-minutes) — a Google Sheet + Apps Script, ~5 minutes.
3. Paste the resulting URL + secret into Pennywise → Settings → **Automatic sync**.
4. [Set each account's bank](#2-set-each-accounts-bank) (Commercial Bank / NTB).
5. [Build the one SMS automation](#3-build-the-sms-automation-one-time).
6. [Set up the home-screen widget](#home-screen-widget-balance--monthly-spend) (optional).

<details>
<summary>Deploying from scratch (for reference — not needed, yours is already live)</summary>

The app must be served over HTTPS to be installable. GitHub Pages does this for free.

1. Create a free account at github.com and make a **new public repository**.
2. Click **Add file → Upload files**, drag in everything from this folder
   (`index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.webmanifest`, and the `icons` folder), then **Commit**.
3. Go to **Settings → Pages**, set **Source: Deploy from a branch**, branch **main**, folder **/ (root)**, and Save.
4. After a minute your app is live at `https://<your-username>.github.io/<repo-name>/`.

Netlify Drop (app.netlify.com/drop) also works: drag the folder in and claim the site with a free account.
</details>

## Features

- **Multiple accounts** (e.g. one bank for spending, one for savings), each with its own
  currency, running balance and monthly budget
- Pick an account's bank from a searchable list of all licensed banks in Sri Lanka, and its
  logo is used as the account's icon
- Add, edit and delete income or expenses (amount, category, date, note); undo after delete
- Monthly summary, running balance, optional budget bar and daily average
- **Home tab**: every account's current balance, this month's money in and out, and the total
  across all accounts (grouped by currency)
- Settings live behind the gear icon at the top right of the Home tab
- Stats for **expenses or income**: donut chart and breakdown (by category for spending, by
  source for income), income / spent / net for the month, comparison with last month, 6-month trend
- Search across all months
- Custom categories, per-account currency
- Export to CSV, back up and restore as JSON
- Light and dark mode; works offline
- **Automatic transaction logging from bank SMS alerts**, with live currency conversion
  for foreign-currency purchases (below) — no typing needed
- **Home-screen widget** showing balance and monthly spend (via Shortcuts, see below)

## Auto-logging bank SMS as transactions

**How it works:** one iOS automation runs silently on every text you receive. It checks the
text on your phone, and only if it looks like a Commercial Bank or NTB transaction alert does
it send the message and its sender to a free Google Sheet. Everything else (personal texts,
OTP codes) never leaves your phone. The Sheet's script reads the alert (which bank, amount,
money in or out, merchant), and Pennywise pulls in anything new the next time you open it,
putting each transaction in the account set to that bank. The capture itself is instant and
silent; Pennywise catching up happens on next open, because an iPhone home-screen web app
isn't allowed to run in the background — nothing free or paid changes that on iOS.

This is the same idea as apps like Kiwi Money (one automation that hands every message to
the app, which picks out the bank ones). The difference is that a native app can receive the
message directly on the phone, while a web app needs the Google Sheet in between.

Supported so far: **Commercial Bank** (card purchases, ATM withdrawals, credits, cash deposits, cancellations) and **NTB**
(every "was performed on your Account" alert, including interest and withholding tax). A bank
message the script can't read yet is kept in the Sheet's **Unrecognised** tab so support can
be added later; it never becomes a transaction.

### 1. Deploy the free backend (one-time, ~5 minutes)

Follow the instructions at the top of [`backend/Code.gs.txt`](backend/Code.gs.txt):
create a Google Sheet, paste that code into its Apps Script editor, set your own secret,
and deploy it as a Web App. You'll end up with two values:
- a **Web app URL** (ends in `/exec`)
- your **secret** (a random string only you know)

Paste both into Pennywise → Settings → **Automatic sync**.

**Already deployed an older version?** Open the script (Extensions → Apps Script from the
Sheet), replace everything **except your own `SECRET` line** with the new code, save, then
**Deploy → Manage deployments → pencil → Version: New version → Deploy**. The URL and secret
stay the same, so nothing changes in Pennywise.

### 2. Set each account's bank

Settings (the gear on Home) → tap **Edit** on an account → **Bank** → choose **Commercial
Bank of Ceylon** or **Nations Trust Bank** → **Save**. Accounts that had the old `combank` /
`ntb` Sync tags were linked automatically, so check rather than redo.

### 3. Build the SMS automation (one-time)

If you built the older **Log COMBANK SMS** / **Log NTB SMS** automations, **turn them off or
delete them first** (Shortcuts → Automation → swipe left → Delete), or every transaction
will be logged twice.

1. **Shortcuts app → Automation → + → Message.**
   - **Message Contains:** type the single letter `a` (every bank alert contains one; this
     is how the automation catches all messages). Leave the sender as **Any Sender**.
   - Choose **Run Immediately** (not "Run After Confirmation"), and turn off **Notify When
     Run** if shown. Tap **Next** → **New Blank Automation**.
2. Add **Match Text**. Set its text to **Shortcut Input** (the message), and the pattern to:
   ```
   (?i)was performed on your Account|(Purchase|Withdrawal) at .+ for [A-Z]{3}|Credit for Rs\.|Deposit at .+ for Rs\.|ON YOUR CARD ENDING
   ```
   This is the privacy filter: only bank transaction alerts match.
3. Add **If** → **Matches** → **has any value**.
4. Inside the If, add **Get Contents of URL**:
   - URL: your Apps Script Web app URL (ends in `/exec`).
   - Tap **Show More** → Method **POST** → Request Body **JSON**, and add three **Text** fields:
     - `secret` → your secret
     - `message` → **Shortcut Input**
     - `sender` → **Sender**
5. Leave **Otherwise** empty, then tap **Done**.

To test, wait for a real bank alert (or forward one to yourself from another phone): a new row
should appear in the Sheet within a few seconds. Then open Pennywise, or Settings → **Sync now**.

I wrote this without an iPhone to try it on, and Shortcuts' wording shifts between iOS
versions, so **if a step doesn't match what you see, send a screenshot** and I'll adjust it.

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
- After changing any file, bump `CACHE` in `sw.js` (e.g. `pennywise-v5`) so devices pick up the update.

## Run locally

```
python -m http.server 5173
```

Then open http://localhost:5173.
