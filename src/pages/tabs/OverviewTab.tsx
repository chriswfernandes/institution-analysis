import { query } from '../../db/db'
import { StatCard } from '../../components/StatCard'
import { StatusBadge } from '../../components/StatusBadge'
import { formatCurrency } from '../../utils/format'

interface FinancialRow {
  net_surplus_deficit: number | null
  total_revenue: number | null
  total_expenses: number | null
  fiscal_year: string | null
}

interface DocRow {
  id: number
  filename: string
  document_type: string | null
  processing_status: string
  upload_date: string
}

export function OverviewTab({ institutionId }: { institutionId: number }) {
  const [docCount] = query<{ c: number }>('SELECT COUNT(*) as c FROM documents WHERE institution_id = ?', [institutionId])
  const [procCount] = query<{ c: number }>(
    "SELECT COUNT(*) as c FROM documents WHERE institution_id = ? AND processing_status = 'processed'",
    [institutionId]
  )
  const [priorityCount] = query<{ c: number }>('SELECT COUNT(*) as c FROM strategic_priorities WHERE institution_id = ?', [institutionId])
  const [latestFinancial] = query<FinancialRow>(
    'SELECT net_surplus_deficit, total_revenue, total_expenses, fiscal_year FROM financial_summaries WHERE institution_id = ? ORDER BY fiscal_year DESC LIMIT 1',
    [institutionId]
  )
  const recentDocs = query<DocRow>(
    'SELECT id, filename, document_type, processing_status, upload_date FROM documents WHERE institution_id = ? ORDER BY upload_date DESC LIMIT 5',
    [institutionId]
  )

  const surplus = latestFinancial?.net_surplus_deficit
  const surplusPositive = surplus != null && surplus >= 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Total Documents" value={docCount?.c ?? 0} />
        <StatCard title="Processed" value={procCount?.c ?? 0} />
        <StatCard title="Strategic Priorities" value={priorityCount?.c ?? 0} />
        <StatCard
          title="Net Surplus/Deficit"
          value={surplus != null ? formatCurrency(surplus) : '—'}
          subtitle={latestFinancial?.fiscal_year ?? undefined}
          valueClassName={surplus != null ? (surplusPositive ? 'text-green-600' : 'text-red-600') : undefined}
        />
      </div>

      {latestFinancial && (
        <div className="bg-slate-50 rounded-lg p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Latest Financials {latestFinancial.fiscal_year ? `(${latestFinancial.fiscal_year})` : ''}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Total Revenue', value: latestFinancial.total_revenue },
              { label: 'Total Expenses', value: latestFinancial.total_expenses },
              { label: 'Net Surplus/Deficit', value: latestFinancial.net_surplus_deficit },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-slate-400">{label}</p>
                <p className="text-sm font-semibold text-slate-800">{formatCurrency(value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Recent Documents</p>
        {recentDocs.length === 0 ? (
          <p className="text-sm text-slate-400">No documents uploaded yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentDocs.map((doc) => (
              <div key={doc.id} className="py-2.5 flex items-center justify-between gap-3">
                <p className="text-sm text-slate-700 truncate">{doc.filename}</p>
                <div className="flex items-center gap-2 shrink-0">
                  {doc.document_type && (
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{doc.document_type}</span>
                  )}
                  <StatusBadge status={doc.processing_status.charAt(0).toUpperCase() + doc.processing_status.slice(1)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
