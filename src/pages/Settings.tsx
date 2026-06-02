import { useState, useEffect, useRef } from 'react'
import { Eye, EyeOff, Plus, Trash2, Download, Upload, FlaskConical, FileUp } from 'lucide-react'
import { getSetting, setSetting, exportDb, importDb, query, execute, saveDb } from '../db/db'
import { getAllDocuments } from '../db/documentDb'
import { useAppDispatch, useAppState } from '../context/AppContext'
import { useToast } from '../components/useToast'
import { testConnection } from '../services/aiService'
import { seedDatabase, clearAndReseed } from '../db/seedData'
import { downloadCsv } from '../utils/exportCsv'

function parseCsvRows(text: string): Record<string, string>[] {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  if (lines.length < 2) return []

  const parseRow = (line: string): string[] => {
    const fields: string[] = []
    let cur = '', inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        fields.push(cur.trim()); cur = ''
      } else {
        cur += ch
      }
    }
    fields.push(cur.trim())
    return fields
  }

  const headers = parseRow(lines[0]).map((h) => h.toLowerCase())
  return lines.slice(1).map((line) => {
    const vals = parseRow(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
    return row
  })
}
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { Tag, Institution } from '../types'

const PRESET_COLOURS = ['#16a34a','#2563eb','#dc2626','#d97706','#9333ea','#0891b2']

