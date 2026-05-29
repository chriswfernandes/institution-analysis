import { useState } from 'react'
import { X } from 'lucide-react'
import { execute, saveDb } from '../db/db'
import type { ProposedTheme } from '../types'

interface Props {
  institutionId: number
  themes: ProposedTheme[]
  onClose: () => void
}

export function ThemeProposalModal({ institutionId, themes, onClose }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set(themes.map((t) => t.themeId)))

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function apply() {
    for (const t of themes) {
      if (!selected.has(t.themeId)) continue
      execute(
        `INSERT OR REPLACE INTO institution_themes (institution_id, theme_id, relevance_score, evidence)
         VALUES (?, ?, ?, ?)`,
        [institutionId, t.themeId, t.relevanceScore, t.evidence]
      )
    }
    saveDb()
    onClose()
  }

  if (themes.length === 0) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true" aria-labelledby="theme-modal-title">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 id="theme-modal-title" className="text-base font-semibold text-slate-900">Proposed Strategic Themes</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="px-6 py-4 max-h-96 overflow-y-auto space-y-3">
          <p className="text-sm text-slate-500 mb-2">The AI identified these themes in the analysis. Select the ones to apply to this institution.</p>
          {themes.map((t) => (
            <label key={t.themeId} className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={selected.has(t.themeId)}
                onChange={() => toggle(t.themeId)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">{t.themeName}</span>
                  <span className="text-xs text-slate-400">{'★'.repeat(t.relevanceScore)}{'☆'.repeat(5 - t.relevanceScore)}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 italic">{t.evidence}</p>
              </div>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">Skip</button>
          <button
            onClick={apply}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
          >
            Apply Selected Themes
          </button>
        </div>
      </div>
    </div>
  )
}
