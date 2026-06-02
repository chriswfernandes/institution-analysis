import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Building2, BarChart2, Download } from 'lucide-react'
import { query, execute, saveDb } from '../db/db'
import { useAppState, useAppDispatch } from '../context/AppContext'
import { SlideOver } from '../components/SlideOver'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { InstitutionForm } from '../components/InstitutionForm'
import { useToast } from '../components/useToast'
import type { Institution, Tag } from '../types'
import { downloadCsv } from '../utils/exportCsv'

export function Institutions() {
  const { institutions, tags, dbReady } = useAppState()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const showToast = useToast()

  const [search, setSearch] = useState('')
  const [slideOpen, setSlideOpen] = useState(false)
  const [editing, setEditing] = useState<Institution | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Institution | null>(null)

  useEffect(() => {
    if (!dbReady) return
    refreshInstitutions()
    const tagRows = query<Tag>('SELECT * FROM tags ORDER BY name')
    dispatch({ type: 'SET_TAGS', payload: tagRows })
  }, [dbReady]) // eslint-disable-line react-hooks/exhaustive-deps

  function refreshInstitutions() {
    const rows = query<Institution>(
      `SELECT i.*, COUNT(d.id) as document_count FROM institutions i
       LEFT JOIN documents d ON d.institution_id = i.id
       GROUP BY i.id ORDER BY i.name`
    )
    dispatch({ type: 'SET_INSTITUTIONS', payload: rows })
  }

  function handleDelete() {
    if (!deleteTarget) return
    execute('DELETE FROM institutions WHERE id = ?', [deleteTarget.id])
    saveDb()
    refreshInstitutions()
    showToast('success', `${deleteTarget.name} deleted`)
    setDeleteTarget(null)
  }

  function getTagsForInstitution(id: number): Tag[] {
    return query<Tag>(
      'SELECT t.* FROM tags t JOIN institution_tags it ON it.tag_id = t.id WHERE it.institution_id = ?',
      [id]
    )
  }

  const filtered = institutions.filter((i) => {
    const q = search.toLowerCase()
    return (
      i.name.toLowerCase().includes(q) ||
      i.short_code.toLowerCase().includes(q) ||
      (i.province ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold text-slate-900">Institutions</h1>
        <div className="flex gap-2">
          {institutions.length > 0 && (
            <button
              onClick={() => downloadCsv('institutions.csv', institutions.map(({ id, name, short_code, institution_type, province, website, notes }) => ({ id, name, short_code, institution_type, province, website, notes })))}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200"
            >
              <Download size={16} /> Export CSV
            </button>
          )}
          <button
            onClick={() => navigate('/institutions/compare')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200"
          >
            <BarChart2 size={16} /> Compare
          </button>
          <button
            onClick={() => { setEditing(null); setSlideOpen(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
          >
            <Plus size={16} /> Add Institution
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, code, or province…"
          aria-label="Search institutions"
          className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <Building2 size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No institutions yet</p>
          <p className="text-sm text-slate-400 mt-1">Add your first Canadian post-secondary institution to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((inst) => {
            const instTags = tags.length > 0 ? getTagsForInstitution(inst.id) : []
            return (
              <div key={inst.id} className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-3">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-slate-900 text-base leading-tight">{inst.name}</h2>
                    <span className="shrink-0 text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{inst.short_code}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {[inst.province, inst.institution_type].filter(Boolean).join(' · ') || 'No details'}
                  </p>
                </div>

                {instTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {instTags.map((tag) => (
                      <span key={tag.id} className="text-xs px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: tag.colour ?? '#64748b' }}>
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-xs text-slate-400">{inst.document_count ?? 0} document{inst.document_count !== 1 ? 's' : ''}</p>

                <div className="flex gap-2 mt-auto pt-1">
                  <button onClick={() => navigate(`/institutions/${inst.id}`)}
                    className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
                    View
                  </button>
                  <button onClick={() => { setEditing(inst); setSlideOpen(true) }}
                    className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
                    Edit
                  </button>
                  <button onClick={() => setDeleteTarget(inst)}
                    className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100">
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <SlideOver open={slideOpen} onClose={() => setSlideOpen(false)} title={editing ? 'Edit Institution' : 'Add Institution'}>
        <InstitutionForm institution={editing} onClose={() => setSlideOpen(false)} />
      </SlideOver>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Institution"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This will also delete all associated documents, financials, priorities, and insights.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
