const statusStyles: Record<string, string> = {
  Processed: 'bg-green-100 text-green-700',
  Processing: 'bg-blue-100 text-blue-700',
  Pending: 'bg-yellow-100 text-yellow-700',
  Failed: 'bg-red-100 text-red-700',
  'On Track': 'bg-green-100 text-green-700',
  'At Risk': 'bg-orange-100 text-orange-700',
  Achieved: 'bg-blue-100 text-blue-700',
  Unknown: 'bg-slate-100 text-slate-600',
}

export function StatusBadge({ status }: { status: string }) {
  const style = statusStyles[status] ?? 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {status}
    </span>
  )
}
