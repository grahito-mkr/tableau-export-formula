# Tableau Formula Export

A Tableau Dashboard Extension: export the selected worksheet to Excel with
**live Excel formulas** injected for calculated fields, instead of Tableau's
static computed values. Built with Next.js, deployable entirely on Vercel —
same structure as the AI Canvas extension.

Tableau natively exports a calculated field as a value only. This extension
rebuilds the export server-side and replaces mapped calculated-field columns
with real Excel formulas (e.g. `=C2/B2`), so the column recalculates when the
source cells are edited.

## How it works

```
Tableau dashboard
   │  getSummaryDataAsync({ maxRows: 0 })     ← full data, not paginated view state
   ▼
/extension (client)                            app/extension/page.tsx
   │  POST { sheetName, columns, rows } → /api/export
   ▼
/api/export (Node serverless)                  app/api/export/route.ts + lib/excelBuilder.ts
   │  reads lib/formulaConfig.json
   │  matches calc-field name → column, injects "=<expr>" per row (exceljs)
   ▼
.xlsx download
```

`getSummaryDataAsync` returns computed values only, so the extension can't know
a calc field's definition on its own — you declare it once in
`lib/formulaConfig.json`. That file is the single source of truth; the UI reads
it via `GET /api/export` to show which columns will become formulas.

The Python/openpyxl backend from earlier iterations is replaced by a
TypeScript `exceljs` builder so the whole thing runs as a Vercel serverless
function — no separate always-on host needed.

## Configure the formula mapping

`lib/formulaConfig.json` maps a **column name** (exactly as it appears in the
summary data) to an Excel formula template. Reference other columns with
`{Column Name}`:

```json
{
  "quantity per order": "{Quantity} / {Count of Orders}",
  "Nett Report": "{Gross Report} + {Bonus} + {Tax}"
}
```

At export time each `{Column Name}` resolves to that column's letter + the
current row, e.g. `{Quantity} / {Count of Orders}` → `=C2/B2`, `=C3/B3`, …
Names and references are **case-sensitive** and must match Tableau's field
names. An unmatched reference returns a 400 listing the available columns.

## Deploying on Vercel, connected to GitHub

1. Push to a new GitHub repo:
   ```bash
   cd tableau-formula-export
   git init
   git add .
   git commit -m "Initial commit"
   gh repo create your-org/tableau-formula-export --private --source=. --push
   ```
2. Import the repo in Vercel (New Project → pick the repo → Deploy). No env
   vars required.
3. After the first deploy, note your production URL and update it in **two**
   places, then redeploy:
   - `public/tableau-extension.trex` → `<source-location><url>`
   - (nothing else — the client calls `/api/export` on the same origin)

## Loading into Tableau

Download `public/tableau-extension.trex`, then in a dashboard drag in an
**Extension** object → **Access Local Extensions** → select the `.trex`.
Tableau will prompt once to allow **full data** access (required for
`maxRows: 0`).

## Local development

```bash
npm install
npm run dev        # http://localhost:3000/extension
```

To test the extension inside Tableau while developing, point the `.trex`
`<url>` at `http://localhost:3000/extension`.

## Notes / gotchas

- **Use it on aggregated crosstabs, not row-level data.** A ratio like
  `SUM([Quantity]) / COUNT([Orders])` is an aggregate. The `=C/B` formula only
  reconstructs it correctly when each row is already aggregated (one row per
  Category, etc.). On a raw row-level export the arithmetic won't reproduce the
  Tableau value.
- **Measure Names / Measure Values pivots** can change how columns arrive in
  the summary data. Check the exported header row and align config keys to the
  actual field names.
- CORS isn't an issue — the client and `/api/export` share one origin, the
  same reason the AI Canvas app proxies the Tableau lib through its own domain.

## Layout

```
tableau-formula-export/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                          landing (not used inside Tableau)
│   ├── extension/
│   │   └── page.tsx                      worksheet picker + export UI
│   └── api/
│       ├── export/route.ts               GET config · POST build xlsx
│       └── tableau-extensions-lib/route.ts   proxy for Tableau's JS lib
├── lib/
│   ├── excelBuilder.ts                   formula-injection logic (exceljs)
│   └── formulaConfig.json                calc-field → Excel formula mapping
├── public/
│   ├── tableau-extension.trex            manifest (source URL, permissions)
│   └── tableau-extensions.min.js         Tableau Extensions API library
├── global.d.ts                           window.tableau typings
├── next.config.mjs                       iframe headers for Tableau
├── vercel.json                           export function maxDuration
├── tsconfig.json
└── package.json
```
