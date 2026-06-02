# HE Industry Tracker — Manual Testing Guide (Phases 1–13)

> **Note:** AI-dependent features (document processing, insights generation) require an Azure OpenAI connection. All other features are fully testable with sample data. Steps that require a live API are marked **[requires LLM]**.

---

## Setup

1. Open a terminal in the project folder and run `npm run dev`
2. Open `http://localhost:5173` in your browser
3. On first load the app auto-seeds sample data (UBC + University of Toronto with financials, KPIs, priorities, sustainability metrics)

---

## 1. Dashboard

1. Click **Dashboard** in the left sidebar
2. Verify four stat cards appear: Institutions, Documents, Processed, Analysis Runs
3. Verify a Recent Activity list is visible beneath the cards

---

## 2. Institutions List

1. Click **Institutions** in the sidebar
2. Verify two institution cards appear: UBC and University of Toronto
3. Each card should show name, short code, province, type, and tag badges
4. Type `ubc` in the search box — only UBC should remain visible
5. Clear the search — both institutions reappear

### 2a. Add an Institution

6. Click **+ Add Institution** (top right)
7. Fill in: Name = `Test University`, Short Code = `TU`, Province = `Ontario`, Type = `University`
8. Click **Save** — toast "Institution saved" appears and the new card appears in the list

### 2b. Edit an Institution

9. On the Test University card, click the **pencil icon**
10. Change the name to `Test University Updated`, click **Save**
11. Card label updates immediately

### 2c. Delete an Institution

12. Click the **trash icon** on Test University Updated
13. Confirm in the dialog — card disappears and a success toast appears

### 2d. Click-through to Institution Detail

14. Click anywhere on the **UBC card** (not the edit/delete icons)
15. Browser navigates to `/institutions/<id>`

---

## 3. Institution Detail — Tabs

From the UBC detail page:

### 3a. Overview Tab

1. Click **Overview** (default tab)
2. Verify summary stat cards: latest revenue/expenses, document count, priority count
3. Verify a Recent Documents list is visible

### 3b. Financials Tab

4. Click **Financials**
5. Verify multi-year bar chart (Revenue vs Expenses) renders with Recharts
6. Verify Revenue Breakdown donut chart for the latest year
7. Verify the data table below shows rows with year-over-year % change arrows
8. Click **Export CSV** — a `ubc_financials.csv` file downloads; open it and verify column headers and data

### 3c. Add a Manual Financial Entry

9. Click **+ Add Entry**
10. Enter Fiscal Year = `2020`, Total Revenue = `500000000`, Total Expenses = `490000000`
11. Click **Save** — new row appears in the table and chart updates
12. Click the **pencil icon** on that row → edit Notes → Save
13. Click the **trash icon** on that row → confirm → row removed

### 3d. Strategic Priorities Tab

14. Click **Strategic Priorities**
15. Verify priority cards grouped by pillar with progress status badges and key initiatives lists
16. Use the **Status** filter dropdown — select "On Track" — only matching priorities shown
17. Click **Export CSV** — `ubc_priorities.csv` downloads

### 3e. Add a Manual Priority

18. Click **+ Add Priority**
19. Enter Priority Name = `Digital Infrastructure`, Pillar = `Operations`, Status = `On Track`
20. Click **Save** — new card appears in the list
21. Click the **pencil icon** → change status to `At Risk` → Save → badge updates
22. Click the **trash icon** → confirm → card removed

### 3f. KPIs Tab

23. Click **KPIs**
24. Verify KPI table rows grouped by category (Enrolment, Research, Financial, etc.)
25. Use the **Category** filter — select `Enrolment` — table filters
26. Click **Export CSV** — `ubc_kpis.csv` downloads (respects active filter)

### 3g. Add a Manual KPI

27. Click **+ Add KPI**
28. Enter KPI Name = `International Student Count`, Category = `Enrolment`, Value = `15000`, Unit = `students`, Fiscal Year = `2024`
29. Click **Save** — row appears in table
30. Click the **trash icon** on that row → confirm → removed

