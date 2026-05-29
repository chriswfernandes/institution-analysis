import { useState } from 'react'
import { Upload, FileText, Trash2 } from 'lucide-react'
import { useAppState, useAppDispatch } from '../context/AppContext'
import { StatusBadge } from '../components/StatusBadge'
import { DocumentUpload } from '../components/DocumentUpload'
import { DocumentDetailPanel } from '../components/DocumentDetailPanel'
import { SlideOver } from '../components/SlideOver'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { deleteDocument, getAllDocuments } from '../db/documentDb'
import { useToast } from '../components/useToast'

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function Documents() {
  const { documents, institutions } = useAppState()
  const dispatch = useAppDispatch()
  const showToast = useToast()

  const [search, setSearch] = useState('')
  const [institutionFilter, setInstitutionFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; filename: string } | null>(null)

  const filtered = documents.filter((d) => {
    const matchSearch =
      !search ||
      d.filename.toLowerCase().includes(search.toLowerCase()) ||
      d.institution_name.toLowerCase().includes(search.toLowerCase())
    const matchInstitution =
      institutionFilter === 'all' || d.institution_id === Number(institutionFilter)
    const matchStatus =
      statusFilter === 'all' || d.processing_status === statusFilter
    return matchSearch && matchInstitution && matchStatus
  })

  function handleDelete() {
    if (!deleteTarget) return
    deleteDocument(deleteTarget.id)
    dispatch({ type: 'SET_DOCUMENTS', payload: getAllDocuments() })
    showToast('success', `${deleteTarget.filename} deleted`)
    setDeleteTarget(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold text-slate-900">Documents</h1>
        <button
          onClick={() => setUploadOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
        >
          <Upload size={14} /> Upload Documents
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="search"
          placeholder="Search by filename or institution…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input max-w-xs"
        />
        <select
          value={institutionFilter}
          onChange={(e) => setInstitutionFilter(e.target.value)}
          className="input w-auto"
        >
          <option value="all">All institutions</option>
          {institutions.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input w-auto"
        >
          <option value="all">All statuses</option>
          <option value="processed">Processed</option>
          <option value="processing">Processing</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <FileText size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No documents found</p>
          <p className="text-slate-400 text-sm mt-1">
            {documents.length === 0
              ? 'Upload a PDF to get started'
              : 'Try adjusting your filters'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Filename</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Institution</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Pages</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Words</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Uploaded</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => (
                <tr
                  key={doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-slate-800 max-w-xs truncate">
                    {doc.filename}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{doc.institution_name}</td>
                  <td className="px-4 py-3 text-slate-500">{doc.document_type ?? '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={capitalize(doc.processing_status)} />
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-right">{doc.page_count ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600 text-right">
                    {doc.word_count?.toLocaleString() ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {doc.upload_date ? doc.upload_date.slice(0, 10) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setDeleteTarget({ id: doc.id, filename: doc.filename })}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload slide-over */}
      <SlideOver open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload Documents">
        <DocumentUpload onUploaded={() => setUploadOpen(false)} />
      </SlideOver>

      {/* Detail panel */}
      <DocumentDetailPanel
        documentId={selectedDocId}
        onClose={() => setSelectedDocId(null)}
      />

      {/* Confirm delete */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Document"
        message={`Delete "${deleteTarget?.filename}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