export function Settings() {
  const dispatch = useAppDispatch()
  const { dbReady } = useAppState()
  const showToast = useToast()

  const [endpoint, setEndpoint] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [deployment, setDeployment] = useState('')
  const [apiVersion, setApiVersion] = useState('2024-02-15-preview')
  const [showKey, setShowKey] = useState(false)
  const [lastExport, setLastExport] = useState<string | null>(null)

  const [tags, setTags] = useState<Tag[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [newTagColour, setNewTagColour] = useState(PRESET_COLOURS[0])

  const importRef = useRef<HTMLInputElement>(null)
  const importCsvRef = useRef<HTMLInputElement>(null)
  const [seedConfirmOpen, setSeedConfirmOpen] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)

  useEffect(() => {
    if (!dbReady) return
    setEndpoint(getSetting('azure_openai_endpoint') ?? '')
    setApiKey(getSetting('azure_openai_api_key') ?? '')
    setDeployment(getSetting('azure_openai_deployment') ?? '')
    setApiVersion(getSetting('azure_openai_api_version') ?? '2024-02-15-preview')
    setLastExport(getSetting('last_export_at'))
    loadTags()
  }, [dbReady])

  function loadTags() {
    const rows = query<Tag>('SELECT * FROM tags ORDER BY name')
    setTags(rows)
    dispatch({ type: 'SET_TAGS', payload: rows })
  }

  function saveSettings() {
    setSetting('azure_openai_endpoint', endpoint)
    setSetting('azure_openai_api_key', apiKey)
    setSetting('azure_openai_deployment', deployment)
    setSetting('azure_openai_api_version', apiVersion)
    showToast('success', 'Settings saved')
  }

  function handleExport() {
    exportDb()
    setLastExport(getSetting('last_export_at'))
    showToast('success', 'Database exported')
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await importDb(file)
      showToast('success', 'Database imported successfully')
      loadTags()
    } catch {
      showToast('error', 'Failed to import database')
    }
    if (importRef.current) importRef.current.value = ''
  }

  function addTag() {
    if (!newTagName.trim()) return
    try {
      execute('INSERT INTO tags (name, colour) VALUES (?, ?)', [newTagName.trim(), newTagColour])
      saveDb()
      setNewTagName('')
      loadTags()
      showToast('success', 'Tag created')
    } catch {
      showToast('error', 'Tag name already exists')
    }
  }

  function deleteTag(id: number) {
    execute('DELETE FROM tags WHERE id = ?', [id])
    saveDb()
    loadTags()
    showToast('success', 'Tag deleted')
  }

  function handleDownloadTemplate() {
    downloadCsv('institutions_template.csv', [
      { name: 'University of British Columbia', short_code: 'UBC', province: 'BC', institution_type: 'University', website: 'https://www.ubc.ca', notes: '' },
    ])
  }

  async function handleImportCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (importCsvRef.current) importCsvRef.current.value = ''

    const text = await file.text()
    const rows = parseCsvRows(text)

    if (rows.length === 0) {
      showToast('error', 'CSV is empty or has no data rows')
      return
    }

    const headers = Object.keys(rows[0])
    const missing = ['name', 'short_code'].filter((h) => !headers.includes(h))
    if (missing.length > 0) {
      showToast('error', `CSV missing required columns: ${missing.join(', ')}`)
      return
    }

    const existingCodes = new Set(
      query<{ short_code: string }>('SELECT short_code FROM institutions').map((r) => r.short_code.toUpperCase())
    )

    let imported = 0
    const skipped: string[] = []

    for (const row of rows) {
      const name = row['name']?.trim()
      const short_code = row['short_code']?.trim()

      if (!name || !short_code) { skipped.push(short_code || '(empty)'); continue }
      if (!/^[A-Z0-9\-]+$/i.test(short_code)) { skipped.push(short_code); continue }
      if (existingCodes.has(short_code.toUpperCase())) { skipped.push(short_code.toUpperCase()); continue }

      execute(
        'INSERT INTO institutions (name, short_code, province, institution_type, website, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [name, short_code.toUpperCase(), row['province'] || null, row['institution_type'] || null, row['website'] || null, row['notes'] || null]
      )
      existingCodes.add(short_code.toUpperCase())
      imported++
    }

    if (imported > 0) saveDb()

    const freshInstitutions = query<Institution>(
      `SELECT i.*, COUNT(d.id) as document_count FROM institutions i
       LEFT JOIN documents d ON d.institution_id = i.id
       GROUP BY i.id ORDER BY i.name`
    )
    dispatch({ type: 'SET_INSTITUTIONS', payload: freshInstitutions })

    if (imported === 0) {
      showToast('error', `No institutions imported — all short codes already exist`)
    } else if (skipped.length === 0) {
      showToast('success', `${imported} institution${imported !== 1 ? 's' : ''} imported successfully`)
    } else {
      showToast('info', `${imported} imported, ${skipped.length} skipped (duplicate short codes: ${skipped.join(', ')})`)
    }
  }

  function handleReset() {
    try {
      clearAndReseed()
      const institutions = query<Institution>(
        `SELECT i.*, COUNT(d.id) as document_count FROM institutions i
         LEFT JOIN documents d ON d.institution_id = i.id
         GROUP BY i.id ORDER BY i.name`
      )
      dispatch({ type: 'SET_INSTITUTIONS', payload: institutions })
      const freshTags = query<Tag>('SELECT * FROM tags ORDER BY name')
      dispatch({ type: 'SET_TAGS', payload: freshTags })
      dispatch({ type: 'SET_DOCUMENTS', payload: getAllDocuments() })
      showToast('success', 'Database reset — sample data reloaded')
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Reset failed')
    }
  }

  function handleSeedData() {
    try {
      seedDatabase()
      const institutions = query<Institution>(
        `SELECT i.*, COUNT(d.id) as document_count FROM institutions i
         LEFT JOIN documents d ON d.institution_id = i.id
         GROUP BY i.id ORDER BY i.name`
      )
      dispatch({ type: 'SET_INSTITUTIONS', payload: institutions })
      const tags = query<Tag>('SELECT * FROM tags ORDER BY name')
      dispatch({ type: 'SET_TAGS', payload: tags })
      dispatch({ type: 'SET_DOCUMENTS', payload: getAllDocuments() })
      showToast('success', 'Sample data loaded — 2 institutions, 3 documents, full financial and strategic data')
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to load sample data')
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>

      {/* Azure OpenAI */}
      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Azure OpenAI Configuration</h2>
        <div className="space-y-4">
          <Field label="Endpoint URL" htmlFor="az-endpoint">
            <input id="az-endpoint" type="text" value={endpoint} onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://your-resource.openai.azure.com/"
              className="input" />
          </Field>
          <Field label="API Key" htmlFor="az-key">
            <div className="relative">
              <input id="az-key" type={showKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                className="input pr-10" />
              <button type="button" onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showKey ? 'Hide key' : 'Show key'}>
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>
          <Field label="Deployment Name" htmlFor="az-deployment">
            <input id="az-deployment" type="text" value={deployment} onChange={(e) => setDeployment(e.target.value)}
              placeholder="gpt-4o" className="input" />
          </Field>
          <Field label="API Version" htmlFor="az-version">
            <input id="az-version" type="text" value={apiVersion} onChange={(e) => setApiVersion(e.target.value)}
              className="input" />
          </Field>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={saveSettings}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
            Save Settings
          </button>
          <button
            onClick={async () => {
              showToast('info', 'Testing connection…')
              const result = await testConnection()
              showToast(result.success ? 'success' : 'error', result.message)
            }}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">
            Test Connection
          </button>
        </div>
      </section>

      {/* Database */}
      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-1">Database Management</h2>
        {lastExport && (
          <p className="text-xs text-slate-400 mb-4">Last exported: {new Date(lastExport).toLocaleString()}</p>
        )}
        <div className="flex gap-3">
          <button onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50">
            <Download size={14} /> Export Database
          </button>
          <button onClick={() => importRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50">
            <Upload size={14} /> Import Database
          </button>
          <input ref={importRef} type="file" accept=".db" className="hidden" aria-label="Import database file" onChange={handleImport} />
        </div>
      </section>

      {/* Bulk Import */}
      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-1">Bulk Institution Import</h2>
        <p className="text-sm text-slate-500 mb-4">
          Import multiple institutions at once from a CSV file. Download the template to see the required format.
        </p>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <Download size={14} /> Download CSV Template
          </button>
          <button
            onClick={() => importCsvRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <FileUp size={14} /> Import Institutions from CSV
          </button>
          <input ref={importCsvRef} type="file" accept=".csv" className="hidden" aria-label="Import institutions CSV" onChange={handleImportCsv} />
        </div>
      </section>

      {/* Tag Management */}
      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Tag Management</h2>
        {tags.length === 0 ? (
          <p className="text-sm text-slate-400 mb-4">No tags yet.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {tags.map((tag) => (
              <div key={tag.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: tag.colour ?? '#64748b' }} />
                  <span className="text-sm text-slate-700">{tag.name}</span>
                </div>
                <button onClick={() => deleteTag(tag.id)}
                  className="text-slate-400 hover:text-red-500" aria-label={`Delete tag ${tag.name}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="New tag name"
            aria-label="New tag name"
            onKeyDown={(e) => e.key === 'Enter' && addTag()}
            className="input flex-1 min-w-32"
          />
          <div className="flex gap-1">
            {PRESET_COLOURS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewTagColour(c)}
                className={`w-6 h-6 rounded-full border-2 ${newTagColour === c ? 'border-slate-600' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
                aria-label={`Select colour ${c}`}
              />
            ))}
          </div>
          <button onClick={addTag}
            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
            <Plus size={14} /> Add Tag
          </button>
        </div>
      </section>

      {/* Developer Tools */}
      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-1 flex items-center gap-2">
          <FlaskConical size={16} className="text-slate-400" /> Developer Tools
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          Load realistic sample data to preview all data views without uploading real documents.
        </p>
        <button
          onClick={() => setSeedConfirmOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          <FlaskConical size={14} /> Load Sample Data
        </button>
      </section>

      {/* Danger zone */}
      <section className="border border-red-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-red-700 mb-1">Danger Zone</h2>
        <p className="text-sm text-slate-500 mb-4">
          Deletes all institutions, documents, and extracted data, then reloads the UBC / U of T
          sample dataset. This cannot be undone.
        </p>
        <button
          onClick={() => setResetConfirmOpen(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
        >
          Reset to Sample Data
        </button>
      </section>

      <ConfirmDialog
        open={seedConfirmOpen}
        title="Load Sample Data"
        message="This will add 2 sample institutions (UBC and UToronto) with documents, financials, strategic plans, KPIs, and sustainability data. Your existing data will not be affected."
        confirmLabel="Load Sample Data"
        danger={false}
        onConfirm={() => { setSeedConfirmOpen(false); handleSeedData() }}
        onCancel={() => setSeedConfirmOpen(false)}
      />

      <ConfirmDialog
        open={resetConfirmOpen}
        title="Reset to Sample Data"
        message="This will delete ALL institutions, documents, financials, KPIs, and strategic data, then reload the UBC / U of T sample dataset. This cannot be undone."
        confirmLabel="Reset Database"
        danger
        onConfirm={() => { setResetConfirmOpen(false); handleReset() }}
        onCancel={() => setResetConfirmOpen(false)}
      />
    </div>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  )
}
