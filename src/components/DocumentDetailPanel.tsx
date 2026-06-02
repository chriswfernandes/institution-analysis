import { useEffect, useState, useCallback } from 'react'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { SlideOver } from './SlideOver'
import { ConfirmDialog } from './ConfirmDialog'
import { StatusBadge } from './StatusBadge'
import { ClassificationConfirmModal } from './ClassificationConfirmModal'
import { getDocument, getChunks, deleteDocument } from '../db/documentDb'
import { getAllDocuments } from '../db/documentDb'
import { useAppDispatch } from '../context/AppContext'
import { useToast } from './useToast'
import { runProcessingPipeline } from '../services/processingPipeline'
import { runQuickInsights } from '../services/analysisPipeline'
import {
  deleteFinancialSummary,
  deleteStrategicPriority,
  deleteSustainabilityMetric,
  deleteKpiDatapoint,
  clearExtractionsForDocument,
} from '../db/extractionDb'
import { query } from '../db/db'
import type { DocumentRow, ChunkRow, ClassificationResult } from '../types'

interface Props {
  documentId: number | null
  onClose: () => void
}

interface PendingConfirm {
  result: ClassificationResult
  resolve: (confirmed: ClassificationResult | null) => void
}

interface ExtractionSummary {
  financials: { id: number; fiscal_year: string | null }[]
  priorities: { id: number; priority_name: string }[]
  sustainability: { id: number; fiscal_year: string | null }[]
  kpis: { id: number; kpi_name: string; kpi_category: string | null; fiscal_year: string | null }[]
}

function getExtractionSummary(documentId: number): ExtractionSummary {
  return {
    financials: query('SELECT id, fiscal_year FROM financial_summaries WHERE document_id = ?', [documentId]),
    priorities: query('SELECT id, priority_name FROM strategic_priorities WHERE document_id = ?', [documentId]),
    sustainability: query('SELECT id, fiscal_year FROM sustainability_metrics WHERE document_id = ?', [documentId]),
    kpis: query('SELECT id, kpi_name, kpi_category, fiscal_year FROM kpi_datapoints WHERE document_id = ?', [documentId]),
  }
}

