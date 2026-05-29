import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, FileText } from 'lucide-react'
import { query } from '../db/db'
import { useAppState } from '../context/AppContext'
import { StatusBadge } from '../components/StatusBadge'
import { StatCard } from '../components/StatCard'
import { DataTable, type Column } from '../components/DataTable'
import { relativeTime } from '../utils/format'
import type { DocumentRow, Institution } from '../types'

interface ActivityRow extends DocumentRow {
  institution_id: number
}

interface InstitutionTableRow extends Institution {
  last_upload: string | null
  tag_names: string | null
}

export function Dashboard() {
  const { dbReady } = useAppState()
  const navigate = useNavigate()

  const [institutionCount, setInstitutionCount] = useState(0)
  const [documentCount, setDocumentCount] = useState(0)
  const [processedCount, setProcessedCount] = useState(0)
  const [insightCount, setInsightCount] = useState(0)
  const [recentDocs, setRecentDocs] = useState<ActivityRow[]>([])
  const [institutionRows, setInstitutionRows] = useState<InstitutionTableRow[]>([])

  useEffect(() => {
    if (!dbReady) return

    const [instRow] = query<{ c: number }>('SELECT COUNT(*) as c FROM institutions')
    const [docRow] = query<{ c: number }>('SELECT COUNT(*) as c FROM documents')
    const [procRow] = query<{ c: number }>(
      "SELECT COUNT(*) as c FROM documents WHERE processing_status = 'processed'"
    )
    const [insRow] = query<{ c: number }>(
      'SELECT COUNT(DISTINCT institution_id) as c FROM analysis_findings'
    )

    setInstitutionCount(instRow?.c ?? 0)
    setDocumentCount(docRow?.c ?? 0)
    setProcessedCount(procRow?.c ?? 0)
    setInsightCount(insRow?.c ?? 0)

    const docs = query<ActivityRow>(
      `SELECT d.*, i.name as institution_name FROM documents d
       JOIN institutions i ON i.id = d.institution_id
       ORDER BY d.upload_date DESC LIMIT 10`
    )
    setRecentDocs(docs)

    const insts = query<InstitutionTableRow>(
      `SELECT i.*,
         COUNT(DISTINCT d.id) as document_count,
         MAX(d.upload_date) as last_upload,
         GROUP_CONCAT(t.name, ', ') as tag_names
       FROM institutions i
       LEFT JOIN documents d ON d.institution_id = i.id
       LEFT JOIN institution_tags it ON it.institution_id = i.id
       LEFT JOIN tags t ON t.id = it.tag_id
       GROUP BY i.id
       ORDER BY i.name`
    )
    setInstitutionRows(insts)
  }, [dbReady])

  const institutionColumns: Column<Record<string, unknown>>[] = [
    {
      key: 'name',
      label: 'Institution',
      sortable: true,
      render: (v) => <span className="font-medium text-slate-800">{String(v ?? '')}</span>,
    },
    { key: 'province', label: 'Province', sortable: true },
    { key: 'institution_type', label: 'Type', sortable: true },
    {
      key: 'document_count',
      label: 'Documents',
      sortable: true,
      className: 'text-right',
      render: (v) => <span className="text-right block">{String(v ?? 0)}</span>,
    },
    {
      key: 'last_upload',
      label: 'Last Upload',
      sortable: true,
      render: (v) => v ? relativeTime(String(v)) : '—',
    },
    {
      key: 'tag_names',
      label: 'Tags',
      render: (v) => v
        ? String(v).split(', ').map((t) => (
            <span key={t} className="inline-block mr-1 mb-0.5 px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full">{t}</span>
          ))
        : null,
    },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Institutions" value={institutionCount} />
        <StatCard title="Total Documents" value={documentCount} />
        <StatCard title="Processed" value={processedCount} />
        <StatCard title="With Insights" value={insightCount} />
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <FileText size={14} className="text-slate-400" /> Recent Activity
        </h2>
        {recentDocs.length === 0 ? (
          <p className="text-sm text-slate-400">No documents uploaded yet. Add an institution and upload documents to get started.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentDocs.map((doc) => (
              <div
                key={doc.id}
                onClick={() => navigate(`/institutions/${doc.institution_id}`)}
                className="py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{doc.filename}</p>
                  <p className="text-xs text-slate-500">{doc.institution_name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {doc.document_type && (
                    <span className="hidden sm:inline text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{doc.document_type}</span>
                  )}
                  <StatusBadge status={doc.processing_status.charAt(0).toUpperCase() + doc.processing_status.slice(1)} />
                  <span className="text-xs text-slate-400">{relativeTime(doc.upload_date)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Institutions table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
          <Building2 size={14} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-700">Institutions Overview</h2>
        </div>
        {institutionRows.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">No institutions yet. <button onClick={() => navigate('/institutions')} className="text-green-600 hover:underline">Add one</button>.</p>
        ) : (
          <DataTable
            columns={institutionColumns}
            data={institutionRows as unknown as Record<string, unknown>[]}
            onRowClick={(row) => navigate(`/institutions/${String(row.id)}`)}
          />
        )}
      </div>
    </div>
  )
}
