# PRP — Phase 2: Document Ingestion (No AI)

## Context

Phase 1 is complete. The app has: working navigation, sql.js database, institution CRUD, settings, and tag management.

This is **Phase 2**. Add PDF upload, text extraction with `pdfjs-dist`, document chunking, and document list views. No AI calls yet — documents are stored with `processing_status = "Pending"` after upload.

After this phase, a consultant can upload PDFs to an institution, see the extracted text, and browse all documents across institutions.

---

## Install New Dependencies

```bash
npm install pdfjs-dist
```

Configure pdfjs worker in `src/main.tsx` or a dedicated setup file:
```ts
import * as pdfjsLib from 'pdfjs-dist'
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()
```

---

## PDF Service

### File: `src/services/pdfService.ts`

```ts
interface ExtractionResult {
  rawText: string
  pageCount: number
  wordCount: number
  chunks: Chunk[]
}

interface Chunk {
  chunkIndex: number
  chunkText: string
  tokenEstimate: number
}

// Extract full text from a PDF File object
export async function extractPdfText(file: File): Promise<ExtractionResult>

// Split text into chunks (~12,000 chars each, 200-char overlap)
export function chunkText(text: string): Chunk[]
```

**`extractPdfText` implementation:**
1. Read the file as `ArrayBuffer`
2. Load with `pdfjsLib.getDocument({ data: arrayBuffer })`
3. Iterate all pages, call `page.getTextContent()`, join `TextItem.str` values with spaces
4. Concatenate all page texts (add `\n\n` between pages)
5. Compute word count as `text.split(/\s+/).filter(Boolean).length`
6. Call `chunkText()` to produce chunks
7. Return the full result

**`chunkText` implementation:**
- Chunk size: 12,000 characters
- Overlap: 200 characters
- Token estimate: `Math.ceil(chunkText.length / 4)` (rough 4-chars-per-token estimate)
- Loop: `start = 0`, push `text.slice(start, start + 12000)`, advance `start` by `11800` (12000 - 200 overlap)

---

## Document Database Operations

### File: `src/db/documentDb.ts`

Export these functions (all use parameterized queries via `execute()` and `query()` from `src/db/db.ts`):

```ts
// Insert a new document record, return the new document id
export function createDocument(doc: {
  institution_id: number
  filename: string
  page_count: number
  word_count: number
  raw_text: string
}): number

// Insert all chunks for a document
export function saveChunks(documentId: number, chunks: Chunk[]): void

// Get all documents (with institution name join) for list view
export function getAllDocuments(): DocumentRow[]

// Get documents for a specific institution
export function getDocumentsByInstitution(institutionId: number): DocumentRow[]

// Get a single document by id
export function getDocument(id: number): DocumentRow | null

// Get all chunks for a document
export function getChunks(documentId: number): ChunkRow[]

// Update document processing status and optionally error message
export function updateDocumentStatus(
  id: number,
  status: 'Pending' | 'Processing' | 'Processed' | 'Failed',
  error?: string
): void

// Update document type and fiscal year (after classification)
export function updateDocumentClassification(
  id: number,
  documentType: string,
  fiscalYear: string | null
): void

// Delete a document and its chunks
export function deleteDocument(id: number): void
```

Types:
```ts
interface DocumentRow {
  id: number
  institution_id: number
  institution_name: string  // joined from institutions table
  filename: string
  document_type: string | null
  fiscal_year: string | null
  upload_date: string
  processing_status: string
  processing_error: string | null
  page_count: number | null
  word_count: number | null
}

interface ChunkRow {
  id: number
  document_id: number
  chunk_index: number
  chunk_text: string
  token_estimate: number | null
}
```

---

## Processing Pipeline State

### File: `src/context/ProcessingContext.tsx`

Track active document processing state globally:

```ts
interface ProcessingJob {
  documentId: number
  filename: string
  institutionName: string
  step: ProcessingStep
  error?: string
}

type ProcessingStep =
  | 'extracting_text'
  | 'chunking'
  | 'pending'
  | 'classifying'
  | 'awaiting_confirmation'
  | 'extracting_data'
  | 'writing_db'
  | 'generating_insights'
  | 'complete'
  | 'failed'
```

