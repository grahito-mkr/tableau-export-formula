# Multi-Dashboard Formula Config Guide

## New Structure

The formula config now supports **multiple dashboards/worksheets** with different formula sets:

```json
{
  "Worksheet Name 1": {
    "Column Name": "formula template"
  },
  "Worksheet Name 2": {
    "Column Name": "formula template"
  },
  "__default": {
    "Column Name": "fallback formula"
  }
}
```

## How It Works

1. **When you select a worksheet** in the extension UI, it's sent to the backend
2. **Backend looks up** `formulaConfig[worksheetName]`
3. **If not found**, falls back to `__default`
4. **Only matched columns** get formulas; others export as values

## Example Config (Your Setup)

```json
{
  "CSAT Responses": {
    "Score": "{Satisfied Count} * 100 / {Total Count}",
    "Satisfaction Rate": "{Very Satisfied Count} * 100 / {Total Count}"
  },
  "Sales Dashboard": {
    "quantity per order": "{Quantity} / {Count of Orders}",
    "profit per order": "{Profit} / {Count of Orders}",
    "Revenue per Deal": "{Total Revenue} / {Deal Count}"
  },
  "Customer Journey": {
    "Conversion Rate": "{Customers Converted} * 100 / {Customers Visited}",
    "Avg Deal Value": "{Total Revenue} / {Deal Count}"
  },
  "__default": {
    "profit per order": "{Profit} / {Count of Orders}"
  }
}
```

## Adding a New Dashboard

### Step 1: Create the new worksheet in Tableau

Build your dashboard with the measures you need (raw values + aggregates).

### Step 2: Add its config entry

Edit `lib/formulaConfig.json` and add a new key with the **exact worksheet name**:

```json
{
  "CSAT Responses": { ... },
  "New Dashboard Name": {
    "Your Formula Column": "{Component A} + {Component B}",
    "Another Formula": "{X} / {Y} * 100"
  },
  "__default": { ... }
}
```

**Important:** Worksheet name must be **exactly** as it appears in Tableau (case-sensitive).

### Step 3: Deploy

Push to GitHub → Vercel redeploys → done. No code changes needed.

## Finding Exact Worksheet Names

In the extension UI, the dropdown shows all available worksheets. Your exact names are in that list.

If unsure, check the console or add temporary logging:
```typescript
// In app/extension/page.tsx
console.log("Available worksheets:", worksheets);
```

## Fallback Behavior (__default)

If you export from a worksheet **not** in the config, formulas in `__default` are applied.

This is optional—you can leave it empty:
```json
{
  "CSAT Responses": { ... },
  "__default": {}
}
```

Then unmapped worksheets export **only raw values**, no formulas.

## Testing a New Dashboard

1. **In Tableau**, add the new worksheet to a dashboard
2. **In the extension**, select it from the dropdown
3. **Check the UI** — formula columns should appear if configured
4. **Export** — verify formulas are injected in Excel

If formulas don't appear:
- Worksheet name doesn't match config (typo in JSON)
- Column names in export don't match config (use actual exported headers)
- Formula references a column that doesn't exist in export

## Column Name Matching

The `formulaConfig.json` keys must match **exactly** how Tableau exports them. If Tableau names the measure "Satisfied Count" but you write "satisfied_count", the formula won't apply.

Run one export to see the actual header row, then match the config to it.

## Example Workflow

**Your CSAT Responses worksheet exports:**
```
Company Name | Dealer Num | Satisfied Count | Total Count | Score
Acme Inc     | 100        | 15              | 18          | 83.33
```

**Config entry:**
```json
"CSAT Responses": {
  "Score": "{Satisfied Count} * 100 / {Total Count}"
}
```

**Excel output:**
```
Column E (Score) receives formula: =C2*100/D2
```

User edits C2 → E2 recalculates automatically.

## API Changes

### GET /api/export

**Old behavior:** Returns all formulas (flat structure)
```bash
curl /api/export
→ { "quantity per order": "...", "profit per order": "..." }
```

**New behavior:** Returns formulas for a specific worksheet
```bash
curl /api/export?worksheet=CSAT%20Responses
→ { "Score": "...", "Satisfaction Rate": "..." }

curl /api/export
→ { "CSAT Responses": {...}, "Sales Dashboard": {...}, "__default": {...} }
```

The extension UI automatically queries with the selected worksheet name.

## Backend Code Changes (Summary)

| File | Change |
|------|--------|
| `lib/excelBuilder.ts` | New `getFormulaMap(worksheetName)` function looks up by worksheet; `buildWorkbook()` passes sheet context |
| `app/api/export/route.ts` | GET now accepts `?worksheet=` query param |
| `app/extension/page.tsx` | Fetches formulas whenever worksheet selection changes |
| `lib/formulaConfig.json` | Restructured as nested object (worksheet → formulas) |

## Tips

1. **Copy-paste column names** from exported headers to avoid typos
2. **Keep formulas simple** — Excel can handle `{A}+{B}` but not deeply nested logic
3. **Test with small export** first before rolling out to production
4. **Document in Tableau** — add a note which columns have formulas so users aren't surprised
5. **Version control** — commit `formulaConfig.json` changes to track formula evolution

## Removing a Dashboard

Just delete its entry from the JSON:
```json
{
  "CSAT Responses": { ... },
  // "Old Dashboard": { ... },  ← deleted
  "__default": { ... }
}
```

Exports from that worksheet will fall back to `__default` (or no formulas if `__default` is empty).

## Questions?

Check the actual worksheet names in the extension dropdown. If a worksheet isn't in the config, check `__default`. If neither has the formula, it won't be applied—that's expected.
