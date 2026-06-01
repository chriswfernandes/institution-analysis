import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Search, Building2, FileText, Lightbulb, Target } from 'lucide-react'
import { query } from '../db/db'

interface SearchResult {
  type: 'institution' | 'document' | 'finding' | 'priority'
  id: number
  label: string
  sublabel?: string
  href: string
}

export function GlobalSearch() {
  const navigate = useNavigate()
  const location = useLocation()
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close on route change
  useEffect(() => {
    setOpen(false)
    setTerm('')
  }, [location.pathname])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!term.trim()) { setResults([]); setOpen(false); return }
    debounceRef.current = setTimeout(() => {
      const r = runSearch(term.trim())
      setResults(r)
      setOpen(r.length > 0)
      setActiveIdx(0)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [term])

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function runSearch(t: string): SearchResult[] {
    const like = `%${t}%`
    const results: SearchResult[] = []

    const institutions = query<{ id: number; name: string; short_code: string; province: string | null }>(
      `SELECT id, name, short_code, province FROM institutions WHERE name LIKE ? OR short_code LIKE ? LIMIT 4`,
      [like, like]
    )
    for (const i of institutions) {
      results.push({ type: 'institution', id: i.id, label: i.name, sublabel: i.short_code + (i.province ? ` · ${i.province}` : ''), href: `/institutions/${i.id}` })
    }

    const docs = query<{ id: number; filename: string; institution_name: string; institution_id: number }>(
      `SELECT d.id, d.filename, i.name as institution_name, d.institution_id
       FROM documents d JOIN institutions i ON i.id = d.institution_id
       WHERE d.filename LIKE ? LIMIT 4`,
      [like]
    )
    for (const d of docs) {
      results.push({ type: 'document', id: d.id, label: d.filename, sublabel: d.institution_name, href: `/institutions/${d.institution_id}?tab=documents` })
    }

    const findings = query<{ id: number; title: string; institution_id: number; institution_name: string }>(
      `SELECT af.id, af.title, af.institution_id, i.name as institution_name
       FROM analysis_findings af JOIN institutions i ON i.id = af.institution_id
       WHERE af.title LIKE ? OR af.narrative LIKE ? LIMIT 4`,
      [like, like]
    )
    for (const f of findings) {
      results.push({ type: 'finding', id: f.id, label: f.title, sublabel: f.institution_name, href: `/institutions/${f.institution_id}?tab=insights` })
    }

    const priorities = query<{ id: number; priority_name: string; institution_id: number; institution_name: string }>(
      `SELECT sp.id, sp.priority_name, sp.institution_id, i.name as institution_name
       FROM strategic_priorities sp JOIN institutions i ON i.id = sp.institution_id
       WHERE sp.priority_name LIKE ? LIMIT 3`,
      [like]
    )
    for (const p of priorities) {
      results.push({ type: 'priority', id: p.id, label: p.priority_name, sublabel: p.institution_name, href: `/institutions/${p.institution_id}?tab=priorities` })
    }

    return results
  }

  function navigate_to(href: string) {
    setOpen(false)
    setTerm('')
    navigate(href)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); return }
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); return }
    if (e.key === 'Enter' && results[activeIdx]) { navigate_to(results[activeIdx].href) }
  }

  const TYPE_ICON: Record<string, React.ReactNode> = {
    institution: <Building2 size={13} className="text-green-600" />,
    document: <FileText size={13} className="text-blue-500" />,
    finding: <Lightbulb size={13} className="text-amber-500" />,
    priority: <Target size={13} className="text-purple-500" />,
  }

  return (
    <div ref={containerRef} className="relative w-72">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search institutions, documents…"
          aria-label="Global search"
          className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-100 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-colors"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden">
          {results.map((r, idx) => (
            <button
              key={`${r.type}-${r.id}`}
              onClick={() => navigate_to(r.href)}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 transition-colors ${idx === activeIdx ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
              onMouseEnter={() => setActiveIdx(idx)}
            >
              <span className="shrink-0">{TYPE_ICON[r.type]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-800 truncate">{r.label}</p>
                {r.sublabel && <p className="text-xs text-slate-400 truncate">{r.sublabel}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
