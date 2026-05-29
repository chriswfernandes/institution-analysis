import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, FileText, CheckCircle, Activity } from 'lucide-react'
import { query } from '../db/db'
import { useAppState } from '../context/AppContext'
import { StatusBadge } from '../components/StatusBadge'
import type { DocumentRow } from '../types'

interface Stats {
  institutionCount: number
  documentCount: number
  processedCount: number
}

export function Dashboard() {
  const { dbReady } = useAppState()
  const [stats, setStats] = useState<Stats>({ institutionCount: 0, documentCount: 0, processedCount: 0 })
  const [recentDocs, setRecentDocs] = useState<DocumentRow[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    if (!dbReady) return
    const [instRow] = query<{ c: number }>('SELECT COUNT(*) as c FROM institutions')
    const [docRow] = query<{ c: number }>('SELECT COUNT(*) as c FROM documents')
    const [procRow] = query<{ c: number }>('SELECT COUNT(*) as c FROM documents WHERE processing_status = ?', ['Processed'])
    setStats({
      institutionCount: instRow?.c ?? 0,
      documentCount: docRow?.c ?? 0,
      processedCount: procRow?.c ?? 0,
    })
    const docs = query<DocumentRow>(
      `SELECT d.*, i.name as institution_name FROM documents d
       JOIN institutions i ON d.institution_id = i.id
       ORDER BY d.upload_date DESC LIMIT 5`
    )
    setRecentDocs(docs)
  }, [dbReady])

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard icon={<Building2 size={20} className="text-green-600" />} label="Institutions" value={stats.institutionCount} />
        <StatCard icon={<FileText size={20} className="text-blue-600" />} label="Documents" value={stats.documentCount} />
        <StatCard icon={<CheckCircle size={20} className="text-green-600" />} label="Processed" value={stats.processedCount} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={16} className="text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700">Recent Activity</h2>
        </div>
        {recentDocs.length === 0 ? (
          <p className="text-sm text-slate-400">No documents uploaded yet. Add an institution and upload documents to get started.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentDocs.map((doc) => (
              <div
                key={doc.id}
                className="py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded"
                onClick={() => navigate(`/institutions/${doc.institution_id}`)}
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{doc.filename}</p>
                  <p className="text-xs text-slate-500">{doc.institution_name}</p>
                </div>
                <StatusBadge status={doc.processing_status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
      <div className="p-2 bg-slate-50 rounded-lg">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  )
}
