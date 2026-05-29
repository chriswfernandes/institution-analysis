import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Globe, Pencil, Trash2, FileText, BarChart2, Leaf, Target, TrendingUp, Lightbulb, LayoutDashboard } from 'lucide-react'
import { query, execute, saveDb } from '../db/db'
import { useAppDispatch } from '../context/AppContext'
import { useToast } from '../components/useToast'
import { SlideOver } from '../components/SlideOver'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { InstitutionForm } from '../components/InstitutionForm'
import type { Institution, Tag } from '../types'

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'financials', label: 'Financials', icon: BarChart2 },
  { key: 'priorities', label: 'Strategic Priorities', icon: Target },
  { key: 'kpis', label: 'KPIs', icon: TrendingUp },
  { key: 'sustainability', label: 'Sustainability', icon: Leaf },
  { key: 'insights', label: 'Insights', icon: Lightbulb },
]

export function InstitutionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const showToast = useToast()

  const [institution, setInstitution] = useState<Institution | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [activeTab, setActiveTab] = useState('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    loadInstitution()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  function loadInstitution() {
    const rows = query<Institution>('SELECT * FROM institutions WHERE id = ?', [Number(id)])
    if (rows.length === 0) { navigate('/institutions'); return }
    setInstitution(rows[0])
    const tagRows = query<Tag>(
      'SELECT t.* FROM tags t JOIN institution_tags it ON it.tag_id = t.id WHERE it.institution_id = ?',
      [Number(id)]
    )
    setTags(tagRows)
  }

  function handleDelete() {
    execute('DELETE FROM institutions WHERE id = ?', [Number(id)])
    saveDb()
    const institutions = query<Institution>(
      `SELECT i.*, COUNT(d.id) as document_count FROM institutions i
       LEFT JOIN documents d ON d.institution_id = i.id
       GROUP BY i.id ORDER BY i.name`
    )
    dispatch({ type: 'SET_INSTITUTIONS', payload: institutions })
    showToast('success', 'Institution deleted')
    navigate('/institutions')
  }

  if (!institution) return null

  return (
    <div>
      {/* Back */}
      <button onClick={() => navigate('/institutions')}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft size={14} /> Institutions
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold text-slate-900">{institution.name}</h1>
              <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">{institution.short_code}</span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {[institution.province, institution.institution_type].filter(Boolean).join(' · ') || 'No details set'}
            </p>
            {institution.website && (
              <a href={institution.website} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-green-600 hover:underline mt-1">
                <Globe size={12} /> {institution.website}
              </a>
            )}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.map((t) => (
                  <span key={t.id} className="text-xs px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: t.colour ?? '#64748b' }}>
                    {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">
              <Pencil size={14} /> Edit
            </button>
            <button onClick={() => setDeleteOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100">
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            aria-current={activeTab === key ? 'page' : undefined}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === key
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {activeTab === 'overview' && <OverviewTab institutionId={institution.id} />}
        {activeTab !== 'overview' && (
          <p className="text-sm text-slate-400 text-center py-8">
            {activeTab === 'documents' && 'Document upload will be available in Phase 2.'}
            {activeTab === 'financials' && 'Financial data will appear after documents are processed.'}
            {activeTab === 'priorities' && 'Strategic priorities will appear after documents are processed.'}
            {activeTab === 'kpis' && 'KPI data will appear after documents are processed.'}
            {activeTab === 'sustainability' && 'Sustainability data will appear after documents are processed.'}
            {activeTab === 'insights' && 'AI insights will be available in Phase 5.'}
          </p>
        )}
      </div>

      <SlideOver open={editOpen} onClose={() => setEditOpen(false)} title="Edit Institution">
        <InstitutionForm institution={institution} onClose={() => { setEditOpen(false); loadInstitution() }} />
      </SlideOver>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete Institution"
        message={`Delete "${institution.name}"? This will permanently remove all documents, data, and insights for this institution.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  )
}

function OverviewTab({ institutionId }: { institutionId: number }) {
  const [docCount] = query<{ c: number }>('SELECT COUNT(*) as c FROM documents WHERE institution_id = ?', [institutionId])
  const [priorityCount] = query<{ c: number }>('SELECT COUNT(*) as c FROM strategic_priorities WHERE institution_id = ?', [institutionId])
  const [insightCount] = query<{ c: number }>('SELECT COUNT(*) as c FROM analysis_findings WHERE institution_id = ?', [institutionId])

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Documents', value: docCount?.c ?? 0 },
          { label: 'Priorities', value: priorityCount?.c ?? 0 },
          { label: 'Insights', value: insightCount?.c ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} className="bg-slate-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-slate-400 text-center">Upload documents to populate this institution's intelligence.</p>
    </div>
  )
}
