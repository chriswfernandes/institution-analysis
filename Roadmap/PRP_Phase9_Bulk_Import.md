# PRP — Phase 9: Bulk Institution Import from CSV

## Context

Phases 1–8 are complete. Institutions can be added one at a time via the slide-over form, but users who maintain a spreadsheet of 20–100 Canadian post-secondary institutions need a way to load them all at once. This phase adds a CSV bulk import to the Settings page, along with a template download so users know the exact expected format.

---

## Implementation

### Settings page (`src/pages/Settings.tsx`)

Add a new section **"Bulk Import"** between the Database Management section and the Tag Management section.

**Template download button** — "Download CSV Template"
- Generates and downloads a CSV file with headers only: `name,short_code,province,institution_type,website,notes`
- Example row included as a comment or second row: `University of British Columbia,UBC,BC,University,https://www.ubc.ca,`
- Uses the same `downloadCsv()` utility from `src/utils/exportCsv.ts` (Phase 8)

**Import button** — "Import Institutions from CSV"
- Hidden `<input type="file" accept=".csv">` triggered by the button click (same pattern as the DB import button already in Settings)
- On file selected: parse the CSV, validate rows, insert valid rows, show result toast

### CSV parsing (inline in Settings, no library needed)

```ts
function parseCsvRows(text: string): Record<string, string>[]
```

- Split on `\n`, skip empty lines and lines starting with `#`
- First non-empty line = headers (trim whitespace, lowercase)
- Required headers: `name`, `short_code` — reject entire file if missing, show error toast
- Optional headers: `province`, `institution_type`, `website`, `notes`
- Handle quoted fields (values wrapped in `"` that may contain commas)

### Validation rules (per row)

- `name` must be non-empty
- `short_code` must be non-empty, ≤20 chars, alphanumeric + hyphens only (regex: `/^[A-Z0-9\-]+$/i`)
- Skip rows where `short_code` already exists in the database (count as "skipped")
- All other fields optional — store `null` if blank

### Insertion

For each valid row:
```ts
execute(
  'INSERT INTO institutions (name, short_code, province, institution_type, website, notes) VALUES (?, ?, ?, ?, ?, ?)',
  [name, short_code.toUpperCase(), province || null, institution_type || null, website || null, notes || null]
)
```

Call `saveDb()` once after all rows are processed.

After import: refresh institutions in global context (`dispatch({ type: 'SET_INSTITUTIONS', payload: ... })`).

### Result toast

Show a single info/success toast summarising the outcome:
- All imported: `"12 institutions imported successfully"`
- Mixed: `"9 imported, 3 skipped (duplicate short codes: UBC, UOFT, MCGILL)"`
- All skipped: error toast `"No institutions imported — all short codes already exist"`
- Parse failure (missing required headers): error toast `"CSV missing required columns: name, short_code"`

---

## Reuse Notes

- DB import file input pattern: `src/pages/Settings.tsx` (the existing `importRef` + hidden input pattern)
- `execute()` + `saveDb()` from `src/db/db.ts`
- `downloadCsv()` from `src/utils/exportCsv.ts` (Phase 8)
- `useToast` from `src/components/useToast.ts`
- `useAppDispatch` from `src/context/AppContext.tsx` — to refresh institutions after import

---

## Deliverable

1. `npm run build` — no TypeScript errors
2. Settings → "Download CSV Template" → downloads `institutions_template.csv` with correct headers
3. Prepare a CSV with 3 new institutions → Settings → "Import Institutions from CSV" → toast shows "3 institutions imported successfully" → all 3 appear in the Institutions page
4. Re-import the same CSV → toast shows "3 skipped (duplicate short codes: ...)"
5. Upload a CSV missing the `name` column → error toast "CSV missing required columns: name"
6. Upload a CSV where 2 rows are valid and 1 has an empty `short_code` → toast shows "2 imported, 1 skipped"
7. Imported institutions persist after page reload