Export `useProcessing()` hook. The pipeline in Phase 2 only reaches `'pending'` — AI steps are Phase 3.

---

## Upload Flow

### File: `src/components/DocumentUpload.tsx`

A component used inside the institution detail Documents tab and accessible from the global Documents page.

Props: `institutionId: number`, `onComplete: () => void`

UI:
- Dashed drop-zone box: "Drop PDF files here or click to browse" — accepts `.pdf` only, `multiple`
- While processing: show a per-file progress list with filename + current step label
- On success: show success toast, call `onComplete()`
- On error: show error toast with filename

Upload logic (called for each file):
1. Create document record via `createDocument()` with `processing_status = 'Pending'`
2. Update processing job step to `'extracting_text'`
3. Call `extractPdfText(file)` — await
4. Update processing job step to `'chunking'`
5. Save chunks via `saveChunks()`
6. Update document `raw_text`, `page_count`, `word_count` in DB
7. Update processing job step to `'pending'`
8. Update document status to `'Pending'` (stays here until Phase 3 AI kicks in)
9. Call `saveDb()`

---

## Processing Status Bar

### File: `src/components/ProcessingStatusBar.tsx`

A persistent banner shown at the bottom of the page (above toasts) when any document is actively being processed (step is not `complete` or `failed`).

Shows: `"Processing: {filename} — {step label}"` with a spinner icon.

Step labels:
- `extracting_text` → "Extracting text..."
- `chunking` → "Chunking text..."
- `pending` → "Queued"
- `classifying` → "Classifying document..."
- `awaiting_confirmation` → "Awaiting your confirmation"
- `extracting_data` → "Extracting data..."
- `writing_db` → "Saving to database..."
- `generating_insights` → "Generating insights..."
- `complete` → "Complete"
- `failed` → "Failed"

---

## Updated Pages

### `src/pages/Documents.tsx` (replace placeholder)

Full global document list:
- Page header: "Documents" + "Upload Document" button (opens upload slide-over — picks institution first)
- Filter bar: filter by institution (dropdown), document type (dropdown), status (dropdown)
- Table columns: Institution, Filename, Type, Fiscal Year, Upload Date, Status (badge), Actions
- Status badge using `<StatusBadge>`
- Clicking a row opens `<DocumentDetailPanel>`
- Empty state if no documents

### `src/pages/InstitutionDetail.tsx` — Documents Tab

Replace placeholder with:
- "Upload Document" button → opens `<DocumentUpload institutionId={id} />`
- Table of documents for this institution: Filename, Type, Fiscal Year, Upload Date, Status, Actions (View, Delete, Re-process [greyed out in Phase 2])
- Delete confirmation dialog

### File: `src/components/DocumentDetailPanel.tsx`

Slide-over showing:
- Filename, institution name, upload date
- Document type badge (or "Unclassified"), fiscal year, status badge
- Page count, word count
- Processing error message (if `status = Failed`)
- "View Raw Text" toggle — reveals a `<pre>` block with the raw text (monospace, max-h-96 overflow-scroll)
- "Re-process" button (disabled/greyed out in Phase 2, active in Phase 3)
- "Delete Document" button with confirmation

---

## Context Updates

Add to `AppContext` (or keep in `ProcessingContext`):
- `documents: DocumentRow[]` array
- Action `SET_DOCUMENTS`
- Load documents on `dbReady`

The institution detail page and global documents list both subscribe to this.

---

## Non-Functional

- PDF extraction runs async — UI never freezes (use `await` with React state updates between steps)
- Large PDFs (100+ pages): extraction may take up to 10 seconds — show spinner the whole time
- All SQL writes parameterized
- `saveDb()` called after every write

---

## Deliverable

After Phase 2:
1. Institution Documents tab has an upload button; dropping a PDF extracts text and saves to DB
2. Global Documents page shows all uploaded documents with filter/sort
3. Document detail slide-over shows metadata, processing log, and raw text toggle
4. Processing status bar appears during upload

Commit message: `feat(phase-2): PDF upload, text extraction, chunking, document list views`