export function DocumentDetailPanel({ documentId, onClose }: Props) {
  const dispatch = useAppDispatch()
  const showToast = useToast()
  const [doc, setDoc] = useState<DocumentRow | null>(null)
  const [chunks, setChunks] = useState<ChunkRow[]>([])
  const [showText, setShowText] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmReprocess, setConfirmReprocess] = useState(false)
  const [confirmClearAll, setConfirmClearAll] = useState(false)
  const [reprocessing, setReprocessing] = useState(false)
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null)
  const [extraction, setExtraction] = useState<ExtractionSummary | null>(null)
  const [extractionOpen, setExtractionOpen] = useState(true)

  useEffect(() => {
    if (documentId === null) { setDoc(null); setChunks([]); setExtraction(null); return }
    setDoc(getDocument(documentId))
    setChunks(getChunks(documentId))
    setShowText(false)
  }, [documentId])

  useEffect(() => {
    if (documentId !== null && doc?.processing_status === 'processed') {
      setExtraction(getExtractionSummary(documentId))
    } else {
      setExtraction(null)
    }
  }, [documentId, doc?.processing_status])

  function reloadExtraction() {
    if (documentId !== null) setExtraction(getExtractionSummary(documentId))
  }

  function refreshDoc() {
    if (documentId === null) return
    setDoc(getDocument(documentId))
    dispatch({ type: 'SET_DOCUMENTS', payload: getAllDocuments() })
  }

  function handleDelete() {
    if (!doc) return
    deleteDocument(doc.id)
    dispatch({ type: 'SET_DOCUMENTS', payload: getAllDocuments() })
    showToast('success', `${doc.filename} deleted`)
    onClose()
  }

  const waitForConfirmation = useCallback(
    (result: ClassificationResult): Promise<ClassificationResult | null> =>
      new Promise((resolve) => setPendingConfirm({ result, resolve })),
    []
  )

  async function handleReprocess() {
    if (!doc) return
    setReprocessing(true)
    try {
      await runProcessingPipeline(
        doc.id,
        doc.institution_id,
        () => { /* no status bar here — just refresh when done */ },
        (result) => waitForConfirmation(result)
      )
      refreshDoc()
      reloadExtraction()
      showToast('success', `${doc.filename} re-processed successfully`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!msg.includes('Cancelled')) {
        showToast('error', `Re-processing failed: ${msg}`)
      }
      refreshDoc()
    } finally {
      setReprocessing(false)
    }
  }

  const [quickRunning, setQuickRunning] = useState(false)

  async function handleQuickInsights() {
    if (!doc) return
    setQuickRunning(true)
    try {
      await runQuickInsights(doc.id, doc.institution_id, doc.institution_name, () => {})
      showToast('success', 'Quick insights generated — view in the Insights tab')
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Quick insights failed')
    } finally {
      setQuickRunning(false)
    }
  }

  function handleClearAll() {
    if (!documentId) return
    clearExtractionsForDocument(documentId)
    reloadExtraction()
    showToast('success', 'All extracted data cleared for this document')
  }

  const canReprocess =
    doc?.processing_status === 'failed' || doc?.processing_status === 'processed'

  const hasExtractions = extraction && (
    extraction.financials.length > 0 ||
    extraction.priorities.length > 0 ||
    extraction.sustainability.length > 0 ||
    extraction.kpis.length > 0
  )

  return (
    <>
      <SlideOver open={documentId !== null} onClose={onClose} title="Document Details">
        {doc && (
          <div className="space-y-5">
            {/* Metadata grid */}
            <div className="grid grid-cols-2 gap-3">
              <MetaItem label="Institution" value={doc.institution_name} />
              <MetaItem label="Status">
                <StatusBadge status={doc.processing_status.charAt(0).toUpperCase() + doc.processing_status.slice(1)} />
              </MetaItem>
              <MetaItem label="Type" value={doc.document_type ?? '—'} />
              <MetaItem label="Fiscal Year" value={doc.fiscal_year ?? '—'} />
              <MetaItem label="Pages" value={doc.page_count?.toString() ?? '—'} />
              <MetaItem label="Words" value={doc.word_count?.toLocaleString() ?? '—'} />
              <MetaItem label="Chunks" value={chunks.length.toString()} />
              <MetaItem label="Uploaded" value={doc.upload_date ? doc.upload_date.slice(0, 10) : '—'} />
            </div>

            {doc.processing_error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                <p className="font-medium mb-1">Processing Error</p>
                <p>{doc.processing_error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1 flex-wrap">
              <button
                disabled={!canReprocess || reprocessing}
                onClick={() => setConfirmReprocess(true)}
                title={canReprocess ? 'Re-run AI extraction' : 'Only available for processed or failed documents'}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  canReprocess && !reprocessing
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                {reprocessing ? 'Processing…' : 'Re-process'}
              </button>
              {doc.processing_status === 'processed' && (
                <button
                  disabled={quickRunning}
                  onClick={handleQuickInsights}
                  className="flex-1 px-3 py-2 text-sm font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {quickRunning ? 'Analysing…' : 'Quick Insights'}
                </button>
              )}
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex-1 px-3 py-2 text-sm font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
              >
                Delete
              </button>
            </div>

            {/* Extracted Data section */}
            {extraction !== null && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExtractionOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-sm font-medium text-slate-700"
                >
                  <span>Extracted Data</span>
                  {extractionOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {extractionOpen && (
                  <div className="px-4 py-3 space-y-4">
                    {!hasExtractions && (
                      <p className="text-xs text-slate-400">No extracted data for this document.</p>
                    )}

                    {extraction.financials.length > 0 && (
                      <ExtractionGroup
                        label="Financial Summaries"
                        count={extraction.financials.length}
                        rows={extraction.financials.map((r) => ({
                          id: r.id,
                          label: `FY ${r.fiscal_year ?? '—'}`,
                        }))}
                        onDelete={(id) => {
                          deleteFinancialSummary(id)
                          reloadExtraction()
                          showToast('success', `Financial summary deleted`)
                        }}
                      />
                    )}

                    {extraction.priorities.length > 0 && (
                      <ExtractionGroup
                        label="Strategic Priorities"
                        count={extraction.priorities.length}
                        rows={extraction.priorities.map((r) => ({
                          id: r.id,
                          label: r.priority_name,
                        }))}
                        onDelete={(id) => {
                          deleteStrategicPriority(id)
                          reloadExtraction()
                          showToast('success', `Strategic priority deleted`)
                        }}
                      />
                    )}

                    {extraction.sustainability.length > 0 && (
                      <ExtractionGroup
                        label="Sustainability Metrics"
                        count={extraction.sustainability.length}
                        rows={extraction.sustainability.map((r) => ({
                          id: r.id,
                          label: `FY ${r.fiscal_year ?? '—'}`,
                        }))}
                        onDelete={(id) => {
                          deleteSustainabilityMetric(id)
                          reloadExtraction()
                          showToast('success', `Sustainability metric deleted`)
                        }}
                      />
                    )}

                    {extraction.kpis.length > 0 && (
                      <ExtractionGroup
                        label="KPI Datapoints"
                        count={extraction.kpis.length}
                        rows={extraction.kpis.map((r) => ({
                          id: r.id,
                          label: [r.kpi_name, r.kpi_category, r.fiscal_year].filter(Boolean).join(' · '),
                        }))}
                        onDelete={(id) => {
                          deleteKpiDatapoint(id)
                          reloadExtraction()
                          showToast('success', `KPI datapoint deleted`)
                        }}
                      />
                    )}

                    {hasExtractions && (
                      <button
                        onClick={() => setConfirmClearAll(true)}
                        className="text-xs text-red-500 hover:text-red-700 hover:underline mt-1"
                      >
                        Clear All Extractions
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Raw text toggle */}
            {chunks.length > 0 && (
              <div>
                <button
                  onClick={() => setShowText((v) => !v)}
                  className="text-xs text-green-600 hover:underline"
                >
                  {showText ? 'Hide raw text' : 'Show raw text'}
                </button>
                {showText && (
                  <pre className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 overflow-auto max-h-80 whitespace-pre-wrap">
                    {chunks[0].chunk_text}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </SlideOver>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Document"
        message={`Delete "${doc?.filename}"? All chunks and extracted data will be removed.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        open={confirmReprocess}
        title="Re-process Document"
        message="This will replace all existing extracted data for this document (financials, priorities, KPIs, sustainability). Continue?"
        confirmLabel="Re-process"
        danger={false}
        onConfirm={() => { setConfirmReprocess(false); handleReprocess() }}
        onCancel={() => setConfirmReprocess(false)}
      />

      <ConfirmDialog
        open={confirmClearAll}
        title="Clear All Extractions"
        message="This will delete all financials, priorities, sustainability metrics, and KPI datapoints extracted from this document. This cannot be undone."
        confirmLabel="Clear All"
        danger
        onConfirm={() => { setConfirmClearAll(false); handleClearAll() }}
        onCancel={() => setConfirmClearAll(false)}
      />

      {pendingConfirm && (
        <ClassificationConfirmModal
          open
          result={pendingConfirm.result}
          filename={doc?.filename ?? ''}
          onConfirm={(confirmed) => {
            setPendingConfirm(null)
            pendingConfirm.resolve(confirmed)
          }}
          onCancel={() => {
            pendingConfirm.resolve(null)
            setPendingConfirm(null)
          }}
        />
      )}
    </>
  )
}

function ExtractionGroup({
  label,
  count,
  rows,
  onDelete,
}: {
  label: string
  count: number
  rows: { id: number; label: string }[]
  onDelete: (id: number) => void
}) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 mb-1.5">
        {label} <span className="text-slate-400">({count})</span>
      </p>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-2 text-xs text-slate-700">
            <span className="truncate">{row.label}</span>
            <button
              onClick={() => onDelete(row.id)}
              className="shrink-0 text-slate-400 hover:text-red-500 transition-colors"
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function MetaItem({
  label,
  value,
  children,
}: {
  label: string
  value?: string
  children?: React.ReactNode
}) {
  return (
    <div>
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      {children ?? <p className="text-sm font-medium text-slate-800">{value}</p>}
    </div>
  )
}
