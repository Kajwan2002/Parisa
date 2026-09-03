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
| `npm run preview` | serve the production build locally |
| `npm run lint` | oxlint |
| `npm run icons` | regenerate PWA icons from `scripts/generate-icons.mjs` |

## Deploy (GitHub Pages)

1. Create a repo on GitHub and push this project to the `main` branch.
2. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` builds and publishes on every
   push to `main`. It sets `VITE_BASE=/<repo-name>/` automatically.
4. Open the published URL on the iPhone → **Share → Add to Home Screen**.

If you later attach a custom domain, change `VITE_BASE` in the workflow to `/`.

## Data model

Everything lives in one IndexedDB database (`parisa`) via Dexie:

- `categories` — name, emoji, colour, optional monthly budget
- `expenses` — amount (integer cents), category, note, date
- `income` — amount, source, date, `recurringMonthly`
- `settings` — currency, overall budget, theme accent, last backup time

A backup file is a JSON dump of all four tables (`src/db/backup.ts`).

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
    settings/     backup, currency, theme, reset
  lib/            money, dates, colour helpers
```
