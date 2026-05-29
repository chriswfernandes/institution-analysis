import { useState, useEffect } from 'react'
import { query, execute, saveDb } from '../db/db'
import { useAppDispatch, useAppState } from '../context/AppContext'
import { useToast } from './useToast'
import type { Institution, Tag } from '../types'
import { Plus, X } from 'lucide-react'

const PROVINCES = ['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT']
const INST_TYPES = ['University','College','Polytechnic','Institute','Other']
const PRESET_COLOURS = ['#16a34a','#2563eb','#dc2626','#d97706','#9333ea','#0891b2']

interface Props {
  institution?: Institution | null
  onClose: () => void
}

function suggestCode(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 6)
}

export function InstitutionForm({ institution, onClose }: Props) {
  const dispatch = useAppDispatch()
  const { tags: allTags } = useAppState()
  const showToast = useToast()

  const [name, setName] = useState(institution?.name ?? '')
  const [shortCode, setShortCode] = useState(institution?.short_code ?? '')
  const [province, setProvince] = useState(institution?.province ?? '')
  const [instType, setInstType] = useState(institution?.institution_type ?? '')
  const [website, setWebsite] = useState(institution?.website ?? '')
  const [notes, setNotes] = useState(institution?.notes ?? '')
  const [selectedTags, setSelectedTags] = useState<number[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [newTagColour, setNewTagColour] = useState(PRESET_COLOURS[0])
  const [showNewTag, setShowNewTag] = useState(false)
  const [codeAutoSet, setCodeAutoSet] = useState(!institution)

  useEffect(() => {
    if (institution) {
      const institutionTags = query<{ tag_id: number }>(
        'SELECT tag_id FROM institution_tags WHERE institution_id = ?',
        [institution.id]
      )
      setSelectedTags(institutionTags.map((r) => r.tag_id))
    }
  }, [institution])

  function handleNameChange(val: string) {
    setName(val)
    if (codeAutoSet) setShortCode(suggestCode(val))
  }

  function handleCodeChange(val: string) {
    setShortCode(val.toUpperCase())
    setCodeAutoSet(false)
  }

  function toggleTag(id: number) {
    setSelectedTags((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id])
  }

  function createTag() {
    if (!newTagName.trim()) return
    try {
      execute('INSERT INTO tags (name, colour) VALUES (?, ?)', [newTagName.trim(), newTagColour])
      saveDb()
      const rows = query<Tag>('SELECT * FROM tags ORDER BY name')
      dispatch({ type: 'SET_TAGS', payload: rows })
      const newTag = rows.find((t) => t.name === newTagName.trim())
      if (newTag) setSelectedTags((prev) => [...prev, newTag.id])
      setNewTagName('')
      setShowNewTag(false)
    } catch {
      showToast('error', 'Tag name already exists')
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !shortCode.trim()) {
      showToast('error', 'Name and short code are required')
      return
    }

    try {
      if (institution) {
        execute(
          `UPDATE institutions SET name=?, short_code=?, province=?, institution_type=?, website=?, notes=?, updated_at=datetime('now') WHERE id=?`,
          [name.trim(), shortCode.trim(), province || null, instType || null, website || null, notes || null, institution.id]
        )
        execute('DELETE FROM institution_tags WHERE institution_id = ?', [institution.id])
      } else {
        execute(
          'INSERT INTO institutions (name, short_code, province, institution_type, website, notes) VALUES (?,?,?,?,?,?)',
          [name.trim(), shortCode.trim(), province || null, instType || null, website || null, notes || null]
        )
      }

      const id = institution?.id ?? (query<{ id: number }>('SELECT last_insert_rowid() as id')[0]?.id ?? 0)
      for (const tagId of selectedTags) {
        execute('INSERT OR IGNORE INTO institution_tags (institution_id, tag_id) VALUES (?,?)', [id, tagId])
      }

      saveDb()
      const institutions = query<Institution>(
        `SELECT i.*, COUNT(d.id) as document_count FROM institutions i
         LEFT JOIN documents d ON d.institution_id = i.id
         GROUP BY i.id ORDER BY i.name`
      )
      dispatch({ type: 'SET_INSTITUTIONS', payload: institutions })
      showToast('success', institution ? 'Institution updated' : 'Institution created')
      onClose()
    } catch (err) {
      showToast('error', String(err).includes('UNIQUE') ? 'Short code already exists' : 'Failed to save institution')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="inst-name" className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
        <input id="inst-name" type="text" value={name} onChange={(e) => handleNameChange(e.target.value)} required
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>

      <div>
        <label htmlFor="inst-code" className="block text-sm font-medium text-slate-700 mb-1">Short Code *</label>
        <input id="inst-code" type="text" value={shortCode} onChange={(e) => handleCodeChange(e.target.value)} required
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>

      <div>
        <label htmlFor="inst-province" className="block text-sm font-medium text-slate-700 mb-1">Province</label>
        <select id="inst-province" value={province} onChange={(e) => setProvince(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="">— Select province —</option>
          {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="inst-type" className="block text-sm font-medium text-slate-700 mb-1">Institution Type</label>
        <select id="inst-type" value={instType} onChange={(e) => setInstType(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="">— Select type —</option>
          {INST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="inst-website" className="block text-sm font-medium text-slate-700 mb-1">Website</label>
        <input id="inst-website" type="url" value={website} onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>

      <div>
        <label htmlFor="inst-notes" className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
        <textarea id="inst-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>

      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">Tags</p>
        <div className="flex flex-wrap gap-2 mb-2">
          {allTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTag(tag.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition-colors ${
                selectedTags.includes(tag.id)
                  ? 'border-transparent text-white'
                  : 'border-slate-300 text-slate-600 bg-white'
              }`}
              style={selectedTags.includes(tag.id) ? { backgroundColor: tag.colour ?? '#64748b' } : {}}
            >
              {selectedTags.includes(tag.id) && <X size={10} />}
              {tag.name}
            </button>
          ))}
        </div>
        {showNewTag ? (
          <div className="flex items-center gap-2 mt-1">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Tag name"
              aria-label="New tag name"
              className="flex-1 border border-slate-300 rounded-lg px-2 py-1 text-sm"
            />
            <div className="flex gap-1">
              {PRESET_COLOURS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewTagColour(c)}
                  className={`w-5 h-5 rounded-full border-2 ${newTagColour === c ? 'border-slate-600' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Colour ${c}`}
                />
              ))}
            </div>
            <button type="button" onClick={createTag} className="text-xs text-green-600 font-medium">Add</button>
            <button type="button" onClick={() => setShowNewTag(false)} className="text-xs text-slate-400">Cancel</button>
          </div>
        ) : (
          <button type="button" onClick={() => setShowNewTag(true)}
            className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 mt-1">
            <Plus size={12} /> Create tag
          </button>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
          Cancel
        </button>
        <button type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
          {institution ? 'Save Changes' : 'Create Institution'}
        </button>
      </div>
    </form>
  )
}
