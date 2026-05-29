import { query, execute, saveDb } from './db'
import type { AnalysisRunRow, FindingRow, ParsedFinding } from '../types'

export function createAnalysisRun(institutionId: number, runType: string, documentIds?: number[]): number {
  execute(
    `INSERT INTO analysis_runs (institution_id, run_type, status, documents_included) VALUES (?, ?, 'Running', ?)`,
    [institutionId, runType, documentIds ? JSON.stringify(documentIds) : null]
  )
  const rows = query<{ id: number }>('SELECT last_insert_rowid() as id')
  saveDb()
  return rows[0].id
}

export function updateAnalysisRunStatus(runId: number, status: string, completedAt?: string): void {
  execute(
    `UPDATE analysis_runs SET status = ?, completed_at = ? WHERE id = ?`,
    [status, completedAt ?? null, runId]
  )
  saveDb()
}

export function saveFindings(runId: number, institutionId: number, findings: ParsedFinding[]): void {
  for (const f of findings) {
    execute(
      `INSERT INTO analysis_findings (analysis_run_id, institution_id, finding_type, title, narrative, priority_rank, relevant_service_line)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [runId, institutionId, f.finding_type, f.title, f.narrative, f.priority_rank ?? null, f.relevant_service_line ?? null]
    )
  }
  saveDb()
}

export function getAnalysisRuns(institutionId: number): AnalysisRunRow[] {
  return query<AnalysisRunRow>(
    `SELECT ar.*, COUNT(af.id) as finding_count
     FROM analysis_runs ar
     LEFT JOIN analysis_findings af ON af.analysis_run_id = ar.id
     WHERE ar.institution_id = ?
     GROUP BY ar.id
     ORDER BY ar.started_at DESC`,
    [institutionId]
  )
}

export function getFindingsByRun(runId: number): FindingRow[] {
  return query<FindingRow>(
    `SELECT * FROM analysis_findings WHERE analysis_run_id = ? ORDER BY priority_rank ASC NULLS LAST, id ASC`,
    [runId]
  )
}

export function getLatestFindings(institutionId: number): FindingRow[] {
  const runs = query<{ id: number }>(
    `SELECT id FROM analysis_runs WHERE institution_id = ? AND status = 'Complete' ORDER BY completed_at DESC LIMIT 1`,
    [institutionId]
  )
  if (runs.length === 0) return []
  return getFindingsByRun(runs[0].id)
}
