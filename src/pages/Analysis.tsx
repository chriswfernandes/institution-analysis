import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tag, ChevronDown, ChevronUp, Save } from 'lucide-react'
import { query, execute, saveDb } from '../db/db'
import { useAppState } from '../context/AppContext'
import { useToast } from '../components/useToast'
import type { Institution } from '../types'

interface ThemeRow {
  id: number
  name: string
  description: string | null
}

interface InstitutionThemeRow {
  institution_id: number
  institution_name: string
  institution_short_code: string
  relevance_score: number | null
  evidence: string | null
}

interface ThemeAssignment {
  themeId: number
  score: number
}

export function Analysis() {
  const navigate = useNavigate()
  const { institutions } = useAppState()
  const showToast = useToast()

  const [themes, setThemes] = useState<ThemeRow[]>([])
  const [themeInstitutions, setThemeInstitutions] = useState<Record<number, InstitutionThemeRow[]>>({})
  const [expandedTheme, setExpandedTheme] = useState<number | null>(null)

  const [assignInstId, setAssignInstId] = useState<number | ''>('')
  const [assignments, setAssignments] = useState<ThemeAssignment[]>([])

  useEffect(() => {
    loadThemes()
  }, [])

  function loadThemes() {
    const rows = query<ThemeRow>('SELECT id, name, description FROM themes ORDER BY name')
    setThemes(rows)

    const map: Record<number, InstitutionThemeRow[]> = {}
    for (const theme of rows) {
      map[theme.id] = query<InstitutionThemeRow>(
        `SELECT it.institution_id, i.name as institution_name, i.short_code as institution_short_code,
                it.relevance_score, it.evidence
         FROM institution_themes it
         JOIN institutions i ON i.id = it.institution_id
         WHERE it.theme_id = ?
         ORDER BY it.relevance_score DESC`,
        [theme.id]
      )
    }
    setThemeInstitutions(map)
  }

  function loadAssignmentsForInstitution(instId: number) {
    const rows = query<{ theme_id: number; relevance_score: number | null }>(
      `SELECT theme_id, relevance_score FROM institution_themes WHERE institution_id = ?`,
      [instId]
    )
    const existingMap = Object.fromEntries(rows.map((r) => [r.theme_id, r.relevance_score ?? 3]))
    setAssignments(
      themes.map((t) => ({
        themeId: t.id,
        score: existingMap[t.id] ?? 0,
      }))
    )
  }

  function handleInstChange(instId: number | '') {
    setAssignInstId(instId)
    if (instId !== '') loadAssignmentsForInstitution(instId)
    else setAssignments([])
  }

  function setScore(themeId: number, score: number) {
    setAssignments((prev) =>
      prev.map((a) => (a.themeId === themeId ? { ...a, score } : a))
    )
  }

  function saveAssignments() {
    if (!assignInstId) return
    execute('DELETE FROM institution_themes WHERE institution_id = ?', [assignInstId])
    for (const a of assignments) {
      if (a.score > 0) {
        execute(
          `INSERT INTO institution_themes (institution_id, theme_id, relevance_score) VALUES (?, ?, ?)`,
          [assignInstId, a.themeId, a.score]
        )
      }
    }
    saveDb()
    loadThemes()
    showToast('success', 'Theme assignments saved')
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-slate-900">Analysis & Themes</h1>

      {/* Themes Map */}
      <section>
        <h2 className="text-base font-semibold text-slate-700 mb-3">Themes Map</h2>
        {themes.length === 0 ? (
          <p className="text-sm text-slate-400">No themes configured.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {themes.map((theme) => {
              const tagged = themeInstitutions[theme.id] ?? []
              const isExpanded = expandedTheme === theme.id
              return (
                <div key={theme.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => setExpandedTheme(isExpanded ? null : theme.id)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Tag size={14} className="text-slate-400" />
                      <span className="text-sm font-medium text-slate-800">{theme.name}</span>
                      <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{tagged.length}</span>
                    </div>
                    {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                  </button>

                  {!isExpanded && tagged.length > 0 && (
                    <div className="px-4 pb-3 flex flex-wrap gap-1">
                      {tagged.map((t) => (
                        <button
                          key={t.institution_id}
                          onClick={() => navigate(`/institutions/${t.institution_id}`)}
                          className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full hover:bg-green-100"
                        >
                          {t.institution_short_code}
                        </button>
                      ))}
                    </div>
                  )}

                  {isExpanded && (
                    <div className="border-t border-slate-100 divide-y divide-slate-100">
                      {tagged.length === 0 ? (
                        <p className="text-xs text-slate-400 px-4 py-3">No institutions tagged.</p>
                      ) : (
                        tagged.map((t) => (
                          <div key={t.institution_id} className="px-4 py-3">
                            <div className="flex items-center justify-between gap-2">
                              <button
                                onClick={() => navigate(`/institutions/${t.institution_id}`)}
                                className="text-sm font-medium text-green-700 hover:underline"
                              >
                                {t.institution_name}
                              </button>
                              {t.relevance_score != null && (
                                <span className="text-amber-400 text-xs">
                                  {'★'.repeat(t.relevance_score)}{'☆'.repeat(5 - t.relevance_score)}
                                </span>
                              )}
                            </div>
                            {t.evidence && (
                              <p className="text-xs text-slate-400 mt-1 italic line-clamp-2">{t.evidence}</p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Theme Assignment */}
      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-700 mb-4">Theme Assignment</h2>
        <div className="mb-4">
          <label htmlFor="assign-inst" className="block text-sm font-medium text-slate-700 mb-1">Institution</label>
          <select
            id="assign-inst"
            value={assignInstId}
            onChange={(e) => handleInstChange(e.target.value === '' ? '' : Number(e.target.value))}
            className="input w-full max-w-xs"
          >
            <option value="">Select an institution…</option>
            {(institutions as Institution[]).map((inst) => (
              <option key={inst.id} value={inst.id}>{inst.name}</option>
            ))}
          </select>
        </div>

        {assignInstId !== '' && assignments.length > 0 && (
          <>
            <div className="space-y-2 mb-4">
              {themes.map((theme, idx) => {
                const a = assignments[idx]
                if (!a) return null
                return (
                  <div key={theme.id} className="flex items-center gap-4 py-2 border-b border-slate-100 last:border-0">
                    <div className="flex-1 text-sm text-slate-700">{theme.name}</div>
                    <div className="flex items-center gap-1">
                      {[0, 1, 2, 3, 4, 5].map((score) => (
                        <button
                          key={score}
                          onClick={() => setScore(theme.id, score)}
                          className={`w-6 h-6 rounded text-xs font-medium transition-colors ${a.score === score ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                          aria-label={score === 0 ? 'Not tagged' : `Relevance score ${score}`}
                        >
                          {score === 0 ? '–' : score}
                        </button>
                      ))}
                    </div>
                    {a.score > 0 && (
                      <span className="text-amber-400 text-xs w-20 shrink-0">
                        {'★'.repeat(a.score)}{'☆'.repeat(5 - a.score)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            <button
              onClick={saveAssignments}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
            >
              <Save size={14} /> Save Assignments
            </button>
          </>
        )}
      </section>
    </div>
  )
}
