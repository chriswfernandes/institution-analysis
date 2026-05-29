import { TrendingUp, TrendingDown } from 'lucide-react'

interface Props {
  title: string
  value: string | number
  subtitle?: string
  trend?: 'up' | 'down' | null
  trendValue?: string
  valueClassName?: string
}

export function StatCard({ title, value, subtitle, trend, trendValue, valueClassName }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{title}</p>
      <p className={`text-2xl font-bold text-slate-900 ${valueClassName ?? ''}`}>{value}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      {trend && trendValue && (
        <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
          {trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {trendValue}
        </div>
      )}
    </div>
  )
}
