import { useEffect, useState } from 'react'
import { SlideOver } from './SlideOver'
import { ConfirmDialog } from './ConfirmDialog'
import { StatusBadge } from './StatusBadge'
import { getDocument, getChunks, deleteDocument } from '../db/documentDb'
import { getAllDocuments } from '../db/documentDb'
import { useAppDispatch } from '../context/AppContext'
import { useToast } from './useToast'
import type { DocumentRow, ChunkRow } from '../types'

interface Props {
  documentId: number | null
  onClose: () => void
}

export function DocumentDetailPanel({ documentId, onClose }: Props) {
  const dispatch = useAppDispatch()
  const showToast = useToast()
  const [doc, setDoc] = useState<DocumentRow | null>(null)
  const [chunks, setChunks] = useState<ChunkRow[]>([])
  const [showText, setShowText] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (documentId === null) { setDoc(null); setChunks([]); return }
    setDoc(getDocument(documentId))
    setChunks(getChunks(documentId))
    setShowText(false)
  }, [documentId])

  function handleDelete() {
    if (!doc) return
    deleteDocument(doc.id)
    dispatch({ type: 'SET_DOCUMENTS', payload: getAllDocuments() })
    showToast('success', `${doc.filename} deleted`)
    onClose()
  }

  return (
    <>
      <SlideOver open={documentId !== null} onClose={onClose} title="Document Details">
        {doc && (
          <div className="space-y-5">
            {/* Metadata grid */}
            <div className="grid grid-cols-2 gap-3">
              <MetaItem label="Institution" value={doc.institution_name} />
              <MetaItem label="Status">
                <StatusBadge status={doc.processing_status} />
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
            <div className="flex gap-2 pt-1">
              <button
                disabled
                title="Available in Phase 3"
                className="flex-1 px-3 py-2 text-sm font-medium bg-slate-100 text-slate-400 rounded-lg cursor-not-allowed"
              >
                Re-process
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex-1 px-3 py-2 text-sm font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
              >
                Delete
              </button>
            </div>

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
    </>
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
