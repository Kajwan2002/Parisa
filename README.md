# Parisa 🌸

A cute, simple expense tracker built as an installable web app (PWA). Track
spending by category, set gentle budgets, log income, and see where the money
goes with soft circular charts.

- **All data stays on the device** — no login, no cloud, fully private.
- Works **offline** once installed.
- **Backup / restore** from Settings (save the file to iCloud Drive for safety).
- Optionally, **the shared tab alone** can sync with one other phone — see below.

## Tech

React + TypeScript + Vite · Tailwind CSS v4 · Dexie (IndexedDB) · `vite-plugin-pwa`
· React Router. No backend.

## Develop

```bash
npm install
npm run dev
```

Other scripts:

| script | what it does |
| --- | --- |
| `npm run build` | type-check, generate icons, build to `dist/`, add `404.html` |
| `npm run dev:treasury` | dev server in the **Treasury** variant (dark) |
| `npm run build:treasury` | build the Treasury variant to `dist/mine/` (run `npm run build` first) |
| `npm run preview` | serve the production build locally |
| `npm run lint` | oxlint |
| `npm run icons` | regenerate PWA icons from `scripts/generate-icons.mjs` |

## Two builds, one codebase

One repo produces two installable apps that never drift apart:

| | app | theme | link | db |
| --- | --- | --- | --- | --- |
| hers | **Parisa** | Blossom (pink) | `…github.io/Parisa/` | `parisa` |
| his | **The Treasury** | Midnight (dark) | `…github.io/Parisa/mine/` | `parisa-treasury` |

The variant is chosen by `VITE_VARIANT=treasury` at build time (see `vite.config.ts`
`VARIANTS`); it sets the name, icon, colours, install scope, and IndexedDB name.
There is no in-app theme switcher — each build is locked to its look. The deploy
workflow builds both and publishes them together on one `git push`.

## The running balance

Months are not islands. Whatever is left at the end of one — or overdrawn —
is the opening figure of the next, so nothing resets on the 1st:

```
balance(month) = carried in + income(month) − cash spent(month)
```

The carry is counted from `balanceAnchor` (the month `startingBalance`
describes), defaulting to the earliest month that has any data, which makes the
whole history carry with no setup. Settings → Balance → *Correct the balance*
asks what's actually in the account **right now** and back-solves the figure for
the start of this month, so the dashboard immediately shows the number typed.

Only the dashboard carries. History and Budgets stay deliberately per-month —
"what did I spend in September" is still a monthly question. Spending uses the
same cash view as the rest of the dashboard (`cashOut` in `src/db/queries.ts`),
so fronting a shared bill lowers the balance by the whole amount and a repayment
puts it back.

## Shared-tab sync (optional)

The two apps can keep **only the shared tab** in step — who owes whom, and the
settlements. Expenses, categories, income and budgets never leave the phone.

How it works:

- One **secret gist** holds two files, `tab-her.json` and `tab-him.json`. Each
  phone writes only its own file, so there is nothing to conflict over.
- Contents are **AES-GCM encrypted** on the phone with a key that exists only
  inside the pairing code, so GitHub stores blobs it can't read.
- Rows merge **last-write-wins** on `updatedAt`; deletes leave a tombstone so the
  other phone can't resurrect them.
- Polling uses `If-None-Match`, and a 304 costs no rate limit.

The direction problem, and why it can't bite: locally a row says `paidBy: 'you'`,
which is meaningless to the other phone. On the wire everything is absolute
(`payer: 'her'`, `shares: { her, him }`), keyed to the `side` baked into each
build — Blossom is `her`, Midnight is `him`. Pairing refuses two devices that
claim the same side, and each row records who added it.

Setting it up (once): make a GitHub **classic** token with only the `gist` scope
and no expiry → in one app, Shared tab → Set up sync → paste it → send the
pairing code to the other phone → paste it there. Delete the message afterwards;
the code carries the token.

When a shared expense arrives from the other phone, your own share is also
logged as an expense here (toggle: *Log my share*). That is what keeps the
dashboard's cash view honest — see `computeDashboard` in `src/db/queries.ts`.

In dev, `window.__tabSync` (`src/sync/selftest.ts`) exercises all of this against
an in-memory gist, with no GitHub and no token.

## Deploy (GitHub Pages)

1. Create a repo on GitHub and push this project to the `main` branch.
2. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` builds and publishes on every
   push to `main`. It sets `VITE_BASE=/<repo-name>/` automatically.
4. Open the published URL on the iPhone → **Share → Add to Home Screen**.

If you later attach a custom domain, change `VITE_BASE` in the workflow to `/`.

## Data model

Everything lives in one IndexedDB database via Dexie:

- `categories` — name, emoji, colour, optional monthly budget
- `expenses` — amount (integer cents), category, note, date, optional links
- `income` — amount, source, date, `recurringMonthly`
- `recurring` — subscription rules that auto-log as expenses
- `tabEntries` / `tabSettlements` — the shared "running tab"
- `tabTombstones` — tab rows deleted here, so sync can't bring them back
- `syncState` — the tab-sync pairing (never included in a backup: it holds a token)
- `settings` — currency, overall budget, accent, partner name, starting
  balance + its anchor month, last backup time

A backup file is a JSON dump of every table (`src/db/backup.ts`).

## Project layout

```
src/
  app/            App shell, routing, bottom tab bar
  components/     Ring, DonutChart, BarChart, Sheet, MoneyKeypad, …
  db/             Dexie schema, seed data, queries/aggregates, backup
  features/
    dashboard/    monthly overview + hero chart
    expenses/     add/edit sheet, transaction list
    categories/   CRUD + inline "new category" form
    budgets/      overall + per-category budgets
    income/       salary / parents / gifts, recurring
    history/      monthly & yearly views
    insights/     friendly stat cards
    recurring/    subscriptions that auto-log
    tab/          shared "running tab" + settle-up
    settings/     backup, currency, accent, partner name, reset
  lib/            money, dates, colour helpers
  sync/           shared-tab sync: wire format, crypto, gist transport, engine
  theme/          Blossom / Midnight palettes + copy voice
```

## Deploy note (two apps)

`.github/workflows/deploy.yml` builds Parisa → `dist/`, then The Treasury →
`dist/mine/`, and publishes the combined folder. The root `404.html` routes an
unknown path to whichever app it belongs to.
