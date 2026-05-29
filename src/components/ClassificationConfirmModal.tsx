import { useState, useEffect } from 'react'
import type { ClassificationResult } from '../types'

const DOC_TYPES: ClassificationResult['documentType'][] = [
  'Financial Statement',
  'Strategic Plan',
  'Sustainability Report',
  'Annual Report',
  'Other',
]

interface Props {
  open: boolean
  result: ClassificationResult
  filename: string
  onConfirm: (confirmed: ClassificationResult) => void
  onCancel: () => void
}

export function ClassificationConfirmModal({ open, result, filename, onConfirm, onCancel }: Props) {
  const [documentType, setDocumentType] = useState(result.documentType)
  const [fiscalYear, setFiscalYear] = useState(result.fiscalYear ?? '')

  useEffect(() => {
    setDocumentType(result.documentType)
    setFiscalYear(result.fiscalYear ?? '')
  }, [result])

  if (!open) return null

  const confidencePct = Math.round(result.confidence * 100)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Document Classification</h2>
        <p className="text-sm text-slate-500 mb-5 truncate" title={filename}>{filename}</p>

        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
          AI classified this document as:
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Document Type</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as ClassificationResult['documentType'])}
              className="input"
            >
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fiscal Year</label>
            <input
              type="text"
              value={fiscalYear}
              onChange={(e) => setFiscalYear(e.target.value)}
              placeholder="e.g. 2024"
              className="input"
            />
          </div>

          {result.institutionName && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Institution detected</p>
              <p className="text-sm text-slate-700">{result.institutionName}</p>
            </div>
          )}

          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Confidence</span>
              <span>{confidencePct}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  confidencePct >= 80
                    ? 'bg-green-500'
                    : confidencePct >= 50
                    ? 'bg-yellow-400'
                    : 'bg-red-400'
                }`}
                style={{ width: `${confidencePct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() =>
              onConfirm({
                ...result,
                documentType,
                fiscalYear: fiscalYear.trim() || null,
              })
            }
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
          >
            Confirm &amp; Extract
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