### 3h. Sustainability Tab

31. Click **Sustainability**
32. Verify GHG trend line chart renders
33. Verify data table with years, emissions, energy consumption, etc.
34. Click **Export CSV** — `ubc_sustainability.csv` downloads

### 3i. Add a Manual Sustainability Entry

35. Click **+ Add Year**
36. Enter Fiscal Year = `2020`, GHG Emissions Total = `85000`, Renewable Energy % = `42`
37. Click **Save** — row appears in table and chart updates
38. Click the **pencil icon** → edit water consumption → Save
39. Click the **trash icon** → confirm → removed

### 3j. Insights Tab

40. Click **Insights**
41. Without an API key, the tab will be empty or show a placeholder — this is expected
42. Click **Export CSV** — expect an error toast "No data to export"

### 3k. Print Report

43. Click the **Print Report** button (top right of institution header)
44. Browser print dialog opens
45. In print preview: sidebar and header are hidden; all 7 tab sections are visible as stacked content
46. The Print Report button itself is absent from the preview
47. Cancel the print dialog

---

## 4. Documents Tab (per institution)

From the UBC detail page, click the **Documents** tab:

1. Verify the pre-seeded document (UBC 2023 Annual Report) appears with status badge

### 4a. Upload a PDF — No LLM

2. Click **Upload Documents**
3. Select any `.pdf` file from your machine (e.g. a dummy PDF)
4. Upload progress shows — status goes to `Pending`, text is extracted, document appears in list with page count and word count
5. Click on the document row to open the **Document Detail slide-over**

### 4b. Document Detail Slide-over

6. Verify metadata grid: Institution, Status, Type, Fiscal Year, Pages, Words, Chunks, Uploaded
7. Verify **Re-process** button is enabled (status is Pending or Processed)
8. Verify **Delete** button is present
9. Click **Show raw text** — first chunk text appears in a scrollable pre block
10. Click **Hide raw text** — text collapses

### 4c. Extraction Review (sample document that has been processed)

11. Close the slide-over, then click on the **UBC 2023 Annual Report** (the seeded processed document)
12. Verify the **Extracted Data** section is visible and expanded (chevron up)
13. Verify groups: Financial Summaries, Strategic Priorities, Sustainability Metrics, KPI Datapoints — each with a row count
14. Click the **chevron** to collapse the section — content hides; click again to expand
15. Click the **Trash2 icon** on one KPI Datapoint — row disappears instantly and a toast confirms deletion
16. Navigate to the KPIs tab — the deleted KPI is gone there too

### 4d. Clear All Extractions

17. Back in the Document Detail slide-over for the processed document
18. Click **Clear All Extractions**
19. Confirm in the dialog — all four groups disappear; toast confirms
20. Navigate to Financials, KPIs, Priorities, Sustainability tabs — all rows from that document are gone

### 4e. Re-process [requires LLM]

21. With an Azure OpenAI key configured in Settings, click **Re-process** on a processed or failed document
22. Confirm the dialog (note the message mentions "will replace all existing extracted data")
23. The Classification Confirm Modal appears — verify dropdown lists all 8 document types
24. Verify the "Will populate: ..." hint updates when you change the document type
25. If confidence was below 60%, verify the amber warning banner is shown
26. Click **Confirm & Extract** — pipeline runs and Extracted Data section repopulates

### 4f. Re-process Idempotency Check [requires LLM]

27. Note the row counts in the Extracted Data section after processing completes
28. Click **Re-process** again on the same document and confirm
29. After completion, row counts in Extracted Data are identical — no duplicates created

### 4g. Delete a Document

30. Click **Delete** in the slide-over → confirm → document removed from list; slide-over closes

---

## 5. Global Documents List

