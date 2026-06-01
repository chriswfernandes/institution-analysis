import { query, execute, saveDb } from './db'
import type { DocumentRow, ChunkRow } from '../types'
import type { ChunkInput } from '../services/pdfService'

export interface NewDocument {
  institution_id: number
  filename: string
  page_count: number
  word_count: number
  raw_text: string
}

export function createDocument(doc: NewDocument): number {
  execute(
    `INSERT INTO documents (institution_id, filename, page_count, word_count, raw_text, processing_status)
     VALUES (?, ?, ?, ?, ?, 'processing')`,
    [doc.institution_id, doc.filename, doc.page_count, doc.word_count, doc.raw_text]
  )
  const rows = query<{ id: number }>('SELECT last_insert_rowid() as id')
  saveDb()
  return rows[0].id
}

export function saveChunks(documentId: number, chunks: ChunkInput[]): void {
  for (const c of chunks) {
    execute(
      'INSERT INTO document_chunks (document_id, chunk_index, chunk_text, token_estimate) VALUES (?, ?, ?, ?)',
      [documentId, c.chunk_index, c.chunk_text, c.token_estimate]
    )
  }
  saveDb()
}

export function getAllDocuments(): DocumentRow[] {
  return query<DocumentRow>(
    `SELECT d.*, i.name as institution_name
     FROM documents d
     JOIN institutions i ON i.id = d.institution_id
     ORDER BY d.upload_date DESC`
  )
}

export function getDocumentsByInstitution(institutionId: number): DocumentRow[] {
  return query<DocumentRow>(
    `SELECT d.*, i.name as institution_name
     FROM documents d
     JOIN institutions i ON i.id = d.institution_id
     WHERE d.institution_id = ?
     ORDER BY d.upload_date DESC`,
    [institutionId]
  )
}

export function getDocument(id: number): DocumentRow | null {
  const rows = query<DocumentRow>(
    `SELECT d.*, i.name as institution_name
     FROM documents d
     JOIN institutions i ON i.id = d.institution_id
     WHERE d.id = ?`,
    [id]
  )
  return rows[0] ?? null
}

export function getChunks(documentId: number): ChunkRow[] {
  return query<ChunkRow>(
    'SELECT * FROM document_chunks WHERE document_id = ? ORDER BY chunk_index',
    [documentId]
  )
}

export function updateDocumentStatus(id: number, status: string, errorMessage?: string): void {
  execute(
    'UPDATE documents SET processing_status = ?, processing_error = ? WHERE id = ?',
    [status, errorMessage ?? null, id]
  )
  saveDb()
}

export function updateDocumentClassification(
  id: number,
  documentType: string,
  academicYear?: string
): void {
  execute(
    'UPDATE documents SET document_type = ?, fiscal_year = ? WHERE id = ?',
    [documentType, academicYear ?? null, id]
  )
  saveDb()
}

export function deleteDocument(id: number): void {
  execute('DELETE FROM documents WHERE id = ?', [id])
  saveDb()
}
