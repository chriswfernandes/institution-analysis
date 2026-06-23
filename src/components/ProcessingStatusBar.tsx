import { Loader2 } from 'lucide-react'
import { useProcessing, type ProcessingStep } from '../context/ProcessingContext'

const STEP_LABELS: Record<ProcessingStep, string> = {
  reading: 'Reading…',
  converting: 'Converting with Docling…',
  chunking: 'Chunking…',
  saving: 'Saving…',
  classifying: 'Classifying…',
  awaiting_confirmation: 'Waiting for confirmation…',
  extracting_data: 'Extracting data…',
  writing_db: 'Writing to database…',
  complete: 'Complete',
  failed: 'Failed',
}

export function ProcessingStatusBar() {
  const { jobs } = useProcessing()
  if (jobs.length === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-800 text-white px-4 py-2 flex items-center gap-4 overflow-x-auto">
      <Loader2 size={16} className="animate-spin text-green-400 shrink-0" />
      <span className="text-xs font-medium text-slate-300 shrink-0">Processing:</span>
      {jobs.map((job) => (
        <span key={job.id} className="text-xs text-slate-200 shrink-0">
          <span className="font-medium">{job.fileName}</span>
          <span className="text-slate-400 ml-1">— {STEP_LABELS[job.step]}</span>
        </span>
      ))}
    </div>
  )
}
