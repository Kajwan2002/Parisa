# Parisa 🌸

A cute, simple expense tracker built as an installable web app (PWA). Track
spending by category, set gentle budgets, log income, and see where the money
goes with soft circular charts.

- **All data stays on the device** — no login, no cloud, fully private.
- Works **offline** once installed.
- **Backup / restore** from Settings (save the file to iCloud Drive for safety).

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
- `settings` — currency, overall budget, accent, partner name, last backup time

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
  theme/          Blossom / Midnight palettes + copy voice
```

## Deploy note (two apps)

`.github/workflows/deploy.yml` builds Parisa → `dist/`, then The Treasury →
`dist/mine/`, and publishes the combined folder. The root `404.html` routes an
unknown path to whichever app it belongs to.