1. Click **Documents** in the sidebar
2. Verify all documents across all institutions appear in the table
3. Use the **Institution** filter dropdown — select UBC — table filters
4. Use the **Status** filter — select `Processed` — table filters
5. Clear filters — all documents reappear
6. Click a row — Document Detail slide-over opens (same as above)

---

## 6. Analysis / Cross-Institution Comparison

1. Click **Analysis** in the sidebar

### 6a. Comparison View

2. Select 2 institutions using the institution picker (e.g. UBC + University of Toronto)
3. Select a metric category (e.g. Revenue)
4. Verify a side-by-side bar chart renders
5. Verify the data table beneath shows values per institution per year
6. Click **Export CSV** — `comparison_revenue_<date>.csv` downloads

### 6b. Themes View [partially requires LLM]

7. Scroll to the Themes section — if no analysis has been run, this will be empty (expected)

---

## 7. Settings

### 7a. Azure OpenAI Configuration

1. Click **Settings** in the sidebar
2. Enter any placeholder values in the Azure OpenAI fields (endpoint, API key, deployment)
3. Click **Save Settings** — toast "Settings saved"
4. Click **Test Connection** — with a real key this succeeds; with a placeholder it shows an error toast **[requires LLM]**

### 7b. DB Export and Import

5. Click **Export Database** — a `.db` binary file downloads
6. Click **Import Database**, select the just-downloaded `.db` file → page reloads with that data

### 7c. Bulk Institution Import

7. Click **Download CSV Template** — `institutions_template.csv` downloads
8. Open the template; it has headers: `name, short_code, province, institution_type, website, notes`
9. Add a row: `Simon Fraser University,SFU,British Columbia,University,,`
10. Save the file
11. Click **Import Institutions from CSV**, select the edited file
12. Toast shows "1 imported" — SFU appears in the Institutions page

### 7d. Duplicate Skip

13. Try importing the same CSV again
14. Toast shows "0 imported, 1 skipped (short codes: SFU)"

### 7e. Reset to Sample Data

15. Click **Reset to Sample Data** in the Danger Zone
16. Confirm — all data is cleared and the two seed institutions (UBC, U of T) are reloaded with full data
17. Toast confirms; navigating to Institutions shows only UBC and U of T

### 7f. Tag Management

18. Scroll to the Tags section
19. Click **+ Add Tag**, enter `Digital Transformation`, pick a colour, click Save
20. Tag appears in the list
21. Click the pencil icon → rename it → Save
22. Click the trash icon → confirm → tag removed

---

## 8. Error Boundary

1. (Developer test only) Temporarily add `throw new Error('test')` inside any component's render function
2. Navigate to that page — the red "Something went wrong" fallback card appears with the error message and a **Reload page** button
3. Click **Reload page** — app reloads normally
4. Remove the `throw` line

---

## 9. Global Search

1. Click the **search bar** in the top header (or press the search icon)
2. Type `UBC` — grouped results appear showing the matching institution
3. Type `Annual Report` — matching documents appear
4. Click a result — navigates directly to that institution or document

---

## 10. Edge Cases to Verify

| Scenario | Expected Result |
|---|---|
| Export CSV on empty Insights tab | Error toast "No data to export" |
| Upload a non-PDF file | File picker filters to `.pdf` only |
| Import CSV with missing `name` column | Row skipped silently, rest import |
| Import CSV with duplicate `short_code` | Skipped with short code listed in toast |
| Navigate to `/institutions/99999` (nonexistent) | Graceful empty state or redirect |
| Narrow browser window (~768px) on Institution Detail | Tab bar scrolls horizontally, all 7 tabs reachable |
| Re-process same document twice [requires LLM] | Row counts in Extracted Data stay the same (no duplicates) |
| Low confidence classification [requires LLM] | Amber warning banner visible in Classification Confirm Modal |
| Annual Report processed [requires LLM] | Extracted Data shows all four groups: financials, priorities, sustainability, KPIs |
