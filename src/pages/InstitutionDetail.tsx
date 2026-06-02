import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Globe, Pencil, Trash2, FileText, BarChart2, Leaf, Target, TrendingUp, Lightbulb, LayoutDashboard, Sparkles } from 'lucide-react'
import { query, execute, saveDb } from '../db/db'
import { useAppDispatch } from '../context/AppContext'
import { useToast } from '../components/useToast'
import { SlideOver } from '../components/SlideOver'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { InstitutionForm } from '../components/InstitutionForm'
import { DocumentUpload } from '../components/DocumentUpload'
import { DocumentDetailPanel } from '../components/DocumentDetailPanel'
import { StatusBadge } from '../components/StatusBadge'
import { ThemeProposalModal } from '../components/ThemeProposalModal'
import { getDocumentsByInstitution } from '../db/documentDb'
import { OverviewTab } from './tabs/OverviewTab'
import { FinancialsTab } from './tabs/FinancialsTab'
import { StrategicPrioritiesTab } from './tabs/StrategicPrioritiesTab'
import { KPIsTab } from './tabs/KPIsTab'
import { SustainabilityTab } from './tabs/SustainabilityTab'
import { InsightsTab } from './tabs/InsightsTab'
import { runFullAnalysis } from '../services/analysisPipeline'
import type { Institution, Tag, DocumentRow, ProposedTheme } from '../types'

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
  const [analysisRunning, setAnalysisRunning] = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState('')
  const [insightsRefreshKey, setInsightsRefreshKey] = useState(0)
  const [proposedThemes, setProposedThemes] = useState<ProposedTheme[]>([])
  const [themeModalOpen, setThemeModalOpen] = useState(false)

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

  async function handleRunAnalysis() {
    if (!institution) return
    setAnalysisRunning(true)
    setActiveTab('insights')
    try {
      const result = await runFullAnalysis(institution.id, institution.name, setAnalysisStatus)
      setInsightsRefreshKey((k) => k + 1)
      if (result.proposedThemes.length > 0) {
        setProposedThemes(result.proposedThemes)
        setThemeModalOpen(true)
      }
      showToast('success', `Analysis complete — ${result.findings.length} findings generated`)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalysisRunning(false)
      setAnalysisStatus('')
    }
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
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleRunAnalysis}
              disabled={analysisRunning}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles size={14} /> {analysisRunning ? analysisStatus || 'Running…' : 'Run Full Analysis'}
            </button>
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
      <div className="relative border-b border-slate-200 mb-4">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide -mb-px">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              aria-current={activeTab === key ? 'page' : undefined}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors shrink-0 ${
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
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {activeTab === 'overview' && <OverviewTab institutionId={institution.id} />}
        {activeTab === 'documents' && <DocumentsTab institutionId={institution.id} />}
        {activeTab === 'financials' && <FinancialsTab institutionId={institution.id} />}
        {activeTab === 'priorities' && <StrategicPrioritiesTab institutionId={institution.id} />}
        {activeTab === 'kpis' && <KPIsTab institutionId={institution.id} />}
        {activeTab === 'sustainability' && <SustainabilityTab institutionId={institution.id} />}
        {activeTab === 'insights' && <InsightsTab institutionId={institution.id} refreshKey={insightsRefreshKey} />}
      </div>

      <SlideOver open={editOpen} onClose={() => setEditOpen(false)} title="Edit Institution">
        <InstitutionForm institution={institution} onClose={() => { setEditOpen(false); loadInstitution() }} />
      </SlideOver>

      {themeModalOpen && (
        <ThemeProposalModal
          institutionId={institution.id}
          themes={proposedThemes}
          onClose={() => setThemeModalOpen(false)}
        />
      )}

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

function DocumentsTab({ institutionId }: { institutionId: number }) {
  const [docs, setDocs] = useState<DocumentRow[]>(() => getDocumentsByInstitution(institutionId))
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null)

  function refresh() {
    setDocs(getDocumentsByInstitution(institutionId))
  }

  return (
    <div className="space-y-4">
      <DocumentUpload institutionId={institutionId} onUploaded={refresh} />

      {docs.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">No documents yet. Upload a PDF above.</p>
      ) : (
        <div className="overflow-hidden border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Filename</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Status</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">Pages</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">Words</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <tr
                  key={doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-slate-800 max-w-xs truncate">{doc.filename}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={doc.processing_status.charAt(0).toUpperCase() + doc.processing_status.slice(1)} />
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-right">{doc.page_count ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600 text-right">{doc.word_count?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{doc.upload_date ? doc.upload_date.slice(0, 10) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DocumentDetailPanel
        documentId={selectedDocId}
        onClose={() => { setSelectedDocId(null); refresh() }}
      />
    </div>
  )
}

